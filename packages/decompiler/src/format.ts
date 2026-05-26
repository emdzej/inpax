/**
 * Formatting helpers shared between the dump modes.
 *
 * Port of qt-inpa-runtime's `IpoDumper` static helpers
 * (formatAluOpLower, formatValueType, formatConstantValue, escape).
 * The qt-inpa-runtime decompiler patterns are used here with the
 * author's permission — see `docs/proposals/ipo-to-ips-decompile.md`
 * for the licensing arrangement and prior-art citation.
 */

import {
  AluOp,
  CallTarget,
  Scope,
  SystemFunctionMap,
  ValueType,
  type IpoFile,
  type StackEntry,
} from '@emdzej/inpax-core';

/**
 * Lower-case ALU mnemonic — `add`, `lt`, etc. Used both as the source
 * for the operator-to-symbol mapping and as a fallback display when
 * an ALU op doesn't fit a recognised expression shape.
 */
export function formatAluOpLower(op: number): string {
  switch (op as AluOp) {
    case AluOp.ADD: return 'add';
    case AluOp.SUB: return 'sub';
    case AluOp.MUL: return 'mul';
    case AluOp.DIV: return 'div';
    case AluOp.LT:  return 'lt';
    case AluOp.GT:  return 'gt';
    case AluOp.LE:  return 'le';
    case AluOp.GE:  return 'ge';
    case AluOp.EQ:  return 'eq';
    case AluOp.NE:  return 'ne';
    case AluOp.AND: return 'and';
    case AluOp.OR:  return 'or';
    case AluOp.XOR: return 'xor';
    case AluOp.NEG: return 'neg';
    case AluOp.NOT: return 'not';
    case AluOp.BAND: return 'band';
    case AluOp.BOR: return 'bor';
    case AluOp.BXOR: return 'bxor';
    default: return `alu_${op.toString(16).padStart(2, '0')}`;
  }
}

/** ValueType → IPS source type token (`int`, `bool`, …). */
export function formatValueType(t: ValueType): string {
  switch (t) {
    case ValueType.Void: return 'void';
    case ValueType.Bool: return 'bool';
    case ValueType.Byte: return 'byte';
    case ValueType.Int: return 'int';
    case ValueType.Long: return 'long';
    case ValueType.Real: return 'real';
    case ValueType.String: return 'string';
    case ValueType.ULong: return 'ulong';
    case ValueType.Numeric: return 'numeric';
    case ValueType.Object: return 'object';
    default: return 'unknown';
  }
}

/**
 * Escape a string for emission inside `"…"`. Mirrors what the C++
 * source emits — common control chars get readable escapes; the rest
 * pass through. Used by `formatConstantValue` so string literals
 * appear roundtrip-clean.
 */
export function escapeString(s: string): string {
  let out = '';
  for (const ch of s) {
    if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\t') out += '\\t';
    else if (ch === '"') out += '\\"';
    else if (ch === '\\') out += '\\\\';
    else out += ch;
  }
  return out;
}

/**
 * Format a constant pool entry as IPS source. Strings are quoted +
 * escaped; numerics are emitted as hex matching the source-mode
 * output (`0x0005` rather than `5`) — IPO doesn't preserve the
 * original radix, and hex is closer to the raw bytecode encoding.
 */
