import { describe, it, expect } from 'vitest';
import { ValueType, BlockType } from '@emdzej/inpax-core';
import { IpoParser } from './ipo-parser.js';

const MAGIC = 'TEST-Infotext';
const LF = 0x0a;

/**
 * Tiny helper for building IPO byte streams in tests. The parser is
 * particular about block-header layout (3 NL-terminated strings
 * interleaved with fixed-width numerics), so we centralise that here
 * to keep the tests readable.
 */
class IpoBuilder {
  private bytes: number[] = [];

  header(versionHi: number, versionLo: number): this {
    this.bytes.push(versionHi, versionLo);
    this.pushString(MAGIC);
    return this;
  }

  /** Append a block header. Caller is responsible for adding the body bytes. */
  block(opts: {
    type: BlockType;
    name?: string;
    blockId?: number;
    flags?: number;
    arg1?: string;
    arg2?: string;
    marker?: number;
    size: number;
  }): this {
    this.bytes.push(opts.type);
    this.pushString(opts.name ?? '');
    this.pushU16LE(opts.blockId ?? 0);
    this.pushU16LE(opts.flags ?? 0);
    this.pushString(opts.arg1 ?? '');
    this.pushString(opts.arg2 ?? '');
    this.bytes.push(opts.marker ?? 0);
    this.pushU16LE(opts.size);
    return this;
  }

  u8(b: number): this {
    this.bytes.push(b & 0xff);
    return this;
  }
  s16(v: number): this {
    return this.pushS16LE(v);
  }
  s32(v: number): this {
    return this.pushS32LE(v);
  }
  /**
   * Append one 4-byte VM instruction: `[opcode][operand1][operand2_lo][operand2_hi]`.
   * Used for the opcode-remap tests that build minimal function blocks.
   */
  instr(opcode: number, operand1: number, operand2: number): this {
    this.bytes.push(opcode & 0xff, operand1 & 0xff, operand2 & 0xff, (operand2 >> 8) & 0xff);
    return this;
  }
  f64(v: number): this {
    const buf = new ArrayBuffer(8);
    new DataView(buf).setFloat64(0, v, true);
    for (let i = 0; i < 8; i++) this.bytes.push(new Uint8Array(buf)[i]);
    return this;
  }
  str(s: string): this {
    this.pushString(s);
    return this;
  }

  build(): Uint8Array {
    return new Uint8Array(this.bytes);
  }

  private pushString(s: string): void {
    for (const ch of s) this.bytes.push(ch.charCodeAt(0));
    this.bytes.push(LF);
  }
  private pushU16LE(v: number): this {
    this.bytes.push(v & 0xff, (v >> 8) & 0xff);
    return this;
  }
  private pushS16LE(v: number): this {
    return this.pushU16LE(v < 0 ? v + 0x10000 : v);
  }
  private pushS32LE(v: number): this {
    const u = v < 0 ? v + 0x100000000 : v;
    this.bytes.push(u & 0xff, (u >> 8) & 0xff, (u >> 16) & 0xff, (u >> 24) & 0xff);
    return this;
  }
}

describe('IpoParser — v5.x', () => {
  it('parses a constants block with all primitive types', () => {
    const builder = new IpoBuilder()
      .header(5, 0)
      .block({ type: BlockType.ConstantData, size: 6 })
      .u8(ValueType.Bool).u8(1)
      .u8(ValueType.Byte).u8(0xab)
      .u8(ValueType.Int).s16(-12345)
      .u8(ValueType.Long).s32(-1_000_000_000)
      .u8(ValueType.Real).f64(3.14159)
      .u8(ValueType.String).str('hello');

    const parser = new IpoParser(builder.build());
    const ipo = parser.parse();

    expect(ipo.header.versionHi).toBe(5);
    expect(ipo.constants.values).toEqual([
      { type: ValueType.Bool, flags: 1, value: true },
      { type: ValueType.Byte, flags: 1, value: 0xab },
      { type: ValueType.Int, flags: 1, value: -12345 },
      { type: ValueType.Long, flags: 1, value: -1_000_000_000 },
      { type: ValueType.Real, flags: 1, value: 3.14159 },
      { type: ValueType.String, flags: 1, value: 'hello' },
    ]);
  });

  it('parses a globals block with raw v5.x type bytes', () => {
    const builder = new IpoBuilder()
      .header(5, 0)
      .block({ type: BlockType.GlobalData, size: 4 })
      .u8(ValueType.Bool)
      .u8(ValueType.Int)
      .u8(ValueType.ULong)
      .u8(ValueType.Object);

    const parser = new IpoParser(builder.build());
    const ipo = parser.parse();

    expect(ipo.globals.types).toEqual([
      ValueType.Bool,
      ValueType.Int,
      ValueType.ULong,
      ValueType.Object,
    ]);
  });
});

