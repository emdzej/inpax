/**
 * Browser-side SGBD loader.
 *
 * INPA scripts call `INPAapiJob(ecu, ...)` with a base name like
 * `"MS430DS0"` or `"D_0012"`. The Node CLI resolves this through
 * `ediabas.loadSgbd(filename)` which reads from the filesystem; in
 * the browser we have a VFS `VirtualDirectory` for the Ecu dir and
 * need to do the same lookup ourselves before handing bytes to
 * `ediabas.loadSgbdFromBuffer(bytes, name)`.
 *
 * Matches ediabasx's `resolveCaseInsensitive` in
 * `packages/ediabas/src/ediabas.ts` + the native EDIABAS
 * `ResolveSgbdFile`:
 *   - Try the exact name (after appending `.prg`/`.grp`)
 *   - Fall back to a case-insensitive scan
 *   - Allow `.prg ↔ .grp` extension swap so a script asking for
 *     `D_0012.prg` finds `d_0012.grp` and vice versa
 *   - For bare names with NO extension (INPA's usual case —
 *     `INPAapiJob("D_000D", …)`), probe BOTH `.prg` AND `.grp`.
 *
 * Backed by `@emdzej/bimmerz-vfs`'s `VirtualDirectory`, so the
 * same resolver works against local FSA installs, OPFS bundles,
 * and remote HTTP installs.
 */

import type { VirtualDirectory, VirtualFile } from "@emdzej/bimmerz-vfs";

/**
 * Build the `loadSgbdResolver` callback the ediabasx `Ediabas`
 * instance routes BOTH initial loads AND post-IDENT variant swaps
 * through. Captures the Ecu directory by closure; the returned
 * function performs the resolution + byte read and hands the
 * canonical filename back so Ediabas can pin `prgPath` /
 * `VARIANTE` correctly.
 */
export function makeBrowserSgbdResolver(
  ecuDir: VirtualDirectory,
): (filename: string) => Promise<{ bytes: Uint8Array; name: string }> {
  return async (filename: string) => {
    const file = await resolveSgbdFile(ecuDir, filename);
    if (!file) {
      throw new Error(`SGBD not found in Ecu/: ${filename}`);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    return { bytes, name: file.name };
  };
}

/**
 * Walk the Ecu directory looking for the requested SGBD. Returns the
 * file handle so the caller decides when to read (a single byte read
 * happens at job-switch time, not per call). Casing-insensitive +
 * `.prg ↔ .grp` swap + dual probe for bare names.
 */
async function resolveSgbdFile(
  ecuDir: VirtualDirectory,
  filename: string,
): Promise<VirtualFile | null> {
  const lower = filename.toLowerCase();
  const hasExt = /\.(prg|grp)$/.test(lower);
  const stem = lower.replace(/\.(prg|grp)$/, "");

  /* Build the candidate set:
       • With extension → exact first, then `.prg ↔ .grp` swap.
       • Without extension (the INPA case) → probe both .prg and .grp. */
  const candidates: string[] = hasExt
    ? [lower, `${stem}${lower.endsWith(".prg") ? ".grp" : ".prg"}`]
    : [`${stem}.prg`, `${stem}.grp`];

  /* VFS `file()` does case-insensitive lookup internally — just try
     each candidate. First match wins (preserves the preferred-
     extension ordering above). */
  for (const candidate of candidates) {
    const hit = await ecuDir.file(candidate);
    if (hit) return hit;
  }
  return null;
}
