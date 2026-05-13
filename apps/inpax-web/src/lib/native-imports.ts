/**
 * Browser-side INativeImportProvider — handles the BEST2 CALLE
 * imports that inpax scripts use, reading via FileSystemDirectoryHandle
 * instead of `node:fs`.
 *
 * Mirrors `apps/cli/src/native-imports/*` per DLL family (INI,
 * config, system, strings, file). Browser-specific adaptations:
 *
 *   - `prefetchIniFiles()` populates the INI cache up-front since the
 *     interpreter dispatches CALLE synchronously and we have no
 *     `readFileSync` equivalent in the browser.
 *   - `kernel32` "system" calls return synthetic values (cwd = "/",
 *     `Windows` = "C:\\WINDOWS", env vars = "") so scripts that decide
 *     branches on them keep going.
 *   - `kernel32::OpenFile` is a stub — startus.ipo invokes it but only
 *     to test for existence; we always return success with a synthetic
 *     handle and rely on the script's own error path for content reads.
 *
 * Unknown imports fall through to a warn-once log so the dev sees
 * which DLL surface a new script needs without breaking execution —
 * the script's pre-call buffers stay in place.
 */

import { formatMany } from "@emdzej/inpax-core";
import { parse as parseIni, getFirst, type IniFile } from "@emdzej/inpax-ini-parser";
import type {
  INativeImportProvider,
  NativeImportCall,
} from "@emdzej/inpax-interfaces";
import type { InpaInstall } from "./inpa-install.js";

export interface BrowserNativeImportConfig {
  install: InpaInstall;
  ediabasConfig?: {
    ecuPath: string;
    interfaceName: string;
    iniPath: string;
  };
}

// Synthetic Windows fallbacks. INPA scripts mostly use these as
// arguments to follow-up file reads — anything we don't have on
// disk falls through to the script's default.
const SYNTHETIC_WINDOWS_DIR = "C:\\WINDOWS";
const SYNTHETIC_COMPUTER_NAME = "INPAX-WEB";

type HandlerCtx = {
  cfg: BrowserNativeImportConfig;
  iniCache: Map<string, IniFile | null>;
  ediabasOverrides: Map<string, string>;
  virtualCwd: string;
};

type Handler = (call: NativeImportCall, ctx: HandlerCtx) => unknown[];

/**
 * `[inpax-web/native-imports]`-prefixed `console.warn` helper. Used
 * for genuine warnings (missing CFGDAT, INI parse failures, unknown
 * CALLE targets); routine per-call traces are not logged to keep the
 * DevTools console signal-to-noise high for normal runs.
 */
const LOG_PREFIX = "[inpax-web/native-imports]";
const logWarn = (msg: string, data?: unknown) =>
  data !== undefined ? console.warn(LOG_PREFIX, msg, data) : console.warn(LOG_PREFIX, msg);

export class BrowserNativeImportProvider implements INativeImportProvider {
  private readonly ctx: HandlerCtx;
  private readonly handlers: Map<string, Handler>;
  private readonly warned = new Set<string>();

  constructor(cfg: BrowserNativeImportConfig) {
    this.ctx = {
      cfg,
      iniCache: new Map(),
      ediabasOverrides: new Map(),
      virtualCwd: "C:\\EDIABAS\\BIN",
    };
    this.handlers = new Map<string, Handler>([
      ...INI_HANDLERS,
      ...CONFIG_HANDLERS,
      ...SYSTEM_HANDLERS,
      ...STRING_HANDLERS,
      ...FILE_HANDLERS,
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
        return emptyResults(invocation);
      }
    }
    if (invocation.importName && !this.warned.has(invocation.importName)) {
      this.warned.add(invocation.importName);
      logWarn(`no handler: ${invocation.importName} — out-args left untouched (logged once)`);
    }
    return emptyResults(invocation);
  }

