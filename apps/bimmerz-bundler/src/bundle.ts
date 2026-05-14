import { open, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";

import { Zip, ZipPassThrough } from "fflate";

import { DEFAULT_IGNORE } from "./default-ignore.js";
import { createMatcher } from "./matcher.js";
import { walk, type WalkedFile } from "./walker.js";

export interface BundleOptions {
  /** Absolute path to the INPA install root. */
  input: string;
  /** Where the zip should land. Created (or overwritten). */
  output: string;
  /** Optional path to a user-supplied `.bimmerzignore`. */
  ignoreFile?: string;
  /** When `true`, skip the built-in default ignore patterns. */
  noDefaultIgnore?: boolean;
  /** When `true`, walk + match but don't write the zip. Useful for
   *  previewing what a bundle would contain. */
  dryRun?: boolean;
  /** Per-file callback for progress UI. Fires for every kept file
   *  AND every skipped one (the `skipped` flag distinguishes). */
  onProgress?: (event: BundleProgressEvent) => void;
}

export type BundleProgressEvent =
  | { kind: "kept"; file: WalkedFile }
  | { kind: "skipped"; absolutePath: string; reason: string };

export interface BundleSummary {
  /** Files written to the zip (or that would be, with `--dry-run`). */
  filesKept: number;
  /** Files filtered out by the gitignore matcher / non-file kinds. */
  filesSkipped: number;
  /** Total bytes of kept files (uncompressed). */
  bytesKept: number;
  /** Output path. `undefined` for `--dry-run`. */
  outputPath?: string;
}

/**
 * The headline operation: walk the install, apply the ignore
 * filter, stream survivors into a zip.
 *
 * Uses fflate's streaming Zip writer so we never hold the whole
 * archive in memory — important when bundling a 500 MB INPA tree
 * on a laptop with limited RAM.
 */
export async function bundle(options: BundleOptions): Promise<BundleSummary> {
  const input = resolve(options.input);
  if (!existsSync(input)) {
    throw new Error(`Input directory does not exist: ${input}`);
  }
  const inputStat = await stat(input);
  if (!inputStat.isDirectory()) {
    throw new Error(`Input is not a directory: ${input}`);
  }

  const patternSources = await loadPatternSources(input, options);
  const matcher = createMatcher(patternSources);

  const summary: BundleSummary = {
    filesKept: 0,
    filesSkipped: 0,
    bytesKept: 0,
    outputPath: options.dryRun ? undefined : resolve(options.output),
  };

  // When NOT dry-running we set up the streaming zip writer up-front
  // and stream each file's bytes through as we discover them. The
  // zip's central directory is flushed by `zip.end()` after the last
  // file is in.
  let writeFd: Awaited<ReturnType<typeof open>> | null = null;
  let zip: Zip | null = null;
  if (!options.dryRun) {
    writeFd = await open(summary.outputPath!, "w");
    const fileHandle = writeFd;
    zip = new Zip();
    zip.ondata = (err, chunk, final) => {
      if (err) throw err;
      // fflate emits chunks synchronously; we hold the fd open and
      // append. `final` true means central directory written —
      // closing the fd is the caller's job after `zip.end()`.
      // Best-effort write (fflate doesn't await callbacks); errors
      // surface on the close below.
      void fileHandle.appendFile(Buffer.from(chunk));
      void final; // intentionally ignored; close happens below
    };
  }

  const onSkip = (absolutePath: string, reason: string): void => {
    summary.filesSkipped++;
    options.onProgress?.({ kind: "skipped", absolutePath, reason });
  };

  try {
    for await (const file of walk(
      input,
      {
        shouldDescend: (relDir) => matcher.shouldDescend(relDir),
        shouldKeep: (relPath) => matcher.shouldKeep(relPath),
      },
      onSkip,
    )) {
      summary.filesKept++;
      summary.bytesKept += file.size;
      options.onProgress?.({ kind: "kept", file });

      if (zip) {
        // ZipPassThrough = store mode (no DEFLATE). INPA installs
        // are mostly already-compressed binaries (IPO + SGBD).
        // Trying to DEFLATE them again costs CPU for negligible
        // size gains; pass-through is faster and matches what
        // `fflate` recommends for that workload.
        //
        // If we ever need compression for the small text files
        // (INI, ENG, GER), we can swap per-entry to `ZipDeflate`.
        const entry = new ZipPassThrough(file.relativePath);
        zip.add(entry);
        const data = await readFile(file.absolutePath);
        entry.push(data, true);
      }
    }

    if (zip) zip.end();
  } finally {
    if (writeFd) await writeFd.close();
  }

  return summary;
}

/**
 * Write the default ignore patterns to disk as a starter template
 * the user can edit. Refuses to overwrite an existing file unless
 * `force` is set — the user might have edits worth preserving.
 */
export async function writeDefaultIgnore(
  path: string,
  force: boolean = false,
): Promise<void> {
  const target = resolve(path);
  if (!force && existsSync(target)) {
    throw new Error(
      `Refusing to overwrite existing file: ${target} (pass --force to replace)`,
    );
  }
  // mkdir up to the parent first so `init somewhere/.bimmerzignore`
  // works on a clean tree.
  const { mkdir } = await import("node:fs/promises");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, DEFAULT_IGNORE, "utf-8");
}

/**
 * Assemble the ordered list of pattern strings — defaults first,
 * then the user's file (which can negate defaults with `!pattern`).
 * Skips the defaults entirely when `--no-default-ignore` is set.
 */
async function loadPatternSources(
  input: string,
  options: BundleOptions,
): Promise<string[]> {
  const sources: string[] = [];
  if (!options.noDefaultIgnore) {
    sources.push(DEFAULT_IGNORE);
  }

  let userIgnorePath = options.ignoreFile;
  if (!userIgnorePath) {
    // Convention: `<input-dir>/.bimmerzignore` is auto-picked up if
    // it exists. Mirrors how git looks for `.gitignore` at the
    // repo root.
    const candidate = resolve(input, ".bimmerzignore");
    if (existsSync(candidate)) userIgnorePath = candidate;
  }

  if (userIgnorePath) {
    if (!existsSync(userIgnorePath)) {
      throw new Error(`Ignore file not found: ${userIgnorePath}`);
    }
    const userContent = await readFile(userIgnorePath, "utf-8");
    sources.push(userContent);
  }

  return sources;
}
