/**
 * List `.ipo` files under a directory handle, sorted by name.
 *
 * Used to populate the IPO sidebar once the user has picked an INPA
 * install root. We don't read file contents here — just list and
 * return handles the UI can pass to the parser later.
 */

export interface IpoEntry {
  /** Filename as it appears on disk (preserves casing). */
  name: string;
  /** The directory this file lives under — "SGDAT" or "CFGDAT" — so we can group/label the sidebar. */
  origin: string;
  /** Lazy byte source; call `.getFile()` to read. */
  handle: FileSystemFileHandle;
}

/**
 * Walk a single directory and collect `.ipo` files (case-insensitive
 * extension match — installs often have mixed casing). Doesn't recurse;
 * INPA puts scripts directly under SGDAT / CFGDAT, no subfolders.
 */
export async function listIpoFiles(
  dir: FileSystemDirectoryHandle,
  origin: string
): Promise<IpoEntry[]> {
  const entries: IpoEntry[] = [];
  for await (const [name, entry] of dir.entries()) {
    if (entry.kind !== "file") continue;
    if (!name.toLowerCase().endsWith(".ipo")) continue;
    entries.push({ name, origin, handle: entry as FileSystemFileHandle });
  }
  entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  return entries;
}
