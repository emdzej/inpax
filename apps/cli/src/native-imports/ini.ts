/**
 * kernel32 INI-file imports — the core of INPA's script-config story.
 *
 * Real INPA reads & writes `INPA.INI`, `EDIABAS.INI`, custom per-script
 * configs (F-key bindings, contact info, ECU selection). We delegate
 * parsing to `@emdzej/inpax-ini-parser` and cache parsed files per
 * absolute path so repeated lookups during a script's main loop don't
 * re-parse the same file every tick.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { parse as parseIni, stringify as stringifyIni, getFirst, type IniFile } from '@emdzej/inpax-ini-parser';
import type { NativeImportCall } from '@emdzej/inpax-interfaces';
import { emptyResults, type HandlerContext, type NativeImportHandler } from './index.js';

function loadIni(absolutePath: string, ctx: HandlerContext): IniFile | null {
    const cached = ctx.iniCache.get(absolutePath);
    if (cached !== undefined) return cached;
    try {
        const content = readFileSync(absolutePath, 'utf-8');
        const parsed = parseIni(content);
        ctx.iniCache.set(absolutePath, parsed);
        return parsed;
    } catch (err) {
        console.warn(
            `[native-imports] failed to load INI ${absolutePath}: ${(err as Error).message}`
        );
        return null;
    }
}

/**
 * Resolve a Windows-style INI path against the user's INPA root.
 * Scripts hard-code paths like `..\CFGDAT\INPA.INI` relative to the
 * EDIABAS bin dir; on the user's macOS / Linux install the layout
 * isn't an exact mirror, so we probe a couple of conventional spots.
 */
function resolveIniPath(rawFileName: string, ctx: HandlerContext): string | null {
    if (!rawFileName) return null;
    const normalised = rawFileName.replace(/\\/g, sep);

    const candidates: string[] = [];
    const root = ctx.cfg.inpaRoot;
    if (root) {
        candidates.push(resolve(root, 'EDIABAS', 'BIN', normalised));
        candidates.push(resolve(root, 'EC-APPS', 'INPA', 'CFGDAT', normalised));
        candidates.push(resolve(root, normalised));
    }
    candidates.push(resolve(normalised));

    for (const candidate of candidates) {
        if (existsSync(candidate)) return candidate;
    }
    return null;
}

/**
 * `DWORD GetPrivateProfileStringA(section, key, default, buffer, size, fileName)`
 *
 * Signature: `c.sssSis%I`
 *   inputs[0]=section  inputs[1]=key  inputs[2]=default
 *   slot[3]=out buffer (ref)
 *   inputs[4]=size      inputs[5]=fileName
 *   slot[6]=return value (char count, ref)
 */
const getPrivateProfileString: NativeImportHandler = (call, ctx) => {
    const section = String(call.inputs[0] ?? '');
    const key = String(call.inputs[1] ?? '');
    const defaultValue = String(call.inputs[2] ?? '');
    const size = Number(call.inputs[4] ?? 0) || 256;
    const fileName = String(call.inputs[5] ?? '');

    const resolvedPath = resolveIniPath(fileName, ctx);
    const ini = resolvedPath ? loadIni(resolvedPath, ctx) : null;
    const looked = ini ? getFirst(ini, section, key) : undefined;
    const value = looked !== undefined ? looked : defaultValue;
    const truncated = value.slice(0, Math.max(0, size - 1));

    const out = emptyResults(call);
    for (let i = 0; i < call.params.length; i++) {
        if (call.params[i].direction !== 'out') continue;
        out[i] = call.params[i].isReturn ? truncated.length : truncated;
    }
    return out;
};

/**
 * `int GetPrivateProfileIntA(section, key, default, fileName)`
 *
 * Signature: `c.ssis%I`
 *   inputs[0]=section  inputs[1]=key  inputs[2]=default (int)
 *   inputs[3]=fileName
 *   slot[4]=return value (int)
 *
 * Win32 semantics: if the INI value can't be parsed as int OR the key
 * doesn't exist, return `default`. Leading whitespace and a `+`/`-`
 * sign are allowed; trailing garbage stops parsing.
 */
const getPrivateProfileInt: NativeImportHandler = (call, ctx) => {
    const section = String(call.inputs[0] ?? '');
    const key = String(call.inputs[1] ?? '');
    const defaultValue = Number(call.inputs[2] ?? 0);
    const fileName = String(call.inputs[3] ?? '');

    const resolvedPath = resolveIniPath(fileName, ctx);
    const ini = resolvedPath ? loadIni(resolvedPath, ctx) : null;
    const raw = ini ? getFirst(ini, section, key) : undefined;

    let value = defaultValue;
    if (raw !== undefined) {
        const parsed = parseInt(raw.trim(), 10);
        if (!Number.isNaN(parsed)) value = parsed;
    }

    const out = emptyResults(call);
    const retIdx = call.params.findIndex((p) => p.isReturn);
    if (retIdx >= 0) out[retIdx] = value;
    return out;
};

/**
 * `BOOL WritePrivateProfileStringA(section, key, value, fileName)`
 *
 * Signature: `c.ssss%I`
 *
 * Mutates the file on disk. We rewrite the section atomically via
 * `parseIni → mutate → stringify → writeFileSync` so partial corruption
 * is unlikely. INI cache for that path is invalidated so the next read
 * sees the new value.
 */
const writePrivateProfileString: NativeImportHandler = (call, ctx) => {
    const section = String(call.inputs[0] ?? '');
    const key = String(call.inputs[1] ?? '');
    const value = String(call.inputs[2] ?? '');
    const fileName = String(call.inputs[3] ?? '');

    const resolvedPath = resolveIniPath(fileName, ctx) ?? resolve(fileName.replace(/\\/g, sep));

    let ini: IniFile;
    try {
        ini = existsSync(resolvedPath)
            ? parseIni(readFileSync(resolvedPath, 'utf-8'))
            : {};
        if (!ini[section]) ini[section] = {};
        ini[section][key] = value;
        writeFileSync(resolvedPath, stringifyIni(ini), 'utf-8');
        ctx.iniCache.delete(resolvedPath);
    } catch (err) {
        console.warn(
            `[native-imports] WritePrivateProfileStringA failed for ${resolvedPath}: ${(err as Error).message}`
        );
        const out = emptyResults(call);
        const retIdx = call.params.findIndex((p) => p.isReturn);
        if (retIdx >= 0) out[retIdx] = 0; // BOOL FALSE
        return out;
    }

    const out = emptyResults(call);
    const retIdx = call.params.findIndex((p) => p.isReturn);
    if (retIdx >= 0) out[retIdx] = 1; // BOOL TRUE
    return out;
};

export const iniHandlers: ReadonlyArray<[string, NativeImportHandler]> = [
    ['kernel32::GetPrivateProfileStringA', getPrivateProfileString],
    ['kernel32::GetPrivateProfileIntA', getPrivateProfileInt],
    ['kernel32::WritePrivateProfileStringA', writePrivateProfileString],
];