describe('IpoParser — v1.x', () => {
  it('translates v1.x constant type bytes to canonical ValueType', () => {
    // v1.x value-type vocabulary (from NCSEXPERT.exe FUN_0046a9a0):
    //   0x01 BOOL, 0x02 INT (s16), 0x03 REAL (f64), 0x04 STRING, 0x05 LONG (s32)
    const builder = new IpoBuilder()
      .header(1, 2)
      .block({ type: BlockType.ConstantData, size: 5 })
      .u8(0x01).u8(1)                   // BOOL true
      .u8(0x02).s16(-32000)             // INT
      .u8(0x03).f64(2.71828)            // REAL
      .u8(0x04).str('ncsexpert')         // STRING
      .u8(0x05).s32(0x7fffffff);        // LONG

    const parser = new IpoParser(builder.build());
    const ipo = parser.parse();

    expect(ipo.header.versionHi).toBe(1);
    expect(ipo.constants.values).toEqual([
      { type: ValueType.Bool, flags: 1, value: true },
      // v1.x type 0x02 (INT) becomes canonical ValueType.Int (0x03)
      { type: ValueType.Int, flags: 1, value: -32000 },
      // v1.x type 0x03 (REAL) becomes canonical ValueType.Real (0x05)
      { type: ValueType.Real, flags: 1, value: 2.71828 },
      // v1.x type 0x04 (STRING) becomes canonical ValueType.String (0x06)
      { type: ValueType.String, flags: 1, value: 'ncsexpert' },
      // v1.x type 0x05 (LONG) becomes canonical ValueType.Long (0x04)
      { type: ValueType.Long, flags: 1, value: 0x7fffffff },
    ]);
  });

  it('translates v1.x global type bytes through the broader globals table', () => {
    // The globals branch of NCSEXPERT.exe's FUN_0046a9a0 accepts a
    // wider set than the constants branch: 0x00 (Void slot 0), 0x06
    // (state-machine/screen handle), in addition to the five primitive
    // types. Real v1.x files in the wild start with a 0x00 slot.
    const builder = new IpoBuilder()
      .header(1, 2)
      .block({ type: BlockType.GlobalData, size: 7 })
      .u8(0x00)  // Void (reserved slot 0)
      .u8(0x01)  // BOOL
      .u8(0x02)  // INT
      .u8(0x03)  // REAL
      .u8(0x04)  // STRING
      .u8(0x05)  // LONG
      .u8(0x06); // handle → ULong

    const parser = new IpoParser(builder.build());
    const ipo = parser.parse();

    expect(ipo.globals.types).toEqual([
      ValueType.Void,
      ValueType.Bool,
      ValueType.Int,
      ValueType.Real,
      ValueType.String,
      ValueType.Long,
      ValueType.ULong,
    ]);
  });

  it('rejects v1.x type bytes outside the 0x01–0x05 range', () => {
    // 0x06 = STRING in v5.x but undefined in v1.x — NCSEXPERT's reader
    // hits `error 0x12e` on this, we surface a TypeError equivalent.
    const builder = new IpoBuilder()
      .header(1, 0)
      .block({ type: BlockType.ConstantData, size: 1 })
      .u8(0x06)
      .u8(0); // would-be value byte; unreachable

    expect(() => new IpoParser(builder.build()).parse()).toThrow(
      /Unknown v1.x constant type byte 0x6/,
    );
  });
});