export function formatConstantValue(ipo: IpoFile, index: number): string {
  if (index >= ipo.constants.values.length) {
    return `const[${index}]`;
  }
  const c: StackEntry = ipo.constants.values[index]!;
  switch (c.type) {
    case ValueType.String:
      return `"${escapeString(String(c.value ?? ''))}"`;
    case ValueType.Bool:
      return c.value ? 'true' : 'false';
    case ValueType.Int:
      return `0x${asInt(c).toString(16).toUpperCase().padStart(4, '0')}`;
    case ValueType.Long:
    case ValueType.ULong:
      return `0x${(asInt(c) >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
    case ValueType.Byte:
      return `0x${(asInt(c) & 0xff).toString(16).toUpperCase().padStart(2, '0')}`;
    case ValueType.Real: {
      const n = typeof c.value === 'number' ? c.value : Number(c.value);
      return formatReal(n);
    }
    default:
      return '?';
  }
}

/**
 * Compact real-number formatter. Mirrors `%g` from the C++ source —
 * trim trailing zeroes / decimal points so 1.0 prints as `1`,
 * 1.23000 as `1.23`.
 */
function formatReal(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  const s = n.toPrecision(6);
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

function asInt(c: StackEntry): number {
  const v = c.value;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/**
 * Resolve a SYS opcode operand to the registered system-function
 * name. Returns `undefined` when the index has no entry — the caller
 * decides whether to fall back to `sys_NN` or pick another label.
 */
export function getSystemFunctionName(index: number): string | undefined {
  return SystemFunctionMap.get(index)?.name;
}

/**
 * Bind a CALL instruction's `(op1, op2)` pair to a human-readable
 * target name. Reused by both the decompile-mode output (`callextern
 * (…)` / `calllocal(…)`) and the source-level output (the bare
 * function name `foo`).
 */
export function resolveCallName(ipo: IpoFile, op1: number, op2: number): string {
  if (op1 === CallTarget.SystemFunction) {
    return getSystemFunctionName(op2) ?? `sys_${op2.toString(16).padStart(2, '0')}`;
  }
  if (op1 === CallTarget.UserFunction) {
    return ipo.functions.get(op2)?.header.name ?? `func_${op2.toString(16).padStart(2, '0')}`;
  }
  return `call_${op1.toString(16).padStart(2, '0')}[${op2}]`;
}

/** Resolve a CALLE constant-pool index to the import's function name. */
export function resolveCalleName(ipo: IpoFile, op2: number): string {
  if (op2 < ipo.constants.values.length) {
    const c = ipo.constants.values[op2]!;
    if (c.type === ValueType.String) {
      const sig = String(c.value ?? '');
      // `dllname::FunctionName:type:params` → pull the function name.
      const sep = sig.indexOf('::');
      if (sep >= 0) {
        const end = sig.indexOf(':', sep + 2);
        return end >= 0 ? sig.slice(sep + 2, end) : sig.slice(sep + 2);
      }
      return sig;
    }
  }
  return 'dll_call';
}

/** Resolve a screen / menu / state-machine ID to its block name. */
export function resolveScreenName(ipo: IpoFile, index: number): string {
  return ipo.screens.get(index)?.header.name ?? `0x${index.toString(16).padStart(2, '0')}`;
}

export function resolveMenuName(ipo: IpoFile, index: number): string {
  return ipo.menus.get(index)?.header.name ?? `0x${index.toString(16).padStart(2, '0')}`;
}

export function resolveFunctionName(ipo: IpoFile, blockId: number): string {
  return ipo.functions.get(blockId)?.header.name ?? `func_${blockId.toString(16).padStart(2, '0')}`;
}

/** `g_NN` — IPO doesn't preserve original global names. */
export function sourceGlobalName(index: number): string {
  return `g_${index.toString(16).toUpperCase().padStart(2, '0')}`;
}

/**
 * `l_NN` (or the inferred parameter name `p_NN` for the first N
 * locals, where N = argCount). Mirrors how source-mode emits the
 * function signature.
 */
export function sourceLocalName(index: number, paramNames?: readonly string[]): string {
  if (paramNames && index < paramNames.length) return paramNames[index]!;
  return `l_${index.toString(16).toUpperCase().padStart(2, '0')}`;
}

/** Resolve the target of a PUSHR/PUSHREFSTORE for source emission. */
export function resolveStoreTarget(
  ipo: IpoFile,
  op1: number,
  op2: number,
  paramNames?: readonly string[],
): string {
  switch (op1 as Scope) {
    case Scope.Global:
      return sourceGlobalName(op2);
    case Scope.Local:
      return sourceLocalName(op2, paramNames);
    default:
      return `var_${op1.toString(16).padStart(2, '0')}_${op2.toString(16).padStart(2, '0')}`;
  }
}
