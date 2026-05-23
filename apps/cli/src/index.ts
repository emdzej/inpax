#!/usr/bin/env node
/**
 * INPAX CLI — one binary subsuming the whole toolchain.
 *
 * Subcommands:
 *   inpax decompile   — print BEST/2 bytecode as readable assembly
 *   inpax run         — run an .ipo against a real or simulated ECU
 *   inpax compile     — IPS source → IPO bytecode (with `compile new` scaffold)
 *   inpax edit        — Ink-based TUI for editing constants in a compiled .ipo
 *   inpax patch       — non-interactive constant patches (init / apply)
 *   inpax bundle      — curate a BMW install into a small zip (with `bundle init`)
 *
 * The compile / edit+patch / bundle paths used to ship as the separate
 * `@emdzej/inpax-compiler`, `@emdzej/inpax-ipo-editor`, and
 * `@emdzej/bimmerz-bundler` binaries; they're now subcommands of the
 * single `inpax` tool so users only install one global package.
 */
import { Command } from 'commander';
import { decompileCommand } from './commands/decompile.js';
import { runCommand } from './commands/run.js';
import { compileCommand } from './commands/compile.js';
import { editCommand, patchCommand } from './commands/edit.js';
import { bundleCommand } from './commands/bundle.js';

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
program.addCommand(bundleCommand);

program.parseAsync(process.argv).catch((err) => {
  process.stderr.write(`Fatal: ${(err as Error).message}\n`);
  process.exit(2);
});
