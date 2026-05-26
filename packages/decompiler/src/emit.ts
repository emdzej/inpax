/**
 * Source-level emitter — port of qt-inpa-runtime's `sourceInstructions`.
 *
 * Walks an instruction stream and emits IPS source. Recognises:
 *
 *   - **Function call**: `FRAME + LOAD/PUSHIMM/PUSHREF/ALU* + CALL/CALLE`
 *     → `name(args);`
 *   - **Simple assignment**: `LOAD/PUSHIMM + PUSHR + MOVE`
 *     → `target = value;`
 *   - **Expression assignment**: `LOAD/PUSHIMM/PUSHREF + ALU* + PUSHR + MOVE`
 *     → `target = expr;`
 *   - **If / if-else**: forward JMPNZ + matching tail JMP
 *     → `if (cond) { ... } [else { ... }]`
 *   - **While**: backward JMP after JMPNZ
 *     → `while (cond) { ... }`
 *   - **Return**: `RET` → `return;`
 *
 * Patterns we DON'T recover (per qt-inpa-runtime's docs): `for`,
 * `switch`, `do/while` (compiler lowered them), original variable
 * names (IPO doesn't preserve), original integer radix (always hex).
 * Anything irreducible falls back to `goto L_XXXX;` + a label at the
 * target.
 */

import { Opcode, type Instruction, type IpoFile } from '@emdzej/inpax-core';
import {
  buildAluExpr,
  buildCondition,
  buildUnaryExpr,
  isConditionStart,
  sourceFormatValue,
} from './expression.js';
import {
  formatAluOpLower,
  resolveCallName,
  resolveCalleName,
  resolveStoreTarget,
  sourceGlobalName,
  sourceLocalName,
} from './format.js';

/** Position of a backward-JMP-style `while` loop in the instruction stream. */
interface WhileLoop {
  condStart: number;
  jzAddr: number;
  bodyStart: number;
  backJmp: number;
  afterLoop: number;
}

/** Position of a forward-JMPNZ-with-tail-JMP `if/else` shape. */
interface IfElse {
  jzAddr: number;
  elseAddr: number;
  endAddr: number;
}

/**
 * Pre-pass: scan all branches in `instrs`, recover structured
 * `while` + `if/else` shapes, and produce the bookkeeping the
 * emitter needs to know which JMPs/JMPNZs are "consumed" by a
 * structure (so they don't also emit as `goto`).
 */
