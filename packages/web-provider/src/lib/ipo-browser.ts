/**
 * List `.ipo` files under a directory, sorted by name.
 *
 * Used to populate the IPO sidebar once the user has picked an INPA
 * install root. We don't read file contents here — just list names
 * and capture an `open()` thunk the UI calls when the user actually
 * picks an IPO. Per-file open is deferred because some backings
 * (FSA on a real install with hundreds of IPOs) pay a non-trivial
 * cost per `getFile()` and we don't want the sidebar mount to block
 * on hundreds of those serially.
 *
 * Backed by `@emdzej/bimmerz-vfs` so the same code lists IPOs from a
 * local folder, an OPFS bundle, or a remote HTTP server (with
 * `index.json` listings).
 */

import type { VirtualDirectory, VirtualFile } from "@emdzej/bimmerz-vfs";
import { listFiles } from "@emdzej/bimmerz-vfs";

export interface IpoEntry {
  /** Filename as it appears at the source (preserves casing). */
  name: string;
  /** The directory this file lives under — "SGDAT" or "CFGDAT" — so we can group/label the sidebar. */
  origin: string;
  /**
   * Lazy open. Calls back into the source `VirtualDirectory` to
   * fetch the file handle when the user actually selects the IPO.
   * Throws if the file disappeared between listing and open
   * (e.g. user moved the folder out from under us).
   */
  open: () => Promise<VirtualFile>;
  /**
   * Back-compat alias used by code that still reads `.handle`. New
   * code should call `.open()` directly. We provide both so the
   * type-level rename can roll out without breaking older call
   * sites (`.handle.arrayBuffer()` still works because `VirtualFile`
   * has that method too).
   *
   * @deprecated Use `.open()` instead — `handle` resolves the same way
   * but the naming carries an obsolete FSA assumption.
   */
  handle: { arrayBuffer: () => Promise<ArrayBuffer> };
}

/**
 * List `.ipo` files in a single directory (case-insensitive
 * extension match — installs often have mixed casing). Doesn't
 * recurse; INPA puts scripts directly under SGDAT / CFGDAT, no
 * subfolders. Returns entries with lazy `open()` thunks; the
 * underlying `dir.file(name)` call is only made when the user
 * actually opens an IPO.
 */
export async function listIpoFiles(
  dir: VirtualDirectory,
  origin: string,
): Promise<IpoEntry[]> {
  const fileEntries = await listFiles(dir, ".ipo");
  const entries: IpoEntry[] = fileEntries.map((e) => {
    const open = async (): Promise<VirtualFile> => {
      const file = await dir.file(e.name);
      if (!file) {
        throw new Error(`IPO file no longer present in ${dir.name}/: ${e.name}`);
      }
      return file;
    };
    return {
      name: e.name,
      origin,
      open,
      /* Back-compat alias — older call sites do
         `entry.handle.arrayBuffer()`. Resolve the file lazily
         the same way `.open()` does. */
      handle: {
        arrayBuffer: async () => (await open()).arrayBuffer(),
      },
    };
  });
  entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  return entries;
}
