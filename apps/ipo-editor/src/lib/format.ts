import { ValueType } from '@emdzej/inpax-core';
import type { ConstValue } from './walker.js';

export function typeLabel(type: ValueType): string {
  switch (type) {
    case ValueType.Void: return 'void';
    case ValueType.Bool: return 'bool';
    case ValueType.Byte: return 'byte';
    case ValueType.Int: return 'int';
    case ValueType.Long: return 'long';
    case ValueType.Real: return 'real';
    case ValueType.String: return 'string';
    case ValueType.Handle1: return 'h1';
    case ValueType.Handle2: return 'h2';
    case ValueType.Handle3: return 'h3';
    default: return '?';
  }
}

export function formatValue(type: ValueType, value: ConstValue): string {
  switch (type) {
    case ValueType.String:
      return JSON.stringify(value as string);
    case ValueType.Bool:
      return (value as boolean) ? 'true' : 'false';
    case ValueType.Real:
      return Number(value).toString();
    default:
      return String(value);
  }
}

export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  if (max <= 1) return s.slice(0, max);
  return s.slice(0, max - 1) + '…';
}

/**
 * Cheap "looks like an FFI descriptor" check. Real values look like
 * `DLL::Function:c.sssSis%I` — two colons, a dot, and a `%`. We use
 * the heuristic to flag constants the editor refuses to touch unless
 * `--allow-ffi`.
 */
export function looksLikeFfiDescriptor(value: ConstValue): boolean {
  if (typeof value !== 'string') return false;
  return value.includes('::') && /:[a-z]\./i.test(value) && value.includes('%');
}
