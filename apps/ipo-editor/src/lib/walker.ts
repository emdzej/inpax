/**
 * Byte walker for `.ipo` files.
 *
 * Mirrors `IpoParser` from `@emdzej/inpax-parser` but tracks byte
 * offsets of every block so the editor can:
 *   * decode the Constant Data block's strings with a user-chosen
 *     codepage (the upstream parser hard-codes UTF-8 and silently
 *     corrupts cp1252 bytes ≥ 0x80);
 *   * later splice in a re-emitted constant block while keeping every
 *     other byte of the original file intact.
 */
import { BlockType, ValueType } from '@emdzej/inpax-core';
import { decode } from './codepage.js';

const SEPARATOR = 0x0a;
const MAGIC = 'TEST-Infotext';

export interface BlockRecord {
  readonly type: BlockType;
  /** Offset of the leading type byte in the original file. */
  readonly start: number;
  /** Offset one past the last byte of the block (inclusive of payload). */
  readonly end: number;
  /** Where the payload starts (right after the size u16). */
  readonly payloadStart: number;
  /** Value of the block-header `size` field (verbatim from the file). */
  readonly size: number;
  /** Block name decoded with the active codepage. */
  readonly name: string;
}

export type ConstValue = boolean | number | string;

export interface ConstantRecord {
  readonly index: number;
  readonly type: ValueType;
  /** Offset of the type byte (first byte of this constant). */
  readonly offset: number;
  /** Byte length of this constant including its type byte. */
  readonly byteLength: number;
  readonly value: ConstValue;
}

export interface WalkResult {
  readonly bytes: Uint8Array;
  readonly blocks: BlockRecord[];
  /** The single Constant Data block. */
  readonly constantsBlock: BlockRecord | null;
  readonly constants: ConstantRecord[];
  readonly codepage: string;
}

class Reader {
  pos = 0;
  constructor(
    private readonly bytes: Uint8Array,
    private readonly view: DataView,
  ) {}

  u8(): number {
    return this.bytes[this.pos++];
  }
  peekU8(): number {
    return this.bytes[this.pos];
  }
  u16LE(): number {
    const v = this.view.getUint16(this.pos, true);
    this.pos += 2;
    return v;
  }
  s16LE(): number {
    const v = this.view.getInt16(this.pos, true);
    this.pos += 2;
    return v;
  }
  s32LE(): number {
    const v = this.view.getInt32(this.pos, true);
    this.pos += 4;
    return v;
  }
  u32LE(): number {
    const v = this.view.getUint32(this.pos, true);
    this.pos += 4;
    return v;
  }
  f64LE(): number {
    const v = this.view.getFloat64(this.pos, true);
    this.pos += 8;
    return v;
  }
  /** Read raw bytes up to (but excluding) the next 0x0A, then skip the 0x0A. */
  bytesUntilSep(): Uint8Array {
    const start = this.pos;
    while (this.pos < this.bytes.length && this.bytes[this.pos] !== SEPARATOR) {
      this.pos++;
    }
    const slice = this.bytes.subarray(start, this.pos);
    this.pos++; // skip separator
    return slice;
  }
  skip(n: number): void {
    this.pos += n;
  }
  eof(): boolean {
    return this.pos >= this.bytes.length;
  }
}

/**
 * Parse the file's block layout. Stops as soon as the byte stream is
 * exhausted — IPO has no per-file footer or checksum.
 */
export function walkIpo(bytes: Uint8Array, codepage = 'cp1252'): WalkResult {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const r = new Reader(bytes, view);

  // Header: version_hi, version_lo, magic, separator.
  r.u8();
  r.u8();
  const magic = decode(r.bytesUntilSep(), codepage);
  if (magic !== MAGIC) {
    throw new Error(`not an IPO file (magic "${magic}" ≠ "${MAGIC}")`);
  }

  const blocks: BlockRecord[] = [];
  let constantsBlock: BlockRecord | null = null;
  const constants: ConstantRecord[] = [];

  while (!r.eof()) {
    const start = r.pos;
    const type = r.u8() as BlockType;
    const name = decode(r.bytesUntilSep(), codepage);
    r.u16LE(); // blockId
    r.u16LE(); // flags
    r.bytesUntilSep(); // arg1
    r.bytesUntilSep(); // arg2
    r.u8(); // marker
    const size = r.u16LE();
    const payloadStart = r.pos;

    if (type === BlockType.ConstantData) {
      // Parse each constant in-place, tracking its byte offset.
      for (let i = 0; i < size; i++) {
        const cStart = r.pos;
        const cType = r.u8() as ValueType;
        let value: ConstValue;
        switch (cType) {
          case ValueType.Bool:
            value = r.u8() !== 0;
            break;
          case ValueType.Byte:
            value = r.u8();
            break;
          case ValueType.Int:
            value = r.s16LE();
            break;
          case ValueType.Long:
            value = r.s32LE();
            break;
          case ValueType.Real:
            value = r.f64LE();
            break;
          case ValueType.String:
            value = decode(r.bytesUntilSep(), codepage);
            break;
          case ValueType.Handle1:
          case ValueType.Handle2:
          case ValueType.Handle3:
            value = r.s32LE();
            break;
          default:
            throw new Error(
              `unknown constant type 0x${cType.toString(16)} at offset 0x${cStart.toString(16)}`,
            );
        }
        constants.push({
          index: i,
          type: cType,
          offset: cStart,
          byteLength: r.pos - cStart,
          value,
        });
      }
    } else {
      // Skip non-constant payloads. Block-size meaning differs by
      // type, but for the editor we only need accurate ranges for the
      // Constant Data block. Most function-like blocks store an
      // instruction count (4 bytes per instruction); LogicTable data
      // (0x04) stores 12 bytes per entry. Get this wrong and we'll
      // mis-frame the next block.
      r.skip(payloadSizeBytes(type, size));
    }

    const end = r.pos;
    const record: BlockRecord = { type, start, end, payloadStart, size, name };
    blocks.push(record);
    if (type === BlockType.ConstantData) constantsBlock = record;
  }

  return { bytes, blocks, constantsBlock, constants, codepage };
}

function payloadSizeBytes(type: BlockType, size: number): number {
  switch (type) {
    case BlockType.GlobalData:
      return size; // one byte per global type
    case BlockType.LogicTable:
      return size * 12; // three u32s per entry
    case BlockType.Screen:
    case BlockType.Menu:
    case BlockType.StateMachine:
    case BlockType.Function:
    case BlockType.ScreenFunc:
    case BlockType.LineFunc:
    case BlockType.ControlFunc:
    case BlockType.MenuItemFunc:
    case BlockType.StateFunc:
      return size * 4; // u32 per instruction
    case BlockType.ConstantData:
      throw new Error('constant data sized inline');
    default:
      throw new Error(
        `unknown block type 0x${(type as number).toString(16)}`,
      );
  }
}

/**
 * Heuristic: does the constant pool contain bytes in the 0x80–0x9F
 * range? Those are codepage-specific in cp125x and unused in plain
 * Latin-1, so their presence suggests the user is looking at a real
 * Windows-codepage file. Useful as a startup hint.
 */
export function looksLikeCp125x(bytes: Uint8Array, constantsBlock: BlockRecord | null): boolean {
  if (!constantsBlock) return false;
  for (let i = constantsBlock.payloadStart; i < constantsBlock.end; i++) {
    const b = bytes[i];
    if (b >= 0x80 && b <= 0x9f) return true;
  }
  return false;
}
