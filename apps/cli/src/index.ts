#!/usr/bin/env node
/**
 * INPAX CLI — one binary subsuming the INPA toolchain.
 *
 * Subcommands:
 *   inpax decompile   — print BEST/2 bytecode as readable assembly
 *   inpax run         — run an .ipo against a real or simulated ECU
 *   inpax compile     — IPS source → IPO bytecode (with `compile new` scaffold)
 *   inpax edit        — Ink-based TUI for editing constants in a compiled .ipo
 *   inpax patch       — non-interactive constant patches (init / apply)
 *
 * Bundle and data-management commands live in the separate
 * `@emdzej/bimmerz-cli` package (`bimmerz bundle`, `bimmerz data`).
 */
import { Command } from 'commander';
import { configureLogger } from '@emdzej/bimmerz-logger';
import { resolveLoggerConfig } from './utils/logger-config.js';
import { decompileCommand } from './commands/decompile.js';
import { runCommand } from './commands/run.js';
import { compileCommand } from './commands/compile.js';
import { editCommand, patchCommand } from './commands/edit.js';

// Configure the central bimmerz-logger from env vars BEFORE any
// command runs. The logger library never reads `process.env` (it
// has to stay browser-portable); the CLI is the host that
// translates env vars (`INPAX_LOG_LEVEL`,
// `INPAX_LOG_CATEGORIES`, `INPAX_LOG_DESTINATION`,
// `INPAX_LOG_FORMAT`) into a `LoggerConfig`.
configureLogger(
  resolveLoggerConfig({
    env: process.env,
    isTty: process.stdout.isTTY ?? false,
  }),
);

const program = new Command();

program
  .name('inpax')
  .description(
    'inpax — decompile, run, compile, edit, patch, and bundle INPA scripts',
  )
  .version('0.6.8');

program.addCommand(decompileCommand);
program.addCommand(runCommand);
program.addCommand(compileCommand);
program.addCommand(editCommand);
program.addCommand(patchCommand);

program.parseAsync(process.argv).catch((err) => {
  process.stderr.write(`Fatal: ${(err as Error).message}\n`);
  process.exit(2);
});