describe('IpoParser — v1.x opcode remap', () => {
  // v5.x renumbered the four trailing opcodes (0x0D–0x10). Verified
  // against NCSEXPERT's CInterpreter::DoInterpret at FUN_0045d830 and
  // INPA's INPA_VM_Interpret at 0x004607d7:
  //
  //   v1.x byte | v1.x op | v5.x byte | v5.x op
  //   ──────────┼─────────┼───────────┼────────
  //   0x0D      | RET     | 0x0E      | RET
  //   0x0E      | FRAME   | 0x0F      | FRAME
  //   0x0F      | CALLE   | 0x0D      | CALLE
  //   0x10      | PUSHIMM | 0x11      | PUSHIMM
  //
  // After parsing, `Instruction.opcode` should hold the canonical v5.x
  // byte; `Instruction.raw` should still hold the original disk word.
  const OPCODE_REMAP_CASES: Array<[number, number, string]> = [
    [0x0d, 0x0e, 'RET'],
    [0x0e, 0x0f, 'FRAME'],
    [0x0f, 0x0d, 'CALLE'],
    [0x10, 0x11, 'PUSHIMM'],
  ];

  for (const [v1, v5, name] of OPCODE_REMAP_CASES) {
    it(`remaps v1.x ${name} (0x${v1.toString(16)}) → v5.x 0x${v5.toString(16)}`, () => {
      const builder = new IpoBuilder()
        .header(1, 2)
        .block({ type: BlockType.Function, blockId: 1, size: 1 })
        .instr(v1, 0x42, 0xbeef);

      const parser = new IpoParser(builder.build());
      const ipo = parser.parse();
      const fn = ipo.functions.get(1);

      expect(fn).toBeDefined();
      expect(fn!.instructions).toHaveLength(1);
      const instr = fn!.instructions[0];

      // Canonical (v5.x) opcode used by the VM, dispatcher, disassembler.
      expect(instr.opcode).toBe(v5);
      // Operands flow through unchanged.
      expect(instr.operand1).toBe(0x42);
      expect(instr.operand2).toBe(0xbeef);
      // Raw bytes preserve what's on disk for faithful round-tripping.
      expect(instr.raw & 0xff).toBe(v1);
    });
  }

  it('leaves opcodes 0x01–0x0C unchanged in v1.x', () => {
    // The shared opcodes (LOAD/PUSHREF/LOADINOUTREF/NOP/MOVE/PUSHR/
    // PUSHREFSTORE/ALLOC/ALU/JMP/JMPNZ/CALL) are bit-identical between
    // v1.x and v5.x. The remap table must not touch them.
    const builder = new IpoBuilder().header(1, 2).block({
      type: BlockType.Function,
      blockId: 1,
      size: 12,
    });
    for (let op = 0x01; op <= 0x0c; op++) builder.instr(op, 0, 0);

    const parser = new IpoParser(builder.build());
    const ipo = parser.parse();
    const fn = ipo.functions.get(1)!;

    for (let op = 0x01; op <= 0x0c; op++) {
      expect(fn.instructions[op - 1].opcode).toBe(op);
      expect(fn.instructions[op - 1].raw & 0xff).toBe(op);
    }
  });

  it('leaves all opcodes unchanged for v5.x files (no remap applied)', () => {
    // The same byte values that mean RET/FRAME/CALLE in v5.x must
    // come back as-is when versionHi !== 1 — otherwise a v5.x file
    // would get scrambled by the v1.x remap path.
    const v5Ops = [0x0d, 0x0e, 0x0f, 0x10, 0x11];
    const builder = new IpoBuilder().header(5, 0).block({
      type: BlockType.Function,
      blockId: 1,
      size: v5Ops.length,
    });
    for (const op of v5Ops) builder.instr(op, 0, 0);

    const parser = new IpoParser(builder.build());
    const ipo = parser.parse();
    const fn = ipo.functions.get(1)!;

    for (let i = 0; i < v5Ops.length; i++) {
      expect(fn.instructions[i].opcode).toBe(v5Ops[i]);
    }
  });
});
