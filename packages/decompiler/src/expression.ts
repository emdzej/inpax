/**
 * Expression-tree reconstruction from the stack-machine instruction
 * stream. Used by the source-level emitter for:
 *
 *   - building condition expressions for `if (…)` / `while (…)`
 *   - building right-hand-sides of assignments
 *   - building arguments for function calls
 *
 * The strategy mirrors how a tiny stack VM evaluates: each LOAD /
 * PUSHIMM / PUSHREF pushes an operand-string; each ALU pops 1-2 and
 * pushes the resulting expression with operator embedded. The
 * top-of-stack at the end is the recovered expression.
 *
 * Port of qt-inpa-runtime's `buildCondition`, `buildAluExpr`,
 * `buildUnaryExpr`, and `sourceFormatValue`.
 */

import { Opcode, Scope, ValueType, type Instruction, type IpoFile } from '@emdzej/inpax-core';
import {
  formatAluOpLower,
  formatConstantValue,
  resolveMenuName,
  resolveScreenName,
  sourceGlobalName,
  sourceLocalName,
} from './format.js';

/** Map an ALU mnemonic to the IPS source operator form. */
export function buildAluExpr(lhs: string, rhs: string, op: string): string {
  switch (op) {
    case 'add': return `${lhs} + ${rhs}`;
    case 'sub': return `${lhs} - ${rhs}`;
    case 'mul': return `${lhs} * ${rhs}`;
    case 'div': return `${lhs} / ${rhs}`;
    case 'eq':  return `${lhs} == ${rhs}`;
    case 'ne':  return `${lhs} != ${rhs}`;
    case 'lt':  return `${lhs} < ${rhs}`;
    case 'gt':  return `${lhs} > ${rhs}`;
    case 'le':  return `${lhs} <= ${rhs}`;
    case 'ge':  return `${lhs} >= ${rhs}`;
    case 'and': return `${lhs} && ${rhs}`;
    case 'or':  return `${lhs} || ${rhs}`;
    case 'band': return `${lhs} & ${rhs}`;
    case 'bor':  return `${lhs} | ${rhs}`;
    case 'bxor': return `${lhs} ^ ${rhs}`;
    default: return `${op}(${lhs}, ${rhs})`;
  }
}

export function buildUnaryExpr(val: string, op: string): string {
  if (op === 'neg') return `-${val}`;
  if (op === 'not') return `!${val}`;
  return `${op}(${val})`;
}

/**
 * Render a single value-pushing instruction as a source expression
 * fragment. Drives the operand-pushing step of expression rebuilding.
 */
export function sourceFormatValue(
  ipo: IpoFile,
  instr: Instruction,
  paramNames?: readonly string[],
): string {
  switch (instr.opcode as Opcode) {
    case Opcode.LOAD: {
      switch (instr.operand1 as Scope) {
        case Scope.Const: return formatConstantValue(ipo, instr.operand2);
        case Scope.Global: return sourceGlobalName(instr.operand2);
        case Scope.Local: return sourceLocalName(instr.operand2, paramNames);
        case Scope.Screen: return resolveScreenName(ipo, instr.operand2);
        case Scope.Menu: return resolveMenuName(ipo, instr.operand2);
        default:
          return `scope_${instr.operand1.toString(16).padStart(2, '0')}[${instr.operand2}]`;
      }
    }
    case Opcode.PUSHREF: {
      switch (instr.operand1 as Scope) {
        case Scope.Global: return sourceGlobalName(instr.operand2);
        case Scope.Local: return sourceLocalName(instr.operand2, paramNames);
        case Scope.Screen: return resolveScreenName(ipo, instr.operand2);
        case Scope.Menu: return resolveMenuName(ipo, instr.operand2);
        default:
          return `ref_${instr.operand1.toString(16).padStart(2, '0')}[${instr.operand2}]`;
      }
    }
    case Opcode.LOADINOUTREF:
      return sourceLocalName(instr.operand2, paramNames);
    case Opcode.PUSHIMM:
      return formatPushImm(ipo, instr);
    default:
      return '?';
  }
}

/**
 * PUSHIMM encodes its value either inline (operand2 is the value
 * itself for Bool/Int/Byte/Long types) or as a constant-pool index
 * (everything else). The operand1 type tag drives the choice.
 */
function formatPushImm(ipo: IpoFile, instr: Instruction): string {
  switch (instr.operand1) {
    case 0x50: // Bool
      return instr.operand2 ? 'TRUE' : 'FALSE';
    case 0x51: { // Int — operand2 is the signed value
      const v = signExtend16(instr.operand2);
      return String(v);
    }
    case 0x52: // Byte
      return String(instr.operand2 & 0xff);
    case 0x53: { // Long — sign-extend operand2 into a 32-bit signed value
      const v = signExtend16(instr.operand2);
      return String(v);
    }
    default:
      return formatConstantValue(ipo, instr.operand2);
  }
}

function signExtend16(v: number): number {
  return v & 0x8000 ? v - 0x10000 : v;
}

/**
 * True when `instrs[pos]` begins an instruction sequence that
 * culminates in a JMPNZ (i.e. a condition for an `if`/`while`).
 * Bails out as soon as a structural opcode (CALL, FRAME, RET, JMP,
 * PUSHR) is seen — those signal we left the condition zone.
 */
export function isConditionStart(
  instrs: readonly Instruction[],
  pos: number,
  end: number,
): boolean {
  const op = instrs[pos]?.opcode as Opcode | undefined;
  if (op !== Opcode.LOAD && op !== Opcode.PUSHIMM && op !== Opcode.PUSHREF && op !== Opcode.LOADINOUTREF) {
    return false;
  }
  for (let s = pos; s < end && s < instrs.length; s++) {
    const sop = instrs[s]!.opcode as Opcode;
    if (sop === Opcode.JMPZ) return true;
    if (
      sop === Opcode.FRAME ||
      sop === Opcode.CALL ||
      sop === Opcode.CALLE ||
      sop === Opcode.RET ||
      sop === Opcode.JMP ||
      sop === Opcode.PUSHR
    ) {
      return false;
    }
  }
  return false;
}

/**
 * Replay the value-push + ALU stack for the range `[start, jzAddr)`
 * to derive the condition string the `if`/`while` head needs. MOVE
 * is consumed silently (it's the "stash the boolean before jz" step
 * the codegen emits). Returns `"..."` when the stack is empty —
 * usually because the input wasn't a clean condition sequence.
 */
export function buildCondition(
  ipo: IpoFile,
  instrs: readonly Instruction[],
  start: number,
  jzAddr: number,
  paramNames?: readonly string[],
): string {
  const stack: string[] = [];
  for (let j = start; j < jzAddr; j++) {
    const instr = instrs[j]!;
    const op = instr.opcode as Opcode;
    if (op === Opcode.LOAD || op === Opcode.PUSHREF || op === Opcode.LOADINOUTREF || op === Opcode.PUSHIMM) {
      stack.push(sourceFormatValue(ipo, instr, paramNames));
    } else if (op === Opcode.ALU) {
      if (stack.length >= 2) {
        const rhs = stack.pop()!;
        const lhs = stack.pop()!;
        stack.push(buildAluExpr(lhs, rhs, formatAluOpLower(instr.operand1)));
      } else if (stack.length === 1) {
        const val = stack.pop()!;
        stack.push(buildUnaryExpr(val, formatAluOpLower(instr.operand1)));
      }
    }
    // MOVE is consumed silently.
  }
  return stack.length === 0 ? '...' : stack[stack.length - 1]!;
}

// Make ValueType import-only — referenced for re-export compatibility.
export type { ValueType };
