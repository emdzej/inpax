/**
 * Mapping between the binary `ValueType` enum (which appears as one
 * byte in the IPO's constant section) and the readable `ConstantType`
 * strings the patch YAML uses (`"string"`, `"int"`, …).
 *
 * Keeping this in one place means the patch format stays
 * human-friendly without forcing callers to memorise the byte codes.
 */

import { ValueType } from '@emdzej/inpax-core';
import type { ConstantType } from './types.js';

const FROM_VALUE_TYPE: ReadonlyMap<ValueType, ConstantType> = new Map([
  [ValueType.Bool, 'bool'],
  [ValueType.Byte, 'byte'],
  [ValueType.Int, 'int'],
  [ValueType.Long, 'long'],
  [ValueType.Real, 'real'],
  [ValueType.String, 'string'],
]);

const TO_VALUE_TYPE: ReadonlyMap<ConstantType, ValueType> = new Map(
  Array.from(FROM_VALUE_TYPE.entries()).map(([k, v]) => [v, k]),
);

/**
 * Convert a parser-emitted `ValueType` byte code into the readable
 * string we store in patches. Returns `undefined` for value types we
 * intentionally don't expose to patches (handles, void) — patch init
 * filters those out, patch apply rejects them at validation time.
 */
export function constantTypeFor(vt: ValueType): ConstantType | undefined {
  return FROM_VALUE_TYPE.get(vt);
}

/** Inverse — used during apply to validate the patch entry's declared
 *  type against the IPO's actual byte code at that index. */
export function valueTypeFor(ct: ConstantType): ValueType | undefined {
  return TO_VALUE_TYPE.get(ct);
}
