#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import { compile } from '@emdzej/inpax-compiler';

interface CompileFlags {
  output?: string;
  verbose?: boolean;
  include?: string[];
}

const program = new Command();

program
  .name('inpax-compile')
  .description('Compile INPA IPS source files into IPO bytecode')
  .version('0.0.0');

program
  .argument('<file>', 'IPS source file')
  .option('-o, --output <file>', 'output IPO file (default: <file>.ipo)')
  .option(
    '-I, --include <dir>',
    'add directory to #include search path (repeatable)',
    (value: string, prev: string[] = []) => prev.concat(value),
    [] as string[],
  )
  .option('-v, --verbose', 'print extra info to stderr')
  .action((file: string, opts: CompileFlags) => {
    const inputPath = resolvePath(file);
    const outputPath = opts.output
      ? resolvePath(opts.output)
      : inputPath.replace(/\.ips$/i, '.ipo');

    let source: string;
    try {
      source = readFileSync(inputPath, 'utf-8');
    } catch (err) {
      console.error(chalk.red(`error: cannot read ${inputPath}`));
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }

    let bytes: Uint8Array;
    try {
      bytes = compile(source, {
        filePath: inputPath,
        includePaths: opts.include ?? [],
      });
    } catch (err) {
      console.error(chalk.red(`error: ${(err as Error).message}`));
      process.exit(1);
    }

    try {
      writeFileSync(outputPath, bytes);
    } catch (err) {
      console.error(chalk.red(`error: cannot write ${outputPath}`));
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }

    if (opts.verbose) {
      process.stderr.write(
        chalk.gray(`compiled ${inputPath} -> ${outputPath} (${bytes.byteLength} bytes)\n`),
      );
    }
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(chalk.red((err as Error).message));
  process.exit(1);
});
