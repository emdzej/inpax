/**
 * System Function Signature Parser and Argument Handler
 */

import { SystemFunctionMap, ValueType, StackEntry, Scope } from '@emdzej/inpax-core';
import type { Stack } from '../vm/stack.js';
import type { ExecutionContext } from '../vm/execution-context.js';

export type ParamDirection = 'in' | 'out' | 'inout';

export interface ParsedParam {
    direction: ParamDirection;
    type: string;
    name: string;
}

export interface ParsedSignature {
    params: ParsedParam[];
    isVariadic: boolean;
}

/** Parse signature string like "(in: string title, out: int result)" */
export function parseSignature(signature: string): ParsedSignature {
    const params: ParsedParam[] = [];

    // Handle empty or variadic
    if (signature === '()') return { params, isVariadic: false };
    if (signature === '(...)') return { params, isVariadic: true };

    // Extract inner part
    const inner = signature.slice(1, -1).trim();
    if (!inner) return { params, isVariadic: false };

    // Check for variadic at end
    const isVariadic = inner.endsWith('...');
    const paramStr = isVariadic ? inner.replace(/,?\s*\.\.\.$/, '') : inner;

    // Split by comma (careful with nested stuff, but signatures don't have that)
    const parts = paramStr.split(',').map(p => p.trim()).filter(p => p);

    for (const part of parts) {
        // Format: "direction: type name"
        const match = part.match(/^(in|out|inout):\s*(\w+)\s+(\w+)$/);
        if (match) {
            params.push({
                direction: match[1] as ParamDirection,
                type: match[2],
                name: match[3],
            });
        }
    }

    return { params, isVariadic };
}

/** Get signature info for a system function */
export function getSignature(funcId: number): ParsedSignature | null {
    const info = SystemFunctionMap.get(funcId);
    if (!info) return null;
    return parseSignature(info.signature);
}

/** Convert INPA type name to ValueType */
function inpaTypeToValueType(typeName: string): ValueType {
    switch (typeName.toLowerCase()) {
        case 'bool': return ValueType.Bool;
        case 'byte': return ValueType.Byte;
        case 'int': return ValueType.Int;
        case 'long': return ValueType.Long;
        case 'real': return ValueType.Real;
        case 'string': return ValueType.String;
        case 'menu':
        case 'screen':
        case 'statemachine':
        case 'state':
            return ValueType.Handle1;
        default:
            return ValueType.Int; // fallback
    }
}

/** Extract JS value from stack entry */
function extractValue(entry: StackEntry): unknown {
    return entry.value;
}

export interface CollectedArgs {
    /** Input values for provider call (in order of signature) */
    inputs: unknown[];
    /** Output references to write back to (in order of signature) */
    outRefs: StackEntry[];
    /** Param info for each out ref */
    outParams: ParsedParam[];
}

/**
 * Collect arguments from stack based on function signature.
 * Stack has args pushed in signature order, so we pop in reverse.
 */
export function collectArguments(
    funcId: number,
    stack: Stack
): CollectedArgs {
    const sig = getSignature(funcId);
    if (!sig) {
        return { inputs: [], outRefs: [], outParams: [] };
    }

    const inputs: unknown[] = [];
    const outRefs: StackEntry[] = [];
    const outParams: ParsedParam[] = [];

    // Pop in reverse order (last param first)
    const popped: Array<{ entry: StackEntry; param: ParsedParam }> = [];

    for (let i = sig.params.length - 1; i >= 0; i--) {
        const param = sig.params[i];
        const entry = stack.pop();
        popped.unshift({ entry, param }); // restore order
    }

    // Now process in signature order
    for (const { entry, param } of popped) {
        if (param.direction === 'in') {
            inputs.push(extractValue(entry));
        } else if (param.direction === 'out') {
            outRefs.push(entry); // This is a reference
            outParams.push(param);
        } else if (param.direction === 'inout') {
            // For inout, we need both the value AND the reference
            inputs.push(extractValue(entry));
            outRefs.push(entry);
            outParams.push(param);
        }
    }

    return { inputs, outRefs, outParams };
}

/**
 * Write return values back to out parameters.
 * Provider returns values in same order as out params in signature.
 */
export function writeOutParams(
    outRefs: StackEntry[],
    outParams: ParsedParam[],
    values: unknown[],
    ctx: ExecutionContext
): void {
    for (let i = 0; i < outRefs.length && i < values.length; i++) {
        const ref = outRefs[i];
        const param = outParams[i];
        const value = values[i];

        if (!ref.refInfo) {
            console.warn(`Expected reference for out param ${param.name}`);
            continue;
        }

        const { scope, index } = ref.refInfo;
        const valueType = inpaTypeToValueType(param.type);

        const newEntry: StackEntry = {
            type: valueType,
            flags: 1,
            value: value as StackEntry['value'],
        };

        ctx.setVariable(scope as Scope, index, newEntry);
    }
}