  /**
   * Eagerly load the standard INPA INI files (INPA.INI in CFGDAT,
   * EDIABAS.INI in Bin) before the VM starts. Called by the runtime
   * builder during setup; populates the cache that synchronous
   * `lookupIni` calls hit.
   *
   * Browser handles are async-only — there's no `readFileSync`-shaped
   * surface — so we can't service `GetPrivateProfileStringA` (a
   * synchronous interpreter callback) lazily. Pre-loading the few
   * files INPA actually reads sidesteps that.
   */
  async prefetchIniFiles(): Promise<void> {
    const { install } = this.ctx.cfg;
    const tasks: Array<Promise<void>> = [];
    if (install.cfgdat) {
      tasks.push(this.cacheIniFile(install.cfgdat, "INPA.INI", "..\\CFGDAT\\INPA.INI"));
    } else {
      logWarn("no CFGDAT directory — INPA.INI will not be loaded");
    }
    if (install.ediabasBin) {
      tasks.push(this.cacheIniFile(install.ediabasBin, "EDIABAS.INI", "EDIABAS.INI"));
    } else {
      logWarn("no EDIABAS/Bin directory — EDIABAS.INI will not be loaded");
    }
    await Promise.all(tasks);
  }

  private async cacheIniFile(
    dir: FileSystemDirectoryHandle,
    filename: string,
    keyAlias: string
  ): Promise<void> {
    try {
      const handle = await findCaseInsensitive(dir, filename);
      if (!handle) {
        // Surface the alphabetical neighbourhood + the .ini siblings
        // so the user can tell at a glance whether the file is
        // genuinely missing (no near match in either pool) or just
        // case-mismatched in a way our compare didn't catch. We
        // can't list the whole dir — real installs have hundreds of
        // entries and the warning would flood the console.
        const neighbourhood = await listDirNeighbourhood(dir, filename);
        logWarn(
          `${filename} not found in ${dir.name}/ — ` +
            `nearby: ${neighbourhood.nearby.join(", ") || "(none)"}; ` +
            `INI files: ${neighbourhood.iniFiles.join(", ") || "(none)"} ` +
            `(${neighbourhood.totalEntries} entries total)`
        );
        return;
      }
      const file = await handle.getFile();
      const content = await file.text();
      const parsed = parseIni(content);
      // Store under every reasonable lookup form: bare basename, the
      // INPA-style relative alias, AND the basename's stripped path.
      // Script call sites use mixed conventions (`..\CFGDAT\INPA.INI`
      // vs `INPA.INI` vs absolute paths once they've been through
      // GetWindowsDirectoryA), and the dispatcher fires synchronously
      // so we can't do an async lookup at call time.
      const baseKey = filename.toLowerCase();
      const aliasKey = keyAlias.replace(/\\/g, "/").toLowerCase();
      this.ctx.iniCache.set(baseKey, parsed);
      this.ctx.iniCache.set(aliasKey, parsed);
    } catch (err) {
      logWarn(`failed to cache ${filename}`, (err as Error).message);
    }
  }
}

/**
 * Snapshot enough of `dir`'s contents to diagnose a missing-file
 * warning without dumping the whole directory. Returns three slices,
 * each keeping the on-disk casing of every name so a case-mismatched
 * file would be obvious:
 *
 *   - `nearby`   — files whose lowercase name starts with the same
 *                  first three chars as the target, capped at 10.
 *                  Catches "the file is right there with a typo".
 *   - `iniFiles` — every `.ini` file in the directory (capped at 10).
 *                  Catches "we're looking for the wrong filename
 *                  entirely" (e.g. `INPA_DEFAULT.INI`).
 *   - `totalEntries` — full entry count so the user knows whether
 *                  the directory was empty / large.
 *
 * Walks `entries()` exactly once.
 */
