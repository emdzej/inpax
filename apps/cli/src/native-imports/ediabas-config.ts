/**
 * api32.DLL — EDIABAS configuration plumbing.
 *
 * `__apiGetConfig(hApi, key, outBuf)` and `__apiSetConfig(hApi, key, value)`
 * read/write a small in-process key-value config (the same one Windows
 * EDIABAS persists in `EDIABAS.INI`). Real INPA scripts use it for a
 * handful of well-known keys — APITRACE, IFHTRACE, ECUPATH, INTERFACE,
 * EDIABASINIPATH. We answer with values derived from our ediabasx
 * config so scripts can introspect their own runtime, and store any
 * `Set` calls in a per-session overrides map so a subsequent `Get`
 * sees what was written.
 */

import type { NativeImportCall } from '@emdzej/inpax-interfaces';
import {
    emptyResults,
    type HandlerContext,
    type NativeImportHandler,
} from './index.js';

function lookupKnown(key: string, cfg: HandlerContext['cfg']): string | undefined {
    switch (key.toUpperCase()) {
        case 'ECUPATH':
            return cfg.ediabasConfig?.ecuPath;
        case 'INTERFACE':
            return cfg.ediabasConfig?.interfaceName;
        case 'EDIABASINIPATH':
            return cfg.ediabasConfig?.iniPath;
        // Trace levels — real EDIABAS only enables IFH/API trace when
        // these are non-zero. Scripts read them to decide whether to
        // emit verbose diagnostics. We don't generate trace files, so
        // reporting "0" is honest.
        case 'APITRACE':
        case 'IFHTRACE':
            return '0';
        default:
            return undefined;
    }
}

/**
 * `int __apiGetConfig(long hApi, char *key, char *outValue)`
 *
 * Signature: `c.lsS%I`
 *   inputs[0]=hApi (ignored — we have one EDIABAS instance)
 *   inputs[1]=key
 *   slot[2]=out value (ref)
 *   slot[3]=return (int — bool/length depending on script)
 */
const apiGetConfig: NativeImportHandler = (call, ctx) => {
    const key = String(call.inputs[1] ?? '');
    const overridden = ctx.ediabasOverrides.get(key.toUpperCase());
    const value = overridden !== undefined ? overridden : lookupKnown(key, ctx.cfg) ?? '';

    const out = emptyResults(call);
    for (let i = 0; i < call.params.length; i++) {
        if (call.params[i].direction !== 'out') continue;
        out[i] = call.params[i].isReturn ? 1 : value; // 1 = success
    }
    return out;
};

/**
 * `int __apiSetConfig(long hApi, char *key, char *value)`
 *
 * Signature: `c.lss%I`
 *
 * Persists in the per-session overrides map; subsequent `__apiGetConfig`
 * with the same key returns what was set. Doesn't touch any file on
 * disk — INPA scripts that call `apiSetConfig("APITRACE", "0")` etc.
 * just want to gate diagnostic side-effects, not persist state.
 */
const apiSetConfig: NativeImportHandler = (call, ctx) => {
    const key = String(call.inputs[1] ?? '');
    const value = String(call.inputs[2] ?? '');
    if (key) ctx.ediabasOverrides.set(key.toUpperCase(), value);

    const out = emptyResults(call);
    const retIdx = call.params.findIndex((p) => p.isReturn);
    if (retIdx >= 0) out[retIdx] = 1; // success
    return out;
};

export const ediabasConfigHandlers: ReadonlyArray<[string, NativeImportHandler]> = [
    ['api32.DLL::__apiGetConfig', apiGetConfig],
    ['api32.DLL::__apiSetConfig', apiSetConfig],
];
