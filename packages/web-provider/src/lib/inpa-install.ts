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
 * The install is now backed by `@emdzej/bimmerz-vfs`'s `VirtualDirectory`
 * — one read-only interface, three backings: File System Access API,
 * OPFS (both via `FsaDirectory`), and remote HTTP servers with
 * `index.json` listings (via `HttpDirectory`). Consumers see a single
 * shape regardless of where the bytes live.
 *
 * Browser support: any modern browser. FSA needs Chromium; OPFS works
 * almost everywhere; HTTP works everywhere. The UI layer picks one,
 * wraps the source in a `VirtualDirectory`, and hands it here.
 */

import type { VirtualDirectory } from "@emdzej/bimmerz-vfs";
import { drillPath } from "@emdzej/bimmerz-vfs";

export interface InpaInstall {
  /** The root the user mounted (folder pick / OPFS bundle / remote URL). */
  root: VirtualDirectory;
  /** `<root>/EC-APPS/INPA/CFGDAT` — top-level INPA scripts + INPA.INI. */
  cfgdat: VirtualDirectory | null;
  /** `<root>/EC-APPS/INPA/SGDAT` — variant scripts. */
  sgdat: VirtualDirectory | null;
  /** `<root>/EDIABAS/Ecu` — SGBD files. */
  ecu: VirtualDirectory | null;
  /** `<root>/EDIABAS/Bin` — EDIABAS.INI lives here. */
  ediabasBin: VirtualDirectory | null;
}

/**
 * Whether the canonical INPA layout was found under `root`. Used by
 * the UI to show what's missing if the picked source isn't quite an
 * INPA install.
 */
export function isCompleteInstall(install: InpaInstall): boolean {
  return install.cfgdat !== null && install.sgdat !== null && install.ecu !== null;
}

/**
 * Drill into `root` and find the four canonical INPA subdirectories.
 * VFS's `drillPath` walks case-insensitively, so installs rsynced
 * from Windows (mixed casing like `EC-APPS` vs `ec-apps`) just work.
 */
export async function discoverInpaInstall(
  root: VirtualDirectory,
): Promise<InpaInstall> {
  const [cfgdat, sgdat, ecu, ediabasBin] = await Promise.all([
    drillPath(root, "EC-APPS", "INPA", "CFGDAT"),
    drillPath(root, "EC-APPS", "INPA", "SGDAT"),
    drillPath(root, "EDIABAS", "Ecu"),
    drillPath(root, "EDIABAS", "Bin"),
  ]);

  return { root, cfgdat, sgdat, ecu, ediabasBin };
}

/**
 * Browser feature check for the FSA-based install path. The remote
 * HTTP and OPFS paths work in all browsers — UI shows the FSA option
 * as disabled when this returns false rather than offering a broken
 * fallback.
 */
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}