async function listDirNeighbourhood(
  dir: FileSystemDirectoryHandle,
  target: string
): Promise<{ nearby: string[]; iniFiles: string[]; totalEntries: number }> {
  const prefix = target.toLowerCase().slice(0, 3);
  const nearby: string[] = [];
  const iniFiles: string[] = [];
  let totalEntries = 0;
  for await (const [name, entry] of dir.entries()) {
    totalEntries++;
    const display = entry.kind === "directory" ? `${name}/` : name;
    const lower = name.toLowerCase();
    if (lower.startsWith(prefix) && nearby.length < 10) {
      nearby.push(display);
    }
    if (entry.kind === "file" && lower.endsWith(".ini") && iniFiles.length < 10) {
      iniFiles.push(display);
    }
  }
  const sortAsc = (a: string, b: string) =>
    a.toLowerCase().localeCompare(b.toLowerCase());
  nearby.sort(sortAsc);
  iniFiles.sort(sortAsc);
  return { nearby, iniFiles, totalEntries };
}

function emptyResults(call: NativeImportCall): unknown[] {
  return call.params.map(() => undefined);
}

function returnIndex(call: NativeImportCall): number {
  return call.params.findIndex((p) => p.isReturn);
}

/**
 * Write a string into the first non-return out slot and the return
 * slot (as char count). Shape used by Win32 string-out APIs:
 * `GetPrivateProfileStringA`, `GetCurrentDirectoryA`, etc.
 */
function writeStringOut(call: NativeImportCall, value: string, size: number): unknown[] {
  const truncated = value.slice(0, Math.max(0, size - 1));
  const out = emptyResults(call);
  for (let i = 0; i < call.params.length; i++) {
    if (call.params[i].direction !== "out") continue;
    out[i] = call.params[i].isReturn ? truncated.length : truncated;
  }
  return out;
}

function lookupIni(rawFileName: string, ctx: HandlerCtx): IniFile | null {
  if (!rawFileName) return null;
  const normalised = rawFileName.replace(/\\/g, "/").toLowerCase();
  // Direct hit on the cached key (full relative path or basename).
  const direct = ctx.iniCache.get(normalised);
  if (direct !== undefined) return direct;
  // Fallback: try the basename — scripts sometimes pass an absolute
  // Windows path (`C:\EDIABAS\BIN\EDIABAS.INI`) for the same file
  // we cached under `EDIABAS.INI`.
  const base = normalised.split("/").pop() ?? "";
  return ctx.iniCache.get(base) ?? null;
}

// ============================================================
// INI — kernel32 profile reads
// ============================================================

const getPrivateProfileString: Handler = (call, ctx) => {
  const section = String(call.inputs[0] ?? "");
  const key = String(call.inputs[1] ?? "");
  const defaultValue = String(call.inputs[2] ?? "");
  const size = Number(call.inputs[4] ?? 0) || 256;
  const fileName = String(call.inputs[5] ?? "");

  const ini = lookupIni(fileName, ctx);
  const looked = ini ? getFirst(ini, section, key) : undefined;
  const value = looked !== undefined ? looked : defaultValue;
  return writeStringOut(call, value, size);
};

const getPrivateProfileInt: Handler = (call, ctx) => {
  const section = String(call.inputs[0] ?? "");
  const key = String(call.inputs[1] ?? "");
  const defaultValue = Number(call.inputs[2] ?? 0);
  const fileName = String(call.inputs[3] ?? "");

  const ini = lookupIni(fileName, ctx);
  const raw = ini ? getFirst(ini, section, key) : undefined;
  let value = defaultValue;
  if (raw !== undefined) {
    const parsed = parseInt(raw.trim(), 10);
    if (!Number.isNaN(parsed)) value = parsed;
  }

  const out = emptyResults(call);
  const retIdx = returnIndex(call);
  if (retIdx >= 0) out[retIdx] = value;
  return out;
};

const INI_HANDLERS: Array<[string, Handler]> = [
  ["kernel32::GetPrivateProfileStringA", getPrivateProfileString],
  ["kernel32::GetPrivateProfileIntA", getPrivateProfileInt],
];

// ============================================================
// EDIABAS config — api32.DLL key/value
// ============================================================

