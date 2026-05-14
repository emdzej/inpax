// `ignore` ships as CJS with a `module.exports = <fn>` style; the
// .d.ts declares `export default ignore` but under our NodeNext +
// ESM tsconfig the synthetic default import doesn't resolve to a
// callable. Reach in via createRequire (Node-only — this is a CLI
// tool, no browser concerns) and re-type the result so callers
// get full Ignore typing back.
import { createRequire } from "node:module";

import type { Ignore } from "ignore";

const require = createRequire(import.meta.url);
const ignore = require("ignore") as (options?: {
  ignorecase?: boolean;
  ignoreCase?: boolean;
  allowRelativePaths?: boolean;
}) => Ignore;

/**
 * Thin wrapper around the `ignore` npm package — gitignore-spec
 * matching with case-insensitive comparison so the same
 * `.bimmerzignore` works against a Windows install (mixed case),
 * a Linux mirror (all lowercase), and a macOS-imported copy (NFD
 * unicode normalisation potentially mixed in).
 *
 * The `ignore` package's API is "test paths against the pattern
 * set"; we expose two helpers because gitignore distinguishes
 * directory-only matches via a trailing slash, and our walker
 * needs to know "should I even descend into this dir" separately
 * from "should I include this file".
 */
export interface IgnoreMatcher {
  /**
   * True when `relativeDirPath` (POSIX, trailing slash) is NOT
   * excluded — i.e. the walker should descend.
   */
  shouldDescend(relativeDirPath: string): boolean;

  /**
   * True when `relativeFilePath` (POSIX, no trailing slash) is NOT
   * excluded — i.e. the file goes in the zip.
   */
  shouldKeep(relativeFilePath: string): boolean;
}

export function createMatcher(patternSources: string[]): IgnoreMatcher {
  // `ignorecase: true` is the key flag — without it Windows file
  // paths bypass macOS-cased patterns and vice-versa. The package
  // also lowercases internally before testing, which is exactly
  // what we want.
  const ig = ignore({ ignorecase: true });
  for (const src of patternSources) {
    if (src) ig.add(src);
  }

  return {
    shouldDescend(relativeDirPath: string): boolean {
      // gitignore's `ignores` returns true when the path IS
      // ignored, so we invert. Trailing slash is significant —
      // `Log/` matches the directory but not a file named `Log`.
      const normalised = relativeDirPath.endsWith("/")
        ? relativeDirPath
        : relativeDirPath + "/";
      return !ig.ignores(normalised);
    },
    shouldKeep(relativeFilePath: string): boolean {
      return !ig.ignores(relativeFilePath);
    },
  };
}
