#!/usr/bin/env node
/**
 * INPAX CLI
 *
 * Unified command-line interface for inspecting and running INPA IPO
 * scripts. IPS source compilation lives in `@emdzej/inpax-compiler`
 * (separate app) so this binary stays focused on read / run.
 */
import { Command } from 'commander';
import { disasmCommand } from './commands/disasm.js';
import { runCommand } from './commands/run.js';
import { infoCommand } from './commands/info.js';

const program = new Command();

program
  .name('inpax')
  .description('inpax — disassemble, inspect, and run INPA .IPO scripts')
  .version('0.3.0');

// Register commands
program.addCommand(disasmCommand);
program.addCommand(runCommand);
program.addCommand(infoCommand);

// Parse and execute
program.parse();
