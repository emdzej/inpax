#!/usr/bin/env node
/**
 * INPAX CLI
 * Unified command-line interface for IPO toolchain
 */
import { Command } from 'commander';
import { VERSION } from '@inpax/core';
import { disCommand } from './commands/dis.js';
import { runCommand } from './commands/run.js';
import { infoCommand } from './commands/info.js';
import { compileCommand } from './commands/compile.js';

const program = new Command();

program
  .name('inpax')
  .description('INPAX - IPO bytecode toolchain')
  .version(VERSION.INPAX);

// Register commands
program.addCommand(disCommand);
program.addCommand(runCommand);
program.addCommand(infoCommand);
program.addCommand(compileCommand);

// Parse and execute
program.parse();
