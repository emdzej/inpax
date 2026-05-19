import { describe, it, expect } from 'vitest';
import { Opcode, type Instruction } from '@emdzej/inpax-core';
import { formatInstruction } from './formatter.js';

/**
 * Build a minimal `Instruction` for direct formatter unit-testing.
 * `rawByte0` mimics the byte the parser saw on disk before any
 * remap — when it differs from `opcode`, the formatter should emit
 * a "v1.x op 0x__" hint so a user reading the raw bytes alongside
 * the mnemonic isn't confused by the apparent mismatch.
 */
function makeInstr(opts: {
  opcode: number;
  operand1?: number;
  operand2?: number;
  rawByte0?: number;
}): Instruction {
  const operand1 = opts.operand1 ?? 0;
  const operand2 = opts.operand2 ?? 0;
  const rawByte0 = opts.rawByte0 ?? opts.opcode;
  // Reconstruct the 4-byte word as it would have lived on disk.
  const raw =
    (rawByte0 & 0xff) |
    ((operand1 & 0xff) << 8) |
    ((operand2 & 0xffff) << 16);
  return { opcode: opts.opcode, operand1, operand2, raw };
}

describe('formatInstruction — v1.x opcode remap hint', () => {
  // When the parser remaps a v1.x byte into its v5.x equivalent, the
  // raw byte and the canonical opcode differ. The disassembler should
  // surface the original byte as a trailing comment so a reader who
  // cross-checks against the on-disk bytes can reconcile them.

  it('annotates v1.x RET (raw 0x0D → opcode 0x0E)', () => {
    const instr = makeInstr({ opcode: Opcode.RET, rawByte0: 0x0d });
    const out = formatInstruction(instr, 0, undefined, { noColor: true });
    expect(out).toContain('RET');
    expect(out).toContain('v1.x op 0xd');
  });

  it('annotates v1.x FRAME (raw 0x0E → opcode 0x0F)', () => {
    const instr = makeInstr({ opcode: Opcode.FRAME, rawByte0: 0x0e });
    const out = formatInstruction(instr, 0, undefined, { noColor: true });
    expect(out).toContain('FRAME');
    expect(out).toContain('v1.x op 0xe');
  });

  it('annotates v1.x CALLE (raw 0x0F → opcode 0x0D)', () => {
    const instr = makeInstr({ opcode: Opcode.CALLE, rawByte0: 0x0f });
    const out = formatInstruction(instr, 0, undefined, { noColor: true });
    expect(out).toContain('CALLE');
    expect(out).toContain('v1.x op 0xf');
  });

  it('annotates v1.x PUSHIMM (raw 0x10 → opcode 0x11)', () => {
    const instr = makeInstr({ opcode: Opcode.PUSHIMM, rawByte0: 0x10 });
    const out = formatInstruction(instr, 0, undefined, { noColor: true });
    expect(out).toContain('PUSHIMM');
    expect(out).toContain('v1.x op 0x10');
  });

  it('does NOT annotate when opcode matches raw byte (v5.x or shared opcodes)', () => {
    const instr = makeInstr({ opcode: Opcode.LOAD }); // rawByte0 defaults to opcode
    const out = formatInstruction(instr, 0, undefined, { noColor: true });
    expect(out).toContain('LOAD');
    expect(out).not.toContain('v1.x op');
  });

  it('omits the v1.x hint when showComments is disabled', () => {
    const instr = makeInstr({ opcode: Opcode.RET, rawByte0: 0x0d });
    const out = formatInstruction(instr, 0, undefined, {
      noColor: true,
      showComments: false,
    });
    expect(out).toContain('RET');
    expect(out).not.toContain('v1.x op');
  });
});
