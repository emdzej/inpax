/**
 * Node-side handler for BEST2 CALLE imports.
 *
 * Each Win32 DLL gets its own module (`ini.ts`, `system.ts`, etc.); this
 * file owns dispatch — match by import name, delegate to the matching
 * handler. Unknown imports are logged once per name (so the dev sees
 * which DLL surface a script needs) and return undefined for every out
 * slot so the script can keep running with its script-side defaults.
 */

import type {
    INativeImportProvider,
    NativeImportCall,
} from '@emdzej/inpax-interfaces';
import { iniHandlers } from './ini.js';
import { ediabasConfigHandlers } from './ediabas-config.js';
import { systemHandlers } from './system.js';
import { stringHandlers } from './strings.js';

export interface NodeNativeImportConfig {
    /**
     * Filesystem root used to resolve Windows-style relative paths.
     * Typically the dir that contains `EDIABAS/` and `EC-APPS/`. The
     * CLI derives this from the IPO file's location.
     */
    inpaRoot?: string;
    /** Static EDIABAS config exposed to `__apiGetConfig` lookups. */
    ediabasConfig?: Partial<EdiabasConfigSnapshot>;
}

export interface EdiabasConfigSnapshot {
    /** ECU directory (real EDIABAS calls it ECUPATH). */
    ecuPath: string;
    /** Interface name — "STD:OBD", "STD:OMITEC", "kdcan", … */
    interfaceName: string;
    /** Path to the EDIABAS.INI / similar config file. */
    iniPath: string;
}

export type NativeImportHandler = (call: NativeImportCall, ctx: HandlerContext) => unknown[];

export interface HandlerContext {
    cfg: NodeNativeImportConfig;
    iniCache: Map<string, ReturnType<typeof import('@emdzej/inpax-ini-parser').parse>>;
    /** Runtime-mutable EDIABAS config (set by __apiSetConfig, read by __apiGetConfig). */
    ediabasOverrides: Map<string, string>;
}

export class NodeNativeImportProvider implements INativeImportProvider {
    private readonly handlers: Map<string, NativeImportHandler>;
    private readonly ctx: HandlerContext;
    private readonly warned = new Set<string>();

    constructor(cfg: NodeNativeImportConfig = {}) {
        this.ctx = {
            cfg,
            iniCache: new Map(),
            ediabasOverrides: new Map(),
        };
        this.handlers = new Map([
            ...iniHandlers,
            ...ediabasConfigHandlers,
            ...systemHandlers,
            ...stringHandlers,
        ]);
    }

    call(invocation: NativeImportCall): unknown[] {
        const handler = this.handlers.get(invocation.importName);
        if (handler) {
            try {
                return handler(invocation, this.ctx);
            } catch (err) {
                console.warn(
                    `[native-imports] ${invocation.importName} threw: ${(err as Error).message}`
                );
                return invocation.params.map(() => undefined);
            }
        }
        if (!this.warned.has(invocation.importName) && invocation.importName !== '') {
            this.warned.add(invocation.importName);
            console.warn(
                `[native-imports] no handler: ${invocation.importName} — out-args left untouched (logged once)`
            );
        }
        return invocation.params.map(() => undefined);
    }
}

/**
 * Convenience: build a results array of the same shape as
 * `call.params`, populated with `undefined` except where the handler
 * explicitly wrote a value. Out-args that stay `undefined` leave the
 * script's pre-call buffer in place.
 */
export function emptyResults(call: NativeImportCall): unknown[] {
    return call.params.map(() => undefined);
}

/**
 * Locate the index of the return-value slot in a parsed param list.
 * INPA's CALLE signatures place `%X` last; we find it explicitly
 * rather than assuming position so off-by-one bugs are obvious.
 */
export function returnIndex(call: NativeImportCall): number {
    return call.params.findIndex((p) => p.isReturn);
}

/**
 * Out-arg slot indexes (in declaration order, skipping the return).
 */
export function outIndexes(call: NativeImportCall): number[] {
    const result: number[] = [];
    for (let i = 0; i < call.params.length; i++) {
        if (call.params[i].direction === 'out' && !call.params[i].isReturn) {
            result.push(i);
        }
    }
    return result;
}
