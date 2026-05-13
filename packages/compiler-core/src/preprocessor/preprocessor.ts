import { readFileSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve as resolvePath } from 'node:path';

export class PreprocessorError extends Error {
  constructor(
    message: string,
    public readonly file: string,
    public readonly line: number,
  ) {
    super(`${file}:${line}: ${message}`);
    this.name = 'PreprocessorError';
  }
}

export interface PreprocessOptions {
  /**
   * Absolute path of the source file being compiled. When set, the
   * preprocessor searches this file's directory first for `#include`s
   * before falling back to `includePaths`.
   */
  filePath?: string;
  /** Additional roots to search for `#include` after the current dir. */
  includePaths?: string[];
  /**
   * Filesystem override — primarily for tests. Map paths to file
   * contents instead of touching disk.
   */
  fileReader?: (absPath: string) => string | undefined;
}

const INCLUDE_RE = /^\s*#\s*include\s+"([^"]+)"\s*$/;
const ANGLE_INCLUDE_RE = /^\s*#\s*include\s+<([^>]+)>\s*$/;
const PRAGMA_RE = /^\s*#\s*pragma\b/;
const OTHER_DIRECTIVE_RE = /^\s*#/;

/**
 * INPA preprocessor — handles `#include` and `#pragma`. Comments are
 * left intact for the lexer to skip. Line numbers within the merged
 * stream are useful enough for diagnostics; mapping back to the
 * originating file can be layered on later via `# <line> <file>`
 * directives.
 */
export class Preprocessor {
  private readonly includePaths: string[];
  private readonly fileReader: (path: string) => string | undefined;
  /** Stack of files currently being included — used for cycle detection. */
  private readonly stack: string[] = [];

  constructor(options: PreprocessOptions = {}) {
    this.includePaths = (options.includePaths ?? []).map((p) =>
      resolvePath(p),
    );
    this.fileReader = options.fileReader ?? defaultFileReader;
  }

  /**
   * Preprocess a source string. If `filePath` is given, includes are
   * resolved relative to it first (then `includePaths`).
   */
  process(source: string, filePath?: string): string {
    const absPath = filePath ? resolvePath(filePath) : '<source>';
    return this.processSource(source, absPath);
  }

  private processSource(source: string, absPath: string): string {
    if (this.stack.includes(absPath)) {
      throw new PreprocessorError(
        `include cycle: ${[...this.stack, absPath].join(' -> ')}`,
        absPath,
        0,
      );
    }
    this.stack.push(absPath);
    try {
      const lines = source.split('\n');
      const out: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const m = raw.match(INCLUDE_RE) ?? raw.match(ANGLE_INCLUDE_RE);
        if (m) {
          const included = this.locate(m[1], absPath);
          if (!included) {
            throw new PreprocessorError(
              `cannot find include "${m[1]}"`,
              absPath,
              i + 1,
            );
          }
          const content = this.fileReader(included.absPath);
          if (content === undefined) {
            throw new PreprocessorError(
              `cannot read include "${included.absPath}"`,
              absPath,
              i + 1,
            );
          }
          out.push(this.processSource(content, included.absPath));
          continue;
        }
        if (PRAGMA_RE.test(raw)) {
          // Drop the pragma but keep the line number stable.
          out.push('');
          continue;
        }
        if (OTHER_DIRECTIVE_RE.test(raw)) {
          // Unknown preprocessor directive — keep silent for now;
          // INPACOMP tolerates several non-standard `#` directives in
          // BMW-shipped headers and these aren't load-bearing.
          out.push('');
          continue;
        }
        out.push(raw);
      }
      return out.join('\n');
    } finally {
      this.stack.pop();
    }
  }

  private locate(name: string, currentFile: string): { absPath: string } | undefined {
    if (isAbsolute(name)) {
      return this.fileReader(name) !== undefined ? { absPath: name } : undefined;
    }
    const tried: string[] = [];

    // 1. Current file's directory
    if (currentFile !== '<source>') {
      const candidate = resolvePath(dirname(currentFile), name);
      tried.push(candidate);
      if (this.fileReader(candidate) !== undefined) {
        return { absPath: candidate };
      }
      // Header filenames in BMW scripts are sometimes upper/lowercase
      // inconsistently (e.g. `BMW_STD.H` vs the on-disk `bmw_std.h`).
      // Try a case-insensitive sibling match.
      const ci = caseInsensitiveSibling(candidate);
      if (ci && this.fileReader(ci) !== undefined) {
        return { absPath: ci };
      }
    }
    // 2. -I include roots
    for (const root of this.includePaths) {
      const candidate = resolvePath(root, name);
      tried.push(candidate);
      if (this.fileReader(candidate) !== undefined) {
        return { absPath: candidate };
      }
      const ci = caseInsensitiveSibling(candidate);
      if (ci && this.fileReader(ci) !== undefined) {
        return { absPath: ci };
      }
    }
    return undefined;
  }
}

function defaultFileReader(absPath: string): string | undefined {
  try {
    return readFileSync(absPath, 'utf-8');
  } catch {
    return undefined;
  }
}

/**
 * Look for a file in `dirname(absPath)` whose basename matches
 * `basename(absPath)` case-insensitively. INPA scripts in the wild are
 * inconsistent: a script writes `#include "BMW_STD.H"` (uppercase
 * legacy convention) but the file on a Unix filesystem is
 * `bmw_std.h`. We scan the directory once and pick the first match.
 *
 * Returns `undefined` if the directory doesn't exist or no entry
 * matches. Returns the original path unchanged if it exists exactly.
 */
function caseInsensitiveSibling(absPath: string): string | undefined {
  try {
    const dir = dirname(absPath);
    const target = absPath.slice(dir.length + 1).toLowerCase();
    for (const entry of readdirSync(dir)) {
      if (entry.toLowerCase() === target) {
        return resolvePath(dir, entry);
      }
    }
  } catch {
    // dir doesn't exist or unreadable
  }
  return undefined;
}

export function preprocess(source: string, options: PreprocessOptions = {}): string {
  return new Preprocessor(options).process(source, options.filePath);
}