function lookupEdiabasKey(key: string, cfg: BrowserNativeImportConfig["ediabasConfig"]): string | undefined {
  switch (key.toUpperCase()) {
    case "ECUPATH":
      return cfg?.ecuPath;
    case "INTERFACE":
      return cfg?.interfaceName;
    case "EDIABASINIPATH":
      return cfg?.iniPath;
    case "APITRACE":
    case "IFHTRACE":
      return "0";
    default:
      return undefined;
  }
}

const apiGetConfig: Handler = (call, ctx) => {
  const key = String(call.inputs[1] ?? "");
  const overridden = ctx.ediabasOverrides.get(key.toUpperCase());
  const value =
    overridden !== undefined ? overridden : lookupEdiabasKey(key, ctx.cfg.ediabasConfig) ?? "";

  const out = emptyResults(call);
  for (let i = 0; i < call.params.length; i++) {
    if (call.params[i].direction !== "out") continue;
    out[i] = call.params[i].isReturn ? 1 : value; // 1 = success
  }
  return out;
};

const apiSetConfig: Handler = (call, ctx) => {
  const key = String(call.inputs[1] ?? "");
  const value = String(call.inputs[2] ?? "");
  if (key) ctx.ediabasOverrides.set(key.toUpperCase(), value);

  const out = emptyResults(call);
  const retIdx = returnIndex(call);
  if (retIdx >= 0) out[retIdx] = 1;
  return out;
};

const CONFIG_HANDLERS: Array<[string, Handler]> = [
  ["api32.DLL::__apiGetConfig", apiGetConfig],
  ["api32.DLL::__apiSetConfig", apiSetConfig],
];

// ============================================================
// System — kernel32 process/host info
// ============================================================

/**
 * `DWORD GetTickCount(void)` — milliseconds since system start, wrapped
 * at 32 bits to mirror Win32. Scripts subtract two readings to measure
 * elapsed time; the actual wall-clock origin doesn't matter.
 */
const getTickCount: Handler = (call) => {
  const out = emptyResults(call);
  const retIdx = returnIndex(call);
  if (retIdx >= 0) out[retIdx] = Date.now() & 0xffffffff;
  return out;
};

const getCurrentDirectory: Handler = (call, ctx) => {
  const size = Number(call.inputs[0] ?? 0) || 260;
  return writeStringOut(call, ctx.virtualCwd, size);
};

const setCurrentDirectory: Handler = (call, ctx) => {
  const value = String(call.inputs[0] ?? "");
  if (value) ctx.virtualCwd = value;
  const out = emptyResults(call);
  const retIdx = returnIndex(call);
  if (retIdx >= 0) out[retIdx] = 1;
  return out;
};

const getWindowsDirectory: Handler = (call) => {
  const size = Number(call.inputs[1] ?? 0) || 260;
  return writeStringOut(call, SYNTHETIC_WINDOWS_DIR, size);
};

const getEnvironmentVariable: Handler = (call) => {
  // Browser has no environ. Return empty string + 0 length, matching
  // Win32 behaviour when the var is unset.
  const size = Number(call.inputs[2] ?? 0) || 32768;
  return writeStringOut(call, "", size);
};

const getCommandLine: Handler = (call) => {
  const out = emptyResults(call);
  const retIdx = returnIndex(call);
  if (retIdx >= 0) out[retIdx] = "INPA.EXE";
  return out;
};

const getComputerName: Handler = (call) => {
  const truncated = SYNTHETIC_COMPUTER_NAME;
  const out = emptyResults(call);
  let outCursor = 0;
  for (let i = 0; i < call.params.length; i++) {
    if (call.params[i].direction !== "out") continue;
    if (call.params[i].isReturn) {
      out[i] = 1;
    } else if (outCursor === 0) {
      out[i] = truncated;
      outCursor++;
    } else {
      out[i] = truncated.length;
      outCursor++;
    }
  }
  return out;
};

