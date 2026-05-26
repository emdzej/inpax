/**
 * `@emdzej/inpax-decompiler` — lift compiled `.IPO` bytecode back to
 * readable `.IPS`-like source code.
 *
 * Top-level entry: `decompile(ipo)` returns a single source document
 * with globals, user functions, screens, menus, and state machines
 * walked in order. Each function body runs through the source-level
 * emitter (`sourceInstructions`) which recognises function calls,
 * assignments, expressions, structured `if/else`, and `while`. Flow
 * the emitter can't structure falls back to `goto L_XXXX;` + label.
 *
 * Patterns + scaffolding ported with permission from
 * `qt-inpa-runtime`'s `ipo_dumper.cpp` (~1750 lines C++). See
 * `inpax/docs/proposals/ipo-to-ips-decompile.md` for the
 * relationship + the catalogue of recognised vs. unrecognised
 * patterns.
 *
 * What does NOT round-trip:
 *
 * - Original variable / parameter names. Globals are emitted as
 *   `g_XX`, locals as `l_XX`, inferred parameters as `p_XX`.
 * - Integer literal radix. Constants are always rendered in hex.
 * - `for`, `switch`, `do/while` — the compiler lowered them into
 *   `while` + branches before encoding.
 * - Non-reducible control flow → `goto` + labels.
 *
 * Recompiling the decompiler's output through `@emdzej/inpax-compiler`
 * is intended to produce *semantically* equivalent bytecode, not
 * byte-identical bytecode.
 */

import { Opcode, type FunctionBlock, type Instruction, type IpoFile } from '@emdzej/inpax-core';
import { sourceInstructions } from './emit.js';
import { formatValueType } from './format.js';

export interface DecompileOptions {
  /**
   * Per-statement indent. Default 4 spaces — matches the IPS source
   * convention. Pass `'\t'` for tab indents.
   */
  indent?: string;
  /**
   * Include the `// Decompiled INPA source (reconstructed)` header
   * with IPO version. Default `true`. Pass `false` for cleaner diff
   * fixtures.
   */
  emitHeader?: boolean;
}

/**
 * Decompile a full IPO file into a single IPS source document.
 *
 * Walks: globals → user functions → screens → menus → state
 * machines, emitting each function body via `sourceInstructions`.
 */
export function decompile(ipo: IpoFile, options: DecompileOptions = {}): string {
  const indent = options.indent ?? '    ';
  const emitHeader = options.emitHeader ?? true;
  const lines: string[] = [];

  if (emitHeader) {
    lines.push('// Decompiled INPA source (reconstructed)');
    lines.push(`// Version: ${ipo.header.versionHi}.${ipo.header.versionLo}`);
    lines.push('');
  }

  emitGlobals(ipo, lines);
  emitFunctions(ipo, lines, indent);
  emitScreens(ipo, lines, indent);
  emitMenus(ipo, lines, indent);
  emitStateMachines(ipo, lines, indent);

  return lines.join('\n');
}

function emitGlobals(ipo: IpoFile, lines: string[]): void {
  const types = ipo.globals.types;
  if (types.length <= 1) return;
  lines.push('// Global variables');
  // Index 0 is conventionally the implicit "no global" sentinel —
  // skipped in source-mode output (matches qt-inpa-runtime).
  for (let i = 1; i < types.length; i++) {
    const name = `g_${i.toString(16).toUpperCase().padStart(2, '0')}`;
    lines.push(`${formatValueType(types[i]!)} ${name};`);
  }
  lines.push('');
}

function emitFunctions(ipo: IpoFile, lines: string[], indent: string): void {
  const argCounts = inferFunctionArgCounts(ipo);
  for (const func of ipo.functions.values()) {
    const argCount = argCounts.get(func.header.blockId) ?? 0;
    const paramNames = inferParamNames(argCount);

    lines.push(`${func.header.name}(${paramNames.join(', ')})`);
    lines.push('{');
    sourceInstructions(ipo, func.instructions, indent, lines, paramNames);
    lines.push('}');
    lines.push('');
  }
}

function emitScreens(ipo: IpoFile, lines: string[], indent: string): void {
  for (const screen of ipo.screens.values()) {
    lines.push(`SCREEN ${screen.header.name}()`);
    lines.push('{');

    if (screen.initFunc && screen.initFunc.instructions.length > 0) {
      sourceInstructions(ipo, screen.initFunc.instructions, indent, lines);
    }

    for (const line of screen.lines) {
      lines.push('');
      lines.push(`${indent}LINE("${line.header.arg1}", "${line.header.arg2}")`);
      lines.push(`${indent}{`);
      if (line.func) {
        sourceInstructions(ipo, line.func.instructions, indent + indent, lines);
      }
      for (const ctrl of line.controls) {
        if (ctrl.func) {
          sourceInstructions(ipo, ctrl.func.instructions, indent + indent, lines);
        }
      }
      lines.push(`${indent}}`);
    }

    lines.push('}');
    lines.push('');
  }
}

