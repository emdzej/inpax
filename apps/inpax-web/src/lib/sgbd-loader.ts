/**
 * Browser-side SGBD loader.
 *
 * INPA scripts call `INPAapiJob(ecu, ...)` with a base name like
 * `"MS430DS0"` or `"D_0012"`. The Node CLI resolves this through
 * `ediabas.loadSgbd(filename)` which reads from the filesystem; in
 * the browser we have a `FileSystemDirectoryHandle` to the Ecu dir
 * and need to do the same lookup ourselves before handing bytes to
 * `ediabas.loadSgbdFromBuffer(bytes, name)`.
 *
 * Matches ediabasx's `resolveCaseInsensitive` in
 * `packages/ediabas/src/ediabas.ts`:
 *   - Try the exact name (after appending `.prg`/`.grp`)
 *   - Fall back to a case-insensitive scan
 *   - Allow `.prg ↔ .grp` extension swap so a script asking for
 *     `D_0012.prg` finds `d_0012.grp` and vice versa
 */

/**
 * Build the `loadSgbdResolver` callback the ediabasx `Ediabas`
 * instance routes BOTH initial loads AND post-IDENT variant swaps
 * through. Captures the Ecu directory handle by closure; the
 * returned function performs the resolution + byte read and hands
 * the canonical filename back so Ediabas can pin `prgPath` /
 * `VARIANTE` correctly.
 *
 * One resolver — both code paths. Replaces the inpax-side
 * `EdiabasXProvider.loadSgbd` callback we had earlier; that one
 * could only intercept the initial load, not the swap. Routing
 * through ediabasx's own hook keeps the .grp → .prg swap working
 * without any `node:fs` / `node:path` access in the browser bundle.
 */
export function makeBrowserSgbdResolver(
  ecuDir: FileSystemDirectoryHandle
): (filename: string) => Promise<{ bytes: Uint8Array; name: string }> {
  return async (filename: string) => {
    const handle = await resolveSgbdFile(ecuDir, filename);
    if (!handle) {
      throw new Error(`SGBD not found in Ecu/: ${filename}`);
    }
    const file = await handle.getFile();
    const bytes = new Uint8Array(await file.arrayBuffer());
    return { bytes, name: handle.name };
  };
}

/**
 * Walk the Ecu directory looking for the requested SGBD. Returns the
 * file handle so the caller decides when to read (a single byte read
 * happens at job-switch time, not per call). Casing-insensitive +
 * `.prg ↔ .grp` swap, matching the Node resolver.
 */
async function resolveSgbdFile(
  ecuDir: FileSystemDirectoryHandle,
  filename: string
): Promise<FileSystemFileHandle | null> {
  const requested = filename.toLowerCase();
  const stem = requested.replace(/\.(prg|grp)$/, "");
  // Build candidate basenames (case-insensitive comparison). Prefer
  // exact-extension match; fall back to the swap.
  const candidates = new Set<string>([requested]);
  if (requested.endsWith(".prg")) candidates.add(stem + ".grp");
  else if (requested.endsWith(".grp")) candidates.add(stem + ".prg");

  // Walk once. Remember the swap-match so the preferred extension wins
  // if both are present.
  let exact: FileSystemFileHandle | null = null;
  let swap: FileSystemFileHandle | null = null;
  for await (const [name, entry] of ecuDir.entries()) {
    if (entry.kind !== "file") continue;
    const lower = name.toLowerCase();
    if (lower === requested) {
      exact = entry as FileSystemFileHandle;
      break;
    }
    if (candidates.has(lower)) {
      swap = entry as FileSystemFileHandle;
    }
  }
  return exact ?? swap;
}