const SYSTEM_HANDLERS: Array<[string, Handler]> = [
  ["kernel32::GetTickCount", getTickCount],
  ["kernel32::GetCurrentDirectoryA", getCurrentDirectory],
  ["kernel32::SetCurrentDirectoryA", setCurrentDirectory],
  ["kernel32::GetWindowsDirectoryA", getWindowsDirectory],
  ["kernel32::GetEnvironmentVariableA", getEnvironmentVariable],
  ["kernel32::GetCommandLineA", getCommandLine],
  ["kernel32::GetComputerNameA", getComputerName],
];

// ============================================================
// String formatting — user32 sprintf + case folding
// ============================================================

/**
 * `int wvsprintfA(LPSTR lpOutput, LPCSTR lpFormat, va_list arglist)`
 *
 * Win32 positional printf. The `va_list` is opaque to us (we don't
 * have raw VM memory), so `%`-specs render with empty args — same as
 * the CLI. INPA scripts that hit this in practice use format strings
 * with no specs (e.g. `startus.ipo` formatting the title string).
 */
const wvsprintfA: Handler = (call) => {
  const format = String(call.inputs[1] ?? "");
  const rendered = formatMany(format, []);
  const out = emptyResults(call);
  let outCursor = 0;
  for (let i = 0; i < call.params.length; i++) {
    if (call.params[i].direction !== "out") continue;
    if (call.params[i].isReturn) {
      out[i] = rendered.length;
    } else if (outCursor === 0) {
      out[i] = rendered;
      outCursor++;
    } else {
      // Extra `L` slot — pin to 0 so the script doesn't see garbage.
      out[i] = 0;
      outCursor++;
    }
  }
  return out;
};

const charLowerA: Handler = (call) => {
  const input = String(call.inputs[0] ?? "");
  const out = emptyResults(call);
  const retIdx = returnIndex(call);
  if (retIdx >= 0) out[retIdx] = input.toLowerCase();
  return out;
};

const charUpperA: Handler = (call) => {
  const input = String(call.inputs[0] ?? "");
  const out = emptyResults(call);
  const retIdx = returnIndex(call);
  if (retIdx >= 0) out[retIdx] = input.toUpperCase();
  return out;
};

const STRING_HANDLERS: Array<[string, Handler]> = [
  ["user32::wvsprintfA", wvsprintfA],
  ["user32::CharLowerA", charLowerA],
  ["user32::CharUpperA", charUpperA],
];

// ============================================================
// Files — kernel32 file presence checks
// ============================================================

/**
 * `HFILE OpenFile(LPCSTR lpFileName, LPOFSTRUCT lpReOpenBuff, UINT uStyle)`
 *
 * Real Win32 returns a file handle (or HFILE_ERROR on failure). INPA
 * scripts only invoke this to *probe* whether a file exists — they
 * compare the return against `HFILE_ERROR (-1)` and branch on the
 * boolean result. We can't actually open a file from the browser
 * synchronously, so we return a synthetic non-error handle (1) and
 * let the script's follow-up reads (via INI helpers or `OPENFILE` /
 * `READFILE`-style BEST2 ops) fail naturally if the data isn't
 * there. Falls back to the script-side default on the rare path
 * that checks the structure contents.
 */
const openFile: Handler = (call) => {
  const out = emptyResults(call);
  const retIdx = returnIndex(call);
  // Per Win32 OFSTRUCT we'd populate the second slot with a struct;
  // INPA scripts never inspect it, so leave the out buffer untouched.
  if (retIdx >= 0) out[retIdx] = 1;
  return out;
};

const FILE_HANDLERS: Array<[string, Handler]> = [
  ["kernel32::OpenFile", openFile],
];

async function findCaseInsensitive(
  dir: FileSystemDirectoryHandle,
  filename: string
): Promise<FileSystemFileHandle | null> {
  const target = filename.toLowerCase();
  for await (const [name, entry] of dir.entries()) {
    if (entry.kind === "file" && name.toLowerCase() === target) {
      return entry as FileSystemFileHandle;
    }
  }
  return null;
}