function emitMenus(ipo: IpoFile, lines: string[], indent: string): void {
  for (const menu of ipo.menus.values()) {
    lines.push(`MENU ${menu.header.name}()`);
    lines.push('{');

    if (menu.func && menu.func.instructions.length > 0) {
      lines.push(`${indent}INIT`);
      lines.push(`${indent}{`);
      sourceInstructions(ipo, menu.func.instructions, indent + indent, lines);
      lines.push(`${indent}}`);
    }

    for (const item of menu.items) {
      lines.push('');
      lines.push(`${indent}ITEM(${item.header.flags}, "${item.header.arg1}")`);
      lines.push(`${indent}{`);
      if (item.func) {
        sourceInstructions(ipo, item.func.instructions, indent + indent, lines);
      }
      lines.push(`${indent}}`);
    }

    lines.push('}');
    lines.push('');
  }
}

function emitStateMachines(ipo: IpoFile, lines: string[], indent: string): void {
  for (const sm of ipo.stateMachines.values()) {
    lines.push(`STATEMACHINE ${sm.header.name}()`);
    lines.push('{');

    if (sm.func && sm.func.instructions.length > 0) {
      lines.push(`${indent}INIT`);
      lines.push(`${indent}{`);
      sourceInstructions(ipo, sm.func.instructions, indent + indent, lines);
      lines.push(`${indent}}`);
    }

    for (const state of sm.states) {
      lines.push('');
      lines.push(`${indent}STATE "${state.header.name}"`);
      lines.push(`${indent}{`);
      if (state.func) {
        sourceInstructions(ipo, state.func.instructions, indent + indent, lines);
      }
      lines.push(`${indent}}`);
    }

    lines.push('}');
    lines.push('');
  }
}

/**
 * Function-signature inference: scan every CALL site for each user
 * function, count the arg pushes that precede it (LOAD/PUSHREF/
 * LOADINOUTREF/PUSHIMM = +1, ALU binary = -1), and take the max
 * count seen as the function's likely arity.
 *
 * Port of qt-inpa-runtime's `inferFunctionArgCounts`. Not byte-for-
 * byte accurate (unary vs binary ALU is heuristic), but the result
 * is good enough to seed the `p_XX` naming for the first N locals.
 */
export function inferFunctionArgCounts(ipo: IpoFile): Map<number, number> {
  const argCounts = new Map<number, number>();
  const scanInstrs = (instrs: readonly Instruction[]): void => {
    for (let i = 0; i < instrs.length; i++) {
      if ((instrs[i]!.opcode as Opcode) !== Opcode.FRAME) continue;
      let argCount = 0;
      let j = i + 1;
      while (j < instrs.length) {
        const op = instrs[j]!.opcode as Opcode;
        if (op === Opcode.CALL) {
          if (instrs[j]!.operand1 === 0x01 /* CallTarget.UserFunction */) {
            const funcId = instrs[j]!.operand2;
            const prev = argCounts.get(funcId) ?? 0;
            if (argCount > prev) argCounts.set(funcId, argCount);
          }
          break;
        }
        if (op === Opcode.CALLE) break;
        if (
          op === Opcode.LOAD ||
          op === Opcode.PUSHREF ||
          op === Opcode.LOADINOUTREF ||
          op === Opcode.PUSHIMM
        ) {
          argCount++;
        } else if (op === Opcode.ALU) {
          if (argCount >= 2) argCount--; // assume binary
        } else {
          break;
        }
        j++;
      }
    }
  };

  const scanFunc = (f?: FunctionBlock): void => {
    if (f) scanInstrs(f.instructions);
  };

  for (const func of ipo.functions.values()) scanInstrs(func.instructions);
  for (const screen of ipo.screens.values()) {
    scanFunc(screen.allocFunc);
    scanFunc(screen.initFunc);
    for (const line of screen.lines) {
      scanFunc(line.func);
      for (const ctrl of line.controls) scanFunc(ctrl.func);
    }
  }
  for (const menu of ipo.menus.values()) {
    scanFunc(menu.func);
    for (const item of menu.items) scanFunc(item.func);
  }
  for (const sm of ipo.stateMachines.values()) {
    scanFunc(sm.func);
    for (const state of sm.states) scanFunc(state.func);
  }

  return argCounts;
}

/** Generate `p_00`, `p_01`, … for `argCount` parameters. */
export function inferParamNames(argCount: number): string[] {
  return Array.from({ length: argCount }, (_, i) => `p_${i.toString(16).toUpperCase().padStart(2, '0')}`);
}

// Re-export the helpers a consumer might want for custom emission.
export { sourceInstructions, analyseControlFlow } from './emit.js';
export {
  formatAluOpLower,
  formatConstantValue,
  formatValueType,
  resolveCallName,
  resolveCalleName,
  resolveFunctionName,
  resolveMenuName,
  resolveScreenName,
  resolveStoreTarget,
  sourceGlobalName,
  sourceLocalName,
} from './format.js';
export {
  buildAluExpr,
  buildCondition,
  buildUnaryExpr,
  isConditionStart,
  sourceFormatValue,
} from './expression.js';
