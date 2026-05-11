/**
 * user32 string-formatting and case-folding imports.
 *
 * `wvsprintfA` is a positional printf — we delegate to the shared
 * `formatMany` in `@emdzej/inpax-core`. Its signature includes an
 * opaque `t` slot for the vararg list pointer (Win32 va_list), which
 * we can't usefully read in our VM since we don't have raw memory.
 * In practice, the INPA scripts in the wild call it with simple
 * argless format strings — we just substitute literal `%X` specs
 * with empty strings rather than crash. If we hit a real case that
 * needs variadic substitution we'll widen `wvsprintfA` then.
 */

import { formatMany } from '@emdzej/inpax-core';
import type { NativeImportCall } from '@emdzej/inpax-interfaces';
import {
    emptyResults,
    type NativeImportHandler,
} from './index.js';

/**
 * `int wvsprintfA(LPSTR lpOutput, LPCSTR lpFormat, va_list arglist)`
 *
 * Signature observed in INPA: `c.SstL%I`
 *   slot[0]=out buffer (ref)
 *   inputs[1]=format string
 *   inputs[2]=va_list (opaque — we can't dereference)
 *   slot[3]=L (extra out long, semantics unclear)
 *   slot[4]=return (char count)
 *
 * No usable args available → render with empty args list. Scripts
 * that use this in practice (rare; seen once in startus.ipo) pass a
 * format with no `%` specs.
 */
const wvsprintfA: NativeImportHandler = (call) => {
    const format = String(call.inputs[1] ?? '');
    const rendered = formatMany(format, []);
    const out = emptyResults(call);
    let outCursor = 0;
    for (let i = 0; i < call.params.length; i++) {
        if (call.params[i].direction !== 'out') continue;
        if (call.params[i].isReturn) {
            out[i] = rendered.length;
        } else if (outCursor === 0) {
            out[i] = rendered;
            outCursor++;
        } else {
            // The extra out long (`L` slot) — pin to 0 so the script
            // doesn't get a garbage handle.
            out[i] = 0;
            outCursor++;
        }
    }
    return out;
};

/**
 * `LPSTR CharLowerA(LPSTR lpsz)` — case-fold to lower.
 * Signature: `c.s%S` (in string, returns string)
 *
 * Caveat: Win32 CharLowerA folds per the current code page (often
 * 1252 / Latin-1) — German umlauts fold to lowercase forms. We use
 * JS `toLowerCase()` which gives the same answer for the BMP code
 * points BMW scripts care about.
 */
const charLowerA: NativeImportHandler = (call) => {
    const input = String(call.inputs[0] ?? '');
    const lowered = input.toLowerCase();
    const out = emptyResults(call);
    const retIdx = call.params.findIndex((p) => p.isReturn);
    if (retIdx >= 0) out[retIdx] = lowered;
    return out;
};

/** `LPSTR CharUpperA(LPSTR lpsz)` — mirror of `CharLowerA`. */
const charUpperA: NativeImportHandler = (call) => {
    const input = String(call.inputs[0] ?? '');
    const out = emptyResults(call);
    const retIdx = call.params.findIndex((p) => p.isReturn);
    if (retIdx >= 0) out[retIdx] = input.toUpperCase();
    return out;
};

export const stringHandlers: ReadonlyArray<[string, NativeImportHandler]> = [
    ['user32::wvsprintfA', wvsprintfA],
    ['user32::CharLowerA', charLowerA],
    ['user32::CharUpperA', charUpperA],
];