export function analyseControlFlow(instrs: readonly Instruction[]): {
  whileLoops: Map<number, WhileLoop>;
  ifElseMap: Map<number, IfElse>;
  consumedJz: Set<number>;
  consumedJmp: Set<number>;
  labelTargets: Set<number>;
} {
  const jzMap = new Map<number, number>(); // addr → target
  const jmpMap = new Map<number, number>();
  for (let idx = 0; idx < instrs.length; idx++) {
    const op = instrs[idx]!.opcode as Opcode;
    if (op === Opcode.JMPZ) jzMap.set(idx, instrs[idx]!.operand2);
    else if (op === Opcode.JMP) jmpMap.set(idx, instrs[idx]!.operand2);
  }

  // while loops: backward JMP at addr B where T ≤ B, with a JMPNZ near T
  // whose target > B (the "skip past loop" forward jump).
  // Pattern: T: [condition] jz(B+1) [body] B: jmp(T)
  const whileLoops = new Map<number, WhileLoop>();
  for (const [addr, target] of jmpMap) {
    if (target > addr) continue;
    for (let s = target; s <= addr && s < instrs.length; s++) {
      const jzTarget = jzMap.get(s);
      if (jzTarget !== undefined && jzTarget > addr) {
        whileLoops.set(target, {
          condStart: target,
          jzAddr: s,
          bodyStart: s + 1,
          backJmp: addr,
          afterLoop: addr + 1,
        });
        break;
      }
    }
  }

  // if/else: JMPNZ(ELSE) where ELSE-1 is JMP(END). Skip JMPNZs already
  // claimed by a while loop's condition; skip JMPs that are while
  // back-edges.
  const ifElseMap = new Map<number, IfElse>();
  for (const [addr, elseAddr] of jzMap) {
    let isWhileCond = false;
    for (const wl of whileLoops.values()) {
      if (addr === wl.jzAddr) { isWhileCond = true; break; }
    }
    if (isWhileCond) continue;
    if (elseAddr === 0 || elseAddr > instrs.length) continue;

    const jmpTarget = jmpMap.get(elseAddr - 1);
    if (jmpTarget === undefined || jmpTarget < elseAddr) continue;

    let isWhileBack = false;
    for (const wl of whileLoops.values()) {
      if (elseAddr - 1 === wl.backJmp) { isWhileBack = true; break; }
    }
    if (isWhileBack) continue;

    ifElseMap.set(addr, { jzAddr: addr, elseAddr, endAddr: jmpTarget });
  }

  // Bookkeeping: which JMPs / JMPNZs are part of a structured block?
  const consumedJz = new Set<number>();
  const consumedJmp = new Set<number>();
  for (const wl of whileLoops.values()) {
    consumedJz.add(wl.jzAddr);
    consumedJmp.add(wl.backJmp);
  }
  for (const ie of ifElseMap.values()) {
    consumedJz.add(ie.jzAddr);
    consumedJmp.add(ie.elseAddr - 1);
  }

  // Targets that need labels: any non-consumed branch target.
  const labelTargets = new Set<number>();
  for (const [addr, target] of jmpMap) {
    if (!consumedJmp.has(addr)) labelTargets.add(target);
  }
  for (const [addr, target] of jzMap) {
    if (!consumedJz.has(addr)) labelTargets.add(target);
  }

  return { whileLoops, ifElseMap, consumedJz, consumedJmp, labelTargets };
}

/**
 * Emit the source-level rendering of `instrs` into `lines`. The
 * `indent` parameter is the per-level whitespace prefix; recursion
 * appends 4 spaces per nested block.
 */
