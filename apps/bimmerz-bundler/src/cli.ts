#!/usr/bin/env node
import { resolve } from "node:path";

import chalk from "chalk";
import { Command } from "commander";

import { bundle, writeDefaultIgnore } from "./bundle.js";

const program = new Command();

program
  .name("bimmerz-bundle")
  .description(
    "Curate a BMW software install (INPA / EDIABAS / NCS) into a " +
      "small zip web tools (inpax-web, future ediabasx-web, future " +
      "ncsx) can import into OPFS. Exclude patterns follow " +
      "gitignore semantics and are matched case-insensitively.",
  )
  .version("0.1.0");

// ---- `bundle` (default command) ----

program
  .command("bundle", { isDefault: true })
  .description("Walk install, apply .bimmerzignore, write zip")
  .argument(
    "<input-dir>",
    "BMW install root (e.g. C:\\, ~/inpa, ~/ncs)",
  )
  .argument(
    "[output]",
    "Output zip path — positional alias for --output. Wins when both are given.",
  )
  .option(
    "-o, --output <file>",
    "Path to the output zip",
    "./bimmerz-bundle.zip",
  )
  .option(
    "-i, --ignore <file>",
    "Path to a gitignore-style file. Defaults to <input-dir>/.bimmerzignore if present.",
  )
  .option(
    "--no-default-ignore",
    "Skip the built-in install-junk patterns (only your --ignore file applies)",
  )
  .option(
    "--dry-run",
    "Walk + match but don't write the zip. Prints what would be kept.",
  )
  .option(
    "--verbose",
    "Log every kept and skipped file (slow on large installs; pipe through less or > log.txt)",
  )
  .action(
    async (
      inputDir: string,
      outputArg: string | undefined,
      opts: BundleCliOptions,
    ) => {
    try {
      const start = Date.now();
      let lastTick = start;
      let keptSinceTick = 0;
      let bytesSinceTick = 0;

      // Positional `output` arg wins over the `--output` flag so
      // `bimmerz-bundle install.dir my-bundle.zip` does the
      // intuitive thing without -o. Falls back to the flag's value
      // (which has a default itself).
      const outputPath = outputArg ?? opts.output;

      const summary = await bundle({
        input: inputDir,
        output: outputPath,
        ignoreFile: opts.ignore,
        noDefaultIgnore: opts.defaultIgnore === false,
        dryRun: opts.dryRun ?? false,
        onProgress: (ev) => {
          if (opts.verbose) {
            if (ev.kind === "kept") {
              process.stdout.write(
                `${chalk.green("+")} ${ev.file.relativePath} ${chalk.gray(`(${formatBytes(ev.file.size)})`)}\n`,
              );
            } else {
              process.stdout.write(
                `${chalk.red("-")} ${ev.absolutePath} ${chalk.gray(`[${ev.reason}]`)}\n`,
              );
            }
            return;
          }
          // Non-verbose: throttled progress line so the user sees
          // something on big installs. One update per ~250 ms.
          if (ev.kind !== "kept") return;
          keptSinceTick++;
          bytesSinceTick += ev.file.size;
          const now = Date.now();
          if (now - lastTick > 250) {
            process.stderr.write(
              `\r${chalk.cyan("…")} kept ${keptSinceTick} files (${formatBytes(bytesSinceTick)} so far)        `,
            );
            lastTick = now;
          }
        },
      });

      if (!opts.verbose) {
        // Clear the progress line.
        process.stderr.write("\r" + " ".repeat(60) + "\r");
      }

      const elapsedMs = Date.now() - start;
      const out: string[] = [];
      out.push(chalk.bold("Done."));
      out.push(
        `  kept    : ${chalk.green(summary.filesKept.toString())} files (${formatBytes(summary.bytesKept)})`,
      );
      out.push(
        `  skipped : ${chalk.gray(summary.filesSkipped.toString())} files`,
      );
      if (summary.outputPath) {
        out.push(`  output  : ${chalk.cyan(summary.outputPath)}`);
      } else {
        out.push(chalk.gray("  (dry-run, no zip written)"));
      }
      out.push(`  elapsed : ${(elapsedMs / 1000).toFixed(2)}s`);
      out.push("");
      if (summary.filesKept === 0) {
        out.push(
          chalk.yellow(
            "Warning: no files passed the filter. Check your .bimmerzignore — " +
              "negations may be over-eager.",
          ),
        );
      }
      if (summary.bytesKept > 500 * 1024 * 1024) {
        out.push(
          chalk.yellow(
            `Warning: bundle is ${formatBytes(summary.bytesKept)} uncompressed. ` +
              "Tighten .bimmerzignore or pick a narrower input subtree.",
          ),
        );
      }
      process.stdout.write(out.join("\n") + "\n");
    } catch (err) {
      process.stderr.write(
        chalk.red(`Error: ${(err as Error).message}\n`),
      );
      process.exitCode = 1;
    }
  },
  );

// ---- `init` ----
//
// Writes the canonical default-ignore patterns to disk so users have
// a starter template to edit. Mirrors `git init` writing a sample
// `.gitignore` — discoverable, editable, and the contents are the
// same source of truth as the built-in `--no-default-ignore` layer.

program
  .command("init")
  .description(
    "Write the default exclude patterns to a .bimmerzignore template " +
      "for the user to edit before running `bundle`.",
  )
  .argument("[path]", "Where to write the template", ".bimmerzignore")
  .option("-f, --force", "Overwrite an existing file", false)
  .action(async (path: string, opts: { force?: boolean }) => {
    try {
      await writeDefaultIgnore(path, opts.force ?? false);
      const target = resolve(path);
      process.stdout.write(
        chalk.green("Wrote ") +
          chalk.cyan(target) +
          chalk.gray(
            " — edit it, then run:\n" +
              "  bimmerz-bundle <your-install-dir> --ignore " +
              path +
              "\n",
          ),
      );
    } catch (err) {
      process.stderr.write(
        chalk.red(`Error: ${(err as Error).message}\n`),
      );
      process.exitCode = 1;
    }
  });

program.parseAsync().catch((err) => {
  process.stderr.write(chalk.red(`Fatal: ${(err as Error).message}\n`));
  process.exit(2);
});

// ---- helpers ----

interface BundleCliOptions {
  output: string;
  ignore?: string;
  /** Commander flips `--no-default-ignore` to `defaultIgnore: false`. */
  defaultIgnore?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
