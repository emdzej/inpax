#!/usr/bin/env node
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, resolve as resolvePath } from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import {
  compile,
  DEFAULT_SOURCE_ENCODING,
  decodeBytes,
  isEncodingSupported,
} from '@emdzej/inpax-compiler-core';

interface CompileFlags {
  /**
   * Output target. With a single input, treated as a file path. With
   * multiple inputs, must be (or be created as) a directory — each
   * compiled file lands at `<dir>/<basename(.ipo)>`.
   */
  output?: string;
  include?: string[];
  encoding?: string;
  /** Keep going after a file fails to compile (batch mode). */
  continue?: boolean;
  verbose?: boolean;
}

const program = new Command();

program
  .name('inpax-compiler')
  .description('Compile INPA IPS source files into IPO bytecode')
  .version('0.1.0');

program
  .argument('<files...>', 'IPS source file(s) — compile one or many')
  .option(
    '-o, --output <path>',
    'output IPO file (single input) or output directory (batch mode)',
  )
  .option(
    '-I, --include <dir>',
    'add directory to #include search path — repeatable, or comma-separated',
    collectIncludeDirs,
    [] as string[],
  )
  .option(
    '-e, --encoding <name>',
    'source-file encoding (default cp1252; e.g. cp1250, cp1251, latin1, utf-8)',
    DEFAULT_SOURCE_ENCODING,
  )
  .option('--continue', 'keep compiling remaining files after one fails')
  .option('-v, --verbose', 'print extra info to stderr')
  .action((files: string[], opts: CompileFlags) => {
    const includePaths = opts.include ?? [];
    const encoding = opts.encoding ?? DEFAULT_SOURCE_ENCODING;
    if (!isEncodingSupported(encoding)) {
      console.error(chalk.red(`error: unknown source encoding: ${encoding}`));
      process.exit(2);
    }
    const isBatch = files.length > 1;
    const target = resolveOutputTarget(files, opts.output, isBatch);

    let okCount = 0;
    let failCount = 0;
    let bytesTotal = 0;
    let firstFailure: Error | undefined;

    for (const file of files) {
      const inputPath = resolvePath(file);
      const outputPath = outputFor(target, inputPath);

      try {
        // Decode source bytes with the user-chosen encoding before
        // handing the string to the compiler. The compiler itself
        // applies the same encoding to any `#include`d files it
        // pulls in from disk.
        const source = decodeBytes(readFileSync(inputPath), encoding);
        const bytes = compile(source, {
          filePath: inputPath,
          includePaths,
          encoding,
        });
        writeFileSync(outputPath, bytes);
        okCount++;
        bytesTotal += bytes.byteLength;
        if (opts.verbose || isBatch) {
          process.stderr.write(
            chalk.gray(
              `  ✓ ${shortPath(inputPath)} → ${shortPath(outputPath)} (${bytes.byteLength} B)\n`,
            ),
          );
        }
      } catch (err) {
        failCount++;
        firstFailure ??= err as Error;
        process.stderr.write(
          chalk.red(`  ✗ ${shortPath(inputPath)}: ${(err as Error).message}\n`),
        );
        if (!opts.continue) break;
      }
    }

    if (isBatch || opts.verbose) {
      const summary = `${okCount}/${files.length} compiled`;
      const failed = failCount > 0 ? `, ${failCount} failed` : '';
      const size = okCount > 0 ? ` · ${bytesTotal} bytes total` : '';
      process.stderr.write(chalk.bold(`\n${summary}${failed}${size}\n`));
    }

    if (failCount > 0) {
      // Exit non-zero so shell pipelines / CI catch failures, but the
      // per-file error already went to stderr above. `firstFailure` is
      // retained only for the assertion message — actual diagnostics
      // were printed line by line.
      process.exit(firstFailure ? 1 : 1);
    }
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(chalk.red((err as Error).message));
  process.exit(1);
});

/**
 * commander accumulator for `-I` flags. Accepts both repeated flags
 * (`-I a -I b`) and comma-separated values (`-I a,b`); mixing them
 * is fine. Empty segments after split are dropped.
 */
function collectIncludeDirs(value: string, prev: string[]): string[] {
  const parts = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return prev.concat(parts);
}

type OutputTarget =
  | { kind: 'file'; file: string }      // explicit single output file
  | { kind: 'dir'; dir: string }        // batch with -o <dir>
  | { kind: 'next-to-source' };          // default in both single and batch modes

function resolveOutputTarget(
  files: string[],
  output: string | undefined,
  isBatch: boolean,
): OutputTarget {
  if (!output) {
    // No -o: every output sits next to its source. Works for both
    // single and batch modes — matches how `tsc` and similar tools
    // default.
    return { kind: 'next-to-source' };
  }

  const abs = resolvePath(output);
  if (isBatch) {
    // With multiple inputs, -o is a directory. Otherwise we'd
    // silently overwrite every output with the last file's bytes.
    // We don't auto-mkdir — that's a bigger blast-radius decision to
    // surface to the user.
    let isDir = false;
    try {
      isDir = statSync(abs).isDirectory();
    } catch {
      // Path doesn't exist yet. If it doesn't look like a .ipo path,
      // accept it as a (yet-to-be-created) dir; otherwise reject.
      isDir = !/\.ipo$/i.test(abs);
    }
    if (!isDir) {
      console.error(
        chalk.red(
          `error: --output must be a directory when compiling multiple files (got "${output}")`,
        ),
      );
      process.exit(2);
    }
    return { kind: 'dir', dir: abs };
  }

  return { kind: 'file', file: abs };
}

function outputFor(target: OutputTarget, inputPath: string): string {
  switch (target.kind) {
    case 'file':
      return target.file;
    case 'dir':
      return resolvePath(target.dir, basename(inputPath).replace(/\.ips$/i, '.ipo'));
    case 'next-to-source':
      return inputPath.replace(/\.ips$/i, '.ipo');
  }
}

function shortPath(p: string): string {
  const cwd = process.cwd();
  if (p.startsWith(cwd + '/')) return p.slice(cwd.length + 1);
  return p;
}
