#!/usr/bin/env node
/**
 * INPAX CLI
 * Unified command-line interface for IPO toolchain
 */
import { Command } from 'commander';
import { disasmCommand } from './commands/disasm.js';
import { runCommand } from './commands/run.js';
import { infoCommand } from './commands/info.js';
import { compileCommand } from './commands/compile.js';

const program = new Command();

program
  .name('inpax')
  .description('INPAX - IPO bytecode toolchain')
  .version('0.1.0');

// Register commands
program.addCommand(disasmCommand);
program.addCommand(runCommand);
program.addCommand(infoCommand);
program.addCommand(compileCommand);

// Parse and execute
program.parse();
