/**
 * kernel32 system / process info imports.
 *
 * Most of these just surface Node's view of the host (cwd, env vars,
 * tick count) through the Win32 signature INPA scripts expect. A few —
 * `SetCurrentDirectoryA`, `GetWindowsDirectoryA`, `GetCommandLineA` —
 * we virtualise so a script can't make decisions that depend on living
 * on a Windows install. The virtualisation is per-session and held in
 * `ctx.ediabasOverrides` (re-used as a generic kv store).
 */

import { hostname } from 'node:os';
import type { NativeImportCall } from '@emdzej/inpax-interfaces';
import {
    emptyResults,
    type HandlerContext,
    type NativeImportHandler,
} from './index.js';

/** Virtualised cwd / windows-dir keys, kept in ediabasOverrides so we
 *  share one mutable kv store with __apiSetConfig. */
const KEY_CWD = '__SYSTEM_CWD__';

function writeOut(call: NativeImportCall, value: string, size: number): unknown[] {
    const truncated = value.slice(0, Math.max(0, size - 1));
    const out = emptyResults(call);
    for (let i = 0; i < call.params.length; i++) {
        if (call.params[i].direction !== 'out') continue;
        out[i] = call.params[i].isReturn ? truncated.length : truncated;
    }
    return out;
}

/**
 * `DWORD GetTickCount(void)` — milliseconds since system start.
 * Signature: `c.%L`
 *
 * Real Win32 wraps at 32 bits (~49.7 days). We mirror that so script
 * arithmetic that subtracts two readings behaves like INPA expects.
 */
const getTickCount: NativeImportHandler = (call) => {
    const out = emptyResults(call);
    const retIdx = call.params.findIndex((p) => p.isReturn);
    if (retIdx >= 0) out[retIdx] = Date.now() & 0xffffffff;
    return out;
};

/**
 * `DWORD GetCurrentDirectoryA(DWORD nBufferLength, LPSTR lpBuffer)`
 * Signature: `c.lS%I` or `c.LS%I`
 *
 * We prefer a virtualised cwd (set by `SetCurrentDirectoryA`) so a
 * script that does `SetCwd → relative-fileop → SetCwd back` works
 * without us actually `process.chdir`-ing.
 */
const getCurrentDirectory: NativeImportHandler = (call, ctx) => {
    const size = Number(call.inputs[0] ?? 0) || 260;
    const cwd = ctx.ediabasOverrides.get(KEY_CWD) ?? process.cwd();
    return writeOut(call, cwd, size);
};

/**
 * `BOOL SetCurrentDirectoryA(LPCSTR lpPathName)`
 * Signature: `c.s%I`
 *
 * Stored virtually — we DO NOT `process.chdir` because that affects
 * every other concurrent operation in the same Node process.
 */
const setCurrentDirectory: NativeImportHandler = (call, ctx) => {
    const value = String(call.inputs[0] ?? '');
    if (value) ctx.ediabasOverrides.set(KEY_CWD, value);
    const out = emptyResults(call);
    const retIdx = call.params.findIndex((p) => p.isReturn);
    if (retIdx >= 0) out[retIdx] = 1;
    return out;
};

/**
 * `UINT GetWindowsDirectoryA(LPSTR lpBuffer, UINT uSize)`
 * Signature: `c.Si%I`
 *
 * Returns a synthetic `C:\WINDOWS`. Scripts that use this only ever
 * pass the result into `GetPrivateProfileStringA(..., "WIN.INI")` or
 * similar — none of which exist on the user's filesystem, so the
 * lookup falls back to the default value the script provided.
 */
const getWindowsDirectory: NativeImportHandler = (call) => {
    const size = Number(call.inputs[1] ?? 0) || 260;
    return writeOut(call, 'C:\\WINDOWS', size);
};

/**
 * `DWORD GetEnvironmentVariableA(LPCSTR lpName, LPSTR lpBuffer, DWORD nSize)`
 * Signature: `c.sSi%I`
 *
 * Direct passthrough to Node `process.env`. The default (when env var
 * is unset) is an empty string — same as Win32 returning 0 chars.
 */
const getEnvironmentVariable: NativeImportHandler = (call) => {
    const name = String(call.inputs[0] ?? '');
    const size = Number(call.inputs[2] ?? 0) || 32768;
    const value = name ? process.env[name] ?? '' : '';
    return writeOut(call, value, size);
};

/**
 * `LPCSTR GetCommandLineA(void)` — the original C string for the
 * process command line.
 * Signature: `c.%S`
 *
 * We synthesise something INPA-shaped (`INPA.EXE`) rather than
 * leaking node's argv. Scripts only use it for cosmetic logging.
 */
const getCommandLine: NativeImportHandler = (call) => {
    const out = emptyResults(call);
    const retIdx = call.params.findIndex((p) => p.isReturn);
    if (retIdx >= 0) out[retIdx] = 'INPA.EXE';
    return out;
};

/**
 * `BOOL GetComputerNameA(LPSTR lpBuffer, LPDWORD nSize)`
 * Signature: `c.SL%L`
 *
 * Returns `os.hostname()`, truncated to the buffer size. The second
 * out arg is the actual byte count written (Win32 has it as an
 * inout pointer; we treat it as out-only).
 */
const getComputerName: NativeImportHandler = (call) => {
    const name = hostname();
    const size = 256;
    const truncated = name.slice(0, size);
    const out = emptyResults(call);
    let outIdx = 0;
    for (let i = 0; i < call.params.length; i++) {
        if (call.params[i].direction !== 'out') continue;
        if (call.params[i].isReturn) out[i] = 1;
        else if (outIdx === 0) {
            out[i] = truncated;
            outIdx++;
        } else {
            out[i] = truncated.length;
            outIdx++;
        }
    }
    return out;
};

export const systemHandlers: ReadonlyArray<[string, NativeImportHandler]> = [
    ['kernel32::GetTickCount', getTickCount],
    ['kernel32::GetCurrentDirectoryA', getCurrentDirectory],
    ['kernel32::SetCurrentDirectoryA', setCurrentDirectory],
    ['kernel32::GetWindowsDirectoryA', getWindowsDirectory],
    ['kernel32::GetEnvironmentVariableA', getEnvironmentVariable],
    ['kernel32::GetCommandLineA', getCommandLine],
    ['kernel32::GetComputerNameA', getComputerName],
];
