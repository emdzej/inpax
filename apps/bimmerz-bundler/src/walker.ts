import { Dirent } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join, relative, sep, posix } from "node:path";

/**
 * One entry the walker yields. Paths are normalised to **forward
 * slashes** (POSIX) regardless of host OS so the gitignore matcher
 * sees the same shape everywhere — gitignore's grammar is
 * forward-slash-based and `ignore` doesn't normalise for us.
 */
export interface WalkedFile {
  /** Absolute path on disk, in the host OS's native separator. */
  absolutePath: string;
  /** Path relative to the walk root, POSIX separators, no leading
   *  slash. e.g. `"EDIABAS/Ecu/MS43.prg"`. */
  relativePath: string;
  /** File size in bytes. Read up-front so the caller can show a
   *  running total without re-stat'ing. */
  size: number;
}

export interface WalkOptions {
  /**
   * Called for each directory before descent — return `false` to
   * skip it. Lets the gitignore filter prune whole subtrees
   * (`Bin/`, `Log/`, …) instead of walking every file inside just
   * to drop them later.
   *
   * Receives the POSIX relative path with a trailing `/` so the
   * pattern `Log/` matches the directory itself, not just files
   * inside it. (Matches gitignore semantics.)
   */
  shouldDescend?: (relativeDirPath: string) => boolean;

  /**
   * Per-file gate. Same path normalisation as `shouldDescend` but
   * without the trailing slash. Skipping here doesn't prune the
   * containing directory.
   */
  shouldKeep?: (relativeFilePath: string) => boolean;

  /**
   * Maximum recursion depth. Defensive — avoids accidental cycles
   * from symlinks (which we already skip; this is belt-and-braces).
   */
  maxDepth?: number;
}

/**
 * Recursively walk `root`, applying optional gate callbacks at each
 * directory and file. Yields `WalkedFile` for every file kept.
 *
 * Symlinks are **skipped** rather than followed — BMW installs
 * don't use them, and following risks loops or escaping the walk
 * root. We emit a debug log via `onSkip` if provided.
 *
 * Directories themselves aren't yielded — only files. The caller
 * (zip writer) creates parent dirs implicitly through file paths.
 */
export async function* walk(
  root: string,
  options: WalkOptions = {},
  onSkip?: (path: string, reason: string) => void,
): AsyncGenerator<WalkedFile> {
  const maxDepth = options.maxDepth ?? 32;
  yield* walkInner(root, root, 0, maxDepth, options, onSkip);
}

async function* walkInner(
  root: string,
  current: string,
  depth: number,
  maxDepth: number,
  options: WalkOptions,
  onSkip?: (path: string, reason: string) => void,
): AsyncGenerator<WalkedFile> {
  if (depth > maxDepth) {
    onSkip?.(current, `max depth ${maxDepth}`);
    return;
  }

  let entries: Dirent[];
  try {
    entries = await readdir(current, { withFileTypes: true });
  } catch (err) {
    onSkip?.(current, `readdir failed: ${(err as Error).message}`);
    return;
  }

  // Stable, locale-independent order so the same input produces
  // the same zip bit-for-bit (mostly — fflate uses mtimes too).
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  for (const entry of entries) {
    const abs = join(current, entry.name);
    const rel = toPosix(relative(root, abs));

    if (entry.isSymbolicLink()) {
      onSkip?.(abs, "symlink");
      continue;
    }

    if (entry.isDirectory()) {
      const relDir = rel + "/";
      if (options.shouldDescend && !options.shouldDescend(relDir)) {
        onSkip?.(abs, `excluded directory ${relDir}`);
        continue;
      }
      yield* walkInner(root, abs, depth + 1, maxDepth, options, onSkip);
      continue;
    }

    if (!entry.isFile()) {
      // Sockets, FIFOs, devices, etc. — never in BMW installs.
      onSkip?.(abs, `non-file (${describeKind(entry)})`);
      continue;
    }

    if (options.shouldKeep && !options.shouldKeep(rel)) {
      onSkip?.(abs, `excluded file ${rel}`);
      continue;
    }

    let size = 0;
    try {
      const s = await stat(abs);
      size = s.size;
    } catch (err) {
      onSkip?.(abs, `stat failed: ${(err as Error).message}`);
      continue;
    }

    yield { absolutePath: abs, relativePath: rel, size };
  }
}

function describeKind(entry: Dirent): string {
  if (entry.isBlockDevice()) return "block-device";
  if (entry.isCharacterDevice()) return "char-device";
  if (entry.isFIFO()) return "fifo";
  if (entry.isSocket()) return "socket";
  return "unknown";
}

function toPosix(p: string): string {
  if (sep === posix.sep) return p;
  return p.split(sep).join(posix.sep);
}
