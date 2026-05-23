/**
 * `inpax compile <files...>` — IPS source → IPO bytecode compiler.
 * Plus `inpax compile new <file>` for scaffolding starter .ips files.
 * Subsumes what used to ship as the separate `inpax-compiler` binary.
 */
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
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
  output?: string;
  include?: string[];
  encoding?: string;
  continue?: boolean;
  verbose?: boolean;
}

export const compileCommand = new Command('compile')
  .description('Compile INPA IPS source files into IPO bytecode')
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
      process.exit(firstFailure ? 1 : 1);
    }
  });

// `inpax compile new <file>` — scaffold a starter .ips file with
// the canonical winedit/inpainit/inpaexit skeleton every BMW script
// starts from.
compileCommand
  .command('new <file>')
  .description('write a starter .ips file with inpainit / inpaexit stubs')
  .option('--title <text>', 'placeholder text for settitle() in inpainit', 'New script')
  .option('--force', 'overwrite if the file already exists')
  .action((file: string, opts: { title: string; force?: boolean }) => {
    const outPath = resolvePath(file.endsWith('.ips') ? file : `${file}.ips`);
    if (existsSync(outPath) && !opts.force) {
      console.error(
        chalk.red(
          `error: ${shortPath(outPath)} already exists — pass --force to overwrite`,
        ),
      );
      process.exit(2);
    }
    writeFileSync(outPath, ipsTemplate(opts.title), { encoding: 'utf-8' });
    process.stderr.write(chalk.gray(`✓ wrote ${shortPath(outPath)}\n`));
  });

function ipsTemplate(title: string): string {
  const safe = title.replace(/[\\"]/g, '\\$&');
  return [
    '#pragma winedit',
    '#include "inpa.h"',
    '',
    'inpainit()',
    '{',
    `  settitle("${safe}");`,
    '}',
    '',
    'inpaexit()',
    '{',
    '}',
    '',
  ].join('\n');
}

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
  | { kind: 'file'; file: string }
  | { kind: 'dir'; dir: string }
  | { kind: 'next-to-source' };

function resolveOutputTarget(
  files: string[],
  output: string | undefined,
  isBatch: boolean,
): OutputTarget {
  if (!output) return { kind: 'next-to-source' };
  const abs = resolvePath(output);
  if (isBatch) {
    let isDir = false;
    try {
      isDir = statSync(abs).isDirectory();
    } catch {
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
