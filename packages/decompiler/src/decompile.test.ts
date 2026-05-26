import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { parseIpo } from '@emdzej/inpax-parser';
import { decompile } from './index.js';
import { analyseControlFlow } from './emit.js';
import { Opcode, type Instruction } from '@emdzej/inpax-core';

const SAMPLE_IPO = `${process.env.HOME}/Downloads/inpa/NCSEXPER/SGDAT/080100VMVSW1.ipo`;
const skipReal = !existsSync(SAMPLE_IPO);

/**
 * Hand-built instruction stream used for CFG analysis unit tests.
 * Lets us verify the structured-block detection without parsing a
 * real IPO file.
 */
function instr(opcode: Opcode, op1: number, op2: number): Instruction {
  return {
    opcode,
    operand1: op1,
    operand2: op2,
    raw: 0,
  } as Instruction;
}

describe('analyseControlFlow', () => {
  it('recovers a forward if (no else): JMPZ skips a block, no tail JMP', () => {
    // 0: LOAD  ; pushed-condition
    // 1: JMPZ @3
    // 2: ALLOC ; body
    // 3: RET
    const instrs = [
      instr(Opcode.LOAD, 0, 0),
      instr(Opcode.JMPZ, 0, 3),
      instr(Opcode.ALLOC, 0, 0),
      instr(Opcode.RET, 0, 0),
    ];
    const cfg = analyseControlFlow(instrs);
    // No tail JMP → no if-else recovery (ifElseMap empty); the
    // emitter still recognises this as a simple if via its
    // jzTarget-in-range path, but at the CFG level it's not a
    // consumed pair.
    expect(cfg.ifElseMap.size).toBe(0);
    expect(cfg.whileLoops.size).toBe(0);
  });

  it('recovers an if/else: JMPZ to ELSE; ELSE-1 is JMP to END', () => {
    // 0: LOAD       ; condition
    // 1: JMPZ @4    ; if-false → 4 (else branch)
    // 2: ALLOC      ; then body
    // 3: JMP @5     ; skip past else
    // 4: ALLOC      ; else body
    // 5: RET
    const instrs = [
      instr(Opcode.LOAD, 0, 0),
      instr(Opcode.JMPZ, 0, 4),
      instr(Opcode.ALLOC, 0, 0),
      instr(Opcode.JMP, 0, 5),
      instr(Opcode.ALLOC, 0, 0),
      instr(Opcode.RET, 0, 0),
    ];
    const cfg = analyseControlFlow(instrs);
    expect(cfg.ifElseMap.size).toBe(1);
    const ie = cfg.ifElseMap.get(1)!;
    expect(ie.jzAddr).toBe(1);
    expect(ie.elseAddr).toBe(4);
    expect(ie.endAddr).toBe(5);
    // The JMP at 3 should be consumed (it's the tail of the if/else)
    expect(cfg.consumedJmp.has(3)).toBe(true);
    expect(cfg.consumedJz.has(1)).toBe(true);
  });

  it('recovers a while loop: backward JMP after JMPZ-out', () => {
    // 0: LOAD     ; condition
    // 1: JMPZ @5  ; exit if false
    // 2: ALLOC    ; body
    // 3: ALLOC    ; body
    // 4: JMP @0   ; back-edge
    // 5: RET
    const instrs = [
      instr(Opcode.LOAD, 0, 0),
      instr(Opcode.JMPZ, 0, 5),
      instr(Opcode.ALLOC, 0, 0),
      instr(Opcode.ALLOC, 0, 0),
      instr(Opcode.JMP, 0, 0),
      instr(Opcode.RET, 0, 0),
    ];
    const cfg = analyseControlFlow(instrs);
    expect(cfg.whileLoops.size).toBe(1);
    const wl = cfg.whileLoops.get(0)!;
    expect(wl.condStart).toBe(0);
    expect(wl.jzAddr).toBe(1);
    expect(wl.bodyStart).toBe(2);
    expect(wl.backJmp).toBe(4);
    expect(wl.afterLoop).toBe(5);
    expect(cfg.consumedJz.has(1)).toBe(true);
    expect(cfg.consumedJmp.has(4)).toBe(true);
    // Even though there's a JMPZ inside, the while-loop's JMPZ doesn't
    // also count as an unconsumed condition → no spurious label at 5.
    expect(cfg.labelTargets.has(5)).toBe(false);
  });
});

describe.skipIf(skipReal)('decompile — real IPO', () => {
  it('decompiles 080100VMVSW1.ipo without throwing and produces source', () => {
    const bytes = readFileSync(SAMPLE_IPO);
    const ipo = parseIpo(bytes);
    const src = decompile(ipo);

    // Sanity checks — the file is non-empty, has the header, declares
    // globals, contains function definitions, recovers control flow.
    expect(src).toContain('// Decompiled INPA source (reconstructed)');
    expect(src).toMatch(/^\/\/ Version: \d+\.\d+/m);
    expect(src).toContain('// Global variables');
    expect(src).toMatch(/^[A-Za-z_][A-Za-z0-9_]*\(.*\)$/m); // a function signature
    // At least one structured if recovered — this IPO has plenty.
    expect(src).toMatch(/^\s*if \(/m);

    // Output volume should be roughly 1000+ lines for this IPO.
    const lineCount = src.split('\n').length;
    expect(lineCount).toBeGreaterThan(500);
  });

  it('produces deterministic output (same IPO twice → same source)', () => {
    const bytes = readFileSync(SAMPLE_IPO);
    const ipo1 = parseIpo(bytes);
    const ipo2 = parseIpo(bytes);
    expect(decompile(ipo1)).toBe(decompile(ipo2));
  });

  it('emitHeader: false drops the leading comment block', () => {
    const bytes = readFileSync(SAMPLE_IPO);
    const ipo = parseIpo(bytes);
    const withHeader = decompile(ipo);
    const noHeader = decompile(ipo, { emitHeader: false });
    expect(withHeader.startsWith('// Decompiled INPA')).toBe(true);
    expect(noHeader.startsWith('// Decompiled INPA')).toBe(false);
    // Body content should otherwise match.
    expect(noHeader).toContain('// Global variables');
  });
});
