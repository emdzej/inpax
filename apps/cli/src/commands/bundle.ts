/**
 * `inpax bundle <input-dir>` — curate a BMW install (INPA / EDIABAS /
 * NCS) into a small zip web tools can import into OPFS. Plus
 * `inpax bundle init` to scaffold a starter `.bimmerzignore`.
 * Subsumes what used to ship as the separate `bimmerz-bundle` binary.
 */
import { resolve } from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import { bundle, writeDefaultIgnore } from './bundle/bundle.js';

interface BundleCliOptions {
  output: string;
  ignore?: string;
  /** Commander flips `--no-default-ignore` to `defaultIgnore: false`. */
  defaultIgnore?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
}

export const bundleCommand = new Command('bundle')
  .description(
    'Walk a BMW install (INPA / EDIABAS / NCS), apply .bimmerzignore, write a zip',
  )
  .argument('<input-dir>', 'BMW install root (e.g. C:\\, ~/inpa, ~/ncs)')
  .argument(
    '[output]',
    'Output zip path — positional alias for --output. Wins when both are given.',
  )
  .option(
    '-o, --output <file>',
    'Path to the output zip',
    './bimmerz-bundle.zip',
  )
  .option(
    '-i, --ignore <file>',
    'Path to a gitignore-style file. Defaults to <input-dir>/.bimmerzignore if present.',
  )
  .option(
    '--no-default-ignore',
    'Skip the built-in install-junk patterns (only your --ignore file applies)',
  )
  .option(
    '--dry-run',
    "Walk + match but don't write the zip. Prints what would be kept.",
  )
  .option(
    '--verbose',
    'Log every kept and skipped file (slow on large installs)',
  )
  .action(async (inputDir: string, outputArg: string | undefined, opts: BundleCliOptions) => {
    try {
      const start = Date.now();
      let lastTick = start;
      let keptSinceTick = 0;
      let bytesSinceTick = 0;
      const outputPath = outputArg ?? opts.output;

      const summary = await bundle({
        input: inputDir,
        output: outputPath,
        ignoreFile: opts.ignore,
        noDefaultIgnore: opts.defaultIgnore === false,
        dryRun: opts.dryRun ?? false,
        onProgress: (ev) => {
          if (opts.verbose) {
            if (ev.kind === 'kept') {
              process.stdout.write(
                `${chalk.green('+')} ${ev.file.relativePath} ${chalk.gray(`(${formatBytes(ev.file.size)})`)}\n`,
              );
            } else {
              process.stdout.write(
                `${chalk.red('-')} ${ev.absolutePath} ${chalk.gray(`[${ev.reason}]`)}\n`,
              );
            }
            return;
          }
          if (ev.kind !== 'kept') return;
          keptSinceTick++;
          bytesSinceTick += ev.file.size;
          const now = Date.now();
          if (now - lastTick > 250) {
            process.stderr.write(
              `\r${chalk.cyan('…')} kept ${keptSinceTick} files (${formatBytes(bytesSinceTick)} so far)        `,
            );
            lastTick = now;
          }
        },
      });

      if (!opts.verbose) {
        process.stderr.write('\r' + ' '.repeat(60) + '\r');
      }

      const elapsedMs = Date.now() - start;
      const out: string[] = [];
      out.push(chalk.bold('Done.'));
      out.push(
        `  kept    : ${chalk.green(summary.filesKept.toString())} files (${formatBytes(summary.bytesKept)})`,
      );
      out.push(`  skipped : ${chalk.gray(summary.filesSkipped.toString())} files`);
      if (summary.outputPath) {
        out.push(`  output  : ${chalk.cyan(summary.outputPath)}`);
      } else {
        out.push(chalk.gray('  (dry-run, no zip written)'));
      }
      out.push(`  elapsed : ${(elapsedMs / 1000).toFixed(2)}s`);
      out.push('');
      if (summary.filesKept === 0) {
        out.push(
          chalk.yellow(
            'Warning: no files passed the filter. Check your .bimmerzignore — ' +
              'negations may be over-eager.',
          ),
        );
      }
      if (summary.bytesKept > 500 * 1024 * 1024) {
        out.push(
          chalk.yellow(
            `Warning: bundle is ${formatBytes(summary.bytesKept)} uncompressed. ` +
              'Tighten .bimmerzignore or pick a narrower input subtree.',
          ),
        );
      }
      process.stdout.write(out.join('\n') + '\n');
    } catch (err) {
      process.stderr.write(chalk.red(`Error: ${(err as Error).message}\n`));
      process.exitCode = 1;
    }
  });

// `inpax bundle init` — scaffold a starter .bimmerzignore. Same role
// `git init` has of writing a sample .gitignore: discoverable,
// editable, source of truth shared with the `--no-default-ignore`
// flag's built-in list.
bundleCommand
  .command('init')
  .description(
    'Write the default exclude patterns to a .bimmerzignore template ' +
      'for the user to edit before running `bundle`.',
  )
  .argument('[path]', 'Where to write the template', '.bimmerzignore')
  .option('-f, --force', 'Overwrite an existing file', false)
  .action(async (path: string, opts: { force?: boolean }) => {
    try {
      await writeDefaultIgnore(path, opts.force ?? false);
      const target = resolve(path);
      process.stdout.write(
        chalk.green('Wrote ') +
          chalk.cyan(target) +
          chalk.gray(
            ' — edit it, then run:\n' +
              '  inpax bundle <your-install-dir> --ignore ' +
              path +
              '\n',
          ),
      );
    } catch (err) {
      process.stderr.write(chalk.red(`Error: ${(err as Error).message}\n`));
      process.exitCode = 1;
    }
  });

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