export function sourceInstructions(
  ipo: IpoFile,
  instrs: readonly Instruction[],
  indent: string,
  lines: string[],
  paramNames?: readonly string[],
): void {
  const cfg = analyseControlFlow(instrs);

  const emit = (start: number, end: number, ind: string): void => {
    let i = start;
    while (i < end && i < instrs.length) {
      // Emit a label at unconsumed branch targets.
      if (cfg.labelTargets.has(i)) {
        const labelIndent = ind.length >= 2 ? ind.slice(0, -2) : '';
        lines.push(`${labelIndent}L_${i.toString(16).toUpperCase().padStart(4, '0')}:`);
      }

      // while loop head?
      const wl = cfg.whileLoops.get(i);
      if (wl && wl.backJmp < end) {
        const cond = buildCondition(ipo, instrs, wl.condStart, wl.jzAddr, paramNames);
        lines.push(`${ind}while (${cond})`);
        lines.push(`${ind}{`);
        emit(wl.bodyStart, wl.backJmp, ind + '    ');
        lines.push(`${ind}}`);
        i = wl.afterLoop;
        continue;
      }

      const instr = instrs[i]!;
      const opcode = instr.opcode as Opcode;

      // Condition start leading to a JMPNZ?
      if (
        (opcode === Opcode.LOAD ||
          opcode === Opcode.PUSHIMM ||
          opcode === Opcode.PUSHREF ||
          opcode === Opcode.LOADINOUTREF) &&
        isConditionStart(instrs, i, end)
      ) {
        let condJzAddr = -1;
        for (let s = i; s < end && s < instrs.length; s++) {
          if ((instrs[s]!.opcode as Opcode) === Opcode.JMPZ) {
            condJzAddr = s;
            break;
          }
        }
        if (condJzAddr >= 0) {
          const jzTarget = instrs[condJzAddr]!.operand2;
          const ie = cfg.ifElseMap.get(condJzAddr);

          if (ie && ie.endAddr <= end) {
            const cond = buildCondition(ipo, instrs, i, condJzAddr, paramNames);
            lines.push(`${ind}if (${cond})`);
            lines.push(`${ind}{`);
            emit(condJzAddr + 1, ie.elseAddr - 1, ind + '    ');
            lines.push(`${ind}}`);
            lines.push(`${ind}else`);
            lines.push(`${ind}{`);
            emit(ie.elseAddr, ie.endAddr, ind + '    ');
            lines.push(`${ind}}`);
            i = ie.endAddr;
            continue;
          }

          // Simple if (no else).
          if (jzTarget > condJzAddr && jzTarget <= end) {
            const cond = buildCondition(ipo, instrs, i, condJzAddr, paramNames);
            lines.push(`${ind}if (${cond})`);
            lines.push(`${ind}{`);
            emit(condJzAddr + 1, jzTarget, ind + '    ');
            lines.push(`${ind}}`);
            i = jzTarget;
            continue;
          }

          // Fallthrough — emit as `if (!cond) goto L_XXXX;`
          const cond = buildCondition(ipo, instrs, i, condJzAddr, paramNames);
          lines.push(
            `${ind}if (!(${cond})) goto L_${jzTarget.toString(16).toUpperCase().padStart(4, '0')};`,
          );
          i = condJzAddr + 1;
          continue;
        }
      }

      // FRAME + arg pushes + CALL/CALLE → `funcName(args);`
      if (opcode === Opcode.FRAME) {
        const args: string[] = [];
        let j = i + 1;
        let foundCall = false;
        while (j < end && j < instrs.length) {
          const nextOp = instrs[j]!.opcode as Opcode;
          if (nextOp === Opcode.CALL || nextOp === Opcode.CALLE) {
            foundCall = true;
            break;
          }
          if (nextOp === Opcode.ALU) {
            if (args.length >= 2) {
              const rhs = args.pop()!;
              const lhs = args.pop()!;
              args.push(buildAluExpr(lhs, rhs, formatAluOpLower(instrs[j]!.operand1)));
            } else if (args.length === 1) {
              const val = args.pop()!;
              args.push(buildUnaryExpr(val, formatAluOpLower(instrs[j]!.operand1)));
            }
            j++;
            continue;
          }
          if (
            nextOp === Opcode.LOAD ||
            nextOp === Opcode.PUSHREF ||
            nextOp === Opcode.LOADINOUTREF ||
            nextOp === Opcode.PUSHIMM
          ) {
            args.push(sourceFormatValue(ipo, instrs[j]!, paramNames));
            j++;
            continue;
          }
          break;
        }
        if (foundCall) {
          const callInstr = instrs[j]!;
          const funcName =
            (callInstr.opcode as Opcode) === Opcode.CALLE
              ? resolveCalleName(ipo, callInstr.operand2)
              : resolveCallName(ipo, callInstr.operand1, callInstr.operand2);
          lines.push(`${ind}${funcName}(${args.join(', ')});`);
          i = j + 1;
          continue;
        }
        i++;
        continue;
      }

      // LOAD/PUSHIMM + PUSHR + MOVE → simple `target = value;`
      if (
        (opcode === Opcode.LOAD || opcode === Opcode.PUSHIMM) &&
        i + 2 < end &&
        (instrs[i + 1]!.opcode as Opcode) === Opcode.PUSHR &&
        (instrs[i + 2]!.opcode as Opcode) === Opcode.MOVE
      ) {
        const value = sourceFormatValue(ipo, instr, paramNames);
        const target = resolveStoreTarget(
          ipo,
          instrs[i + 1]!.operand1,
          instrs[i + 1]!.operand2,
          paramNames,
        );
        lines.push(`${ind}${target} = ${value};`);
        i += 3;
        continue;
      }

      // Expression + PUSHR/PUSHREFSTORE + MOVE → computed assignment.
      if (
        opcode === Opcode.LOAD ||
        opcode === Opcode.PUSHIMM ||
        opcode === Opcode.PUSHREF ||
        opcode === Opcode.LOADINOUTREF
      ) {
        const stack: string[] = [];
        let j = i;
        let handled = false;
        while (j < end && j < instrs.length) {
          const op = instrs[j]!.opcode as Opcode;
          if (
            op === Opcode.LOAD ||
            op === Opcode.PUSHREF ||
            op === Opcode.LOADINOUTREF ||
            op === Opcode.PUSHIMM
          ) {
            stack.push(sourceFormatValue(ipo, instrs[j]!, paramNames));
            j++;
          } else if (op === Opcode.ALU) {
            if (stack.length >= 2) {
              const rhs = stack.pop()!;
              const lhs = stack.pop()!;
              stack.push(buildAluExpr(lhs, rhs, formatAluOpLower(instrs[j]!.operand1)));
            } else if (stack.length === 1) {
              const val = stack.pop()!;
              stack.push(buildUnaryExpr(val, formatAluOpLower(instrs[j]!.operand1)));
            }
            j++;
          } else if (op === Opcode.PUSHR || op === Opcode.PUSHREFSTORE) {
            if (stack.length === 0) break;
            const value = stack.pop()!;
            let target: string;
            if (op === Opcode.PUSHR) {
              target = resolveStoreTarget(ipo, instrs[j]!.operand1, instrs[j]!.operand2, paramNames);
            } else {
              // PUSHREFSTORE: target = the ref stored at (scope, index)
              const refScope = instrs[j]!.operand1;
              const refIdx = instrs[j]!.operand2;
              if (refScope === 0x10 /* Scope.Global */) {
                target = sourceGlobalName(refIdx);
              } else if (refScope === 0x30 /* Scope.Local */) {
                target = sourceLocalName(refIdx, paramNames);
              } else {
                target = `ref_${refScope.toString(16).padStart(2, '0')}_${refIdx.toString(16).padStart(2, '0')}`;
              }
            }
            lines.push(`${ind}${target} = ${value};`);
            j++;
            if (j < end && (instrs[j]!.opcode as Opcode) === Opcode.MOVE) j++;
            i = j;
            handled = true;
            break;
          } else if (op === Opcode.MOVE) {
            j++;
          } else {
            break;
          }
        }
        if (handled) continue;
        // Pattern didn't complete cleanly. Skip the consumed range to
        // avoid noise from orphaned pushes that don't form a
        // recognisable expression.
        if (j > i) {
          i = j;
          continue;
        }
        lines.push(`${ind}// (unhandled) ${describeOpcode(opcode)} ${instr.operand1.toString(16)} ${instr.operand2.toString(16)}`);
        i++;
        continue;
      }

      // Standalone JMP that wasn't consumed by while / if-else.
      if (opcode === Opcode.JMP) {
        if (!cfg.consumedJmp.has(i)) {
          lines.push(`${ind}goto L_${instr.operand2.toString(16).toUpperCase().padStart(4, '0')};`);
        }
        i++;
        continue;
      }

      // Standalone JMPNZ — shouldn't normally happen if condition
      // analysis caught everything, but emit a placeholder if so.
      if (opcode === Opcode.JMPZ) {
        lines.push(
          `${ind}if (...) goto L_${instr.operand2.toString(16).toUpperCase().padStart(4, '0')};`,
        );
        i++;
        continue;
      }

      // Silent opcodes — these don't translate to source on their own
      // (they're parts of larger patterns or pure stack bookkeeping).
      if (
        opcode === Opcode.ALU ||
        opcode === Opcode.MOVE ||
        opcode === Opcode.ALLOC ||
        opcode === Opcode.NOP ||
        opcode === Opcode.PUSHR ||
        opcode === Opcode.PUSHREFSTORE
      ) {
        i++;
        continue;
      }

      if (opcode === Opcode.RET) {
        lines.push(`${ind}return;`);
        i++;
        continue;
      }

      if (opcode === Opcode.LOGTABLE) {
        lines.push(`${ind}// logtable(${instr.operand2})`);
        i++;
        continue;
      }

      // Unknown — comment out so we don't lose information.
      lines.push(
        `${ind}// ${describeOpcode(opcode)} ${instr.operand1.toString(16)} ${instr.operand2.toString(16)}`,
      );
      i++;
    }
  };

  emit(0, instrs.length, indent);
}

function describeOpcode(op: Opcode): string {
  return Opcode[op] ?? `OP_${(op as number).toString(16).padStart(2, '0')}`;
}
