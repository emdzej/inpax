/**
 * Serialise the constant data block payload back to bytes.
 *
 * Used by `save.ts` to splice an edited constant block into the
 * original file. The block HEADER (type byte, name, blockId, flags,
 * args, marker, size) is kept byte-identical from the source file —
 * we never change the count or the type of any constant, only the
 * value contents — so only the *payload* needs re-emission.
 *
 * Layout per constant (matches the writer in
 * `packages/compiler/src/writer/writer.ts` and the parser in
 * `packages/parser/src/parser/ipo-parser.ts`):
 *
 *   01 <u8>          Bool
 *   02 <u8>          Byte
 *   03 <s16 LE>      Int
 *   04 <s32 LE>      Long
 *   05 <f64 LE>      Real
 *   06 <chars> 0A    String  (codepage-encoded, LF-terminated)
 *   07/08/09 <s32>   Handles
 */
import { ValueType } from '@emdzej/inpax-core';
import type { ConstantRecord, ConstValue } from './walker.js';
import { encode as encodeCp } from './codepage.js';

const SEPARATOR = 0x0a;

export interface EncodeOptions {
  codepage: string;
  /** Per-index overrides — entries not in the map keep their original value. */
  edits: ReadonlyMap<number, ConstValue>;
}

export function encodeConstantPayload(
  constants: readonly ConstantRecord[],
  opts: EncodeOptions,
): Uint8Array {
  const out: number[] = [];
  for (const c of constants) {
    const value = opts.edits.has(c.index) ? opts.edits.get(c.index)! : c.value;
    encodeOne(out, c.type, value, opts.codepage);
  }
  return Uint8Array.from(out);
}

function encodeOne(out: number[], type: ValueType, value: ConstValue, codepage: string): void {
  out.push(type);
  switch (type) {
    case ValueType.Bool:
      out.push(value ? 1 : 0);
      return;
    case ValueType.Byte:
      out.push(Number(value) & 0xff);
      return;
    case ValueType.Int:
      pushS16LE(out, Number(value));
      return;
    case ValueType.Long:
      pushS32LE(out, Number(value));
      return;
    case ValueType.Real:
      pushF64LE(out, Number(value));
      return;
    case ValueType.String: {
      const bytes = encodeCp(String(value), codepage);
      for (let i = 0; i < bytes.length; i++) {
        if (bytes[i] === SEPARATOR) {
          throw new Error(
            `string contains 0x0A (LF) — IPO strings are LF-terminated and cannot embed one`,
          );
        }
        out.push(bytes[i]);
      }
      out.push(SEPARATOR);
      return;
    }
    case ValueType.Handle1:
    case ValueType.Handle2:
    case ValueType.Handle3:
      pushS32LE(out, Number(value));
      return;
    default:
      throw new Error(`cannot encode constant of type 0x${(type as number).toString(16)}`);
  }
}

function pushS16LE(out: number[], v: number): void {
  out.push(v & 0xff, (v >> 8) & 0xff);
}

function pushS32LE(out: number[], v: number): void {
  out.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff);
}

function pushF64LE(out: number[], v: number): void {
  const buf = new ArrayBuffer(8);
  new DataView(buf).setFloat64(0, v, true);
  const view = new Uint8Array(buf);
  for (let i = 0; i < 8; i++) out.push(view[i]);
}
