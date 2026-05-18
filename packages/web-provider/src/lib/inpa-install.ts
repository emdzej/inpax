/**
 * INPA install layout discovery.
 *
 * BMW's INPA ships with a canonical directory tree:
 *
 *   <root>/
 *     EC-APPS/INPA/CFGDAT/    — top-level scripts (startus.ipo, INPA.INI)
 *     EC-APPS/INPA/SGDAT/     — variant-specific scripts (Ms43_sp2.ipo, …)
 *     EDIABAS/Ecu/            — SGBD files (.prg / .grp) the scripts use
 *     EDIABAS/Bin/            — INI / config (optional)
 *
 * The user picks the root directory via `showDirectoryPicker()` and we
 * walk down to find each of those subdirs case-insensitively. Each
 * resolved subdir is exposed as a `FileSystemDirectoryHandle` so the
 * rest of the app reads bytes lazily without us slurping everything
 * into memory up front.
 *
 * Browser support: requires the File System Access API
 * (`showDirectoryPicker`) — Chromium-only as of 2025-05. Firefox/Safari
 * get a "use Chrome/Edge" banner from the UI layer; we don't try to
 * fall back to `<input webkitdirectory>` here because the persistent
 * permission model is the only thing that makes this app usable.
 */

export interface InpaInstall {
  /** The directory the user picked via showDirectoryPicker. */
  root: FileSystemDirectoryHandle;
  /** `<root>/EC-APPS/INPA/CFGDAT` — top-level INPA scripts + INPA.INI. */
  cfgdat: FileSystemDirectoryHandle | null;
  /** `<root>/EC-APPS/INPA/SGDAT` — variant scripts. */
  sgdat: FileSystemDirectoryHandle | null;
  /** `<root>/EDIABAS/Ecu` — SGBD files. */
  ecu: FileSystemDirectoryHandle | null;
  /** `<root>/EDIABAS/Bin` — EDIABAS.INI lives here. */
  ediabasBin: FileSystemDirectoryHandle | null;
}

/**
 * Whether the canonical INPA layout was found under `root`. Used by
 * the UI to show what's missing if the picked folder isn't quite an
 * INPA install.
 */
export function isCompleteInstall(install: InpaInstall): boolean {
  return install.cfgdat !== null && install.sgdat !== null && install.ecu !== null;
}

/**
 * Drill into `root` and find the four canonical INPA subdirectories.
 * Each lookup is case-insensitive — real installs after rsync from
 * Windows often have lowercased path components and we don't want to
 * fail on `EC-APPS` vs `ec-apps` etc.
 */
export async function discoverInpaInstall(
  root: FileSystemDirectoryHandle
): Promise<InpaInstall> {
  const [cfgdat, sgdat, ecu, ediabasBin] = await Promise.all([
    drillCaseInsensitive(root, ["EC-APPS", "INPA", "CFGDAT"]),
    drillCaseInsensitive(root, ["EC-APPS", "INPA", "SGDAT"]),
    drillCaseInsensitive(root, ["EDIABAS", "Ecu"]),
    drillCaseInsensitive(root, ["EDIABAS", "Bin"]),
  ]);

  return { root, cfgdat, sgdat, ecu, ediabasBin };
}

/**
 * Walk down a path one segment at a time, matching each segment
 * case-insensitively against the actual directory entries. Returns
 * null if any segment doesn't exist — easier than a TypeError later.
 */
async function drillCaseInsensitive(
  start: FileSystemDirectoryHandle,
  segments: string[]
): Promise<FileSystemDirectoryHandle | null> {
  let current: FileSystemDirectoryHandle = start;
  for (const segment of segments) {
    const target = segment.toLowerCase();
    let found: FileSystemDirectoryHandle | null = null;
    for await (const [name, entry] of current.entries()) {
      if (entry.kind === "directory" && name.toLowerCase() === target) {
        found = entry as FileSystemDirectoryHandle;
        break;
      }
    }
    if (!found) return null;
    current = found;
  }
  return current;
}

/**
 * Browser feature check. Returns false on Firefox/Safari/etc. and
 * `true` on Chromium derivatives. The UI shows a "use Chrome/Edge"
 * banner when this is false rather than offering a broken fallback.
 */
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}
