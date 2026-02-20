/**
 * Info command - display IPO file structure
 */
import { Command } from 'commander';
import { readFileSync, statSync } from 'node:fs';
import chalk from 'chalk';
import { parseIPOHeader, readCString, WELL_KNOWN_FUNCTIONS } from '@inpax/core';

export const infoCommand = new Command('info')
  .description('Display IPO file information')
  .argument('<file>', 'IPO file to analyze')
  .option('--functions', 'List all functions')
  .option('--strings', 'List string table')
  .option('--hex', 'Show hex dump of header')
  .action(async (file, options) => {
    try {
      const buffer = new Uint8Array(readFileSync(file));
      const stat = statSync(file);
      const header = parseIPOHeader(buffer);
      const view = new DataView(buffer.buffer);

      console.log(chalk.bold('=== IPO File Info ==='));
      console.log();
      
      // Basic info
      console.log(chalk.cyan('File:'), file);
      console.log(chalk.cyan('Size:'), `${stat.size} bytes`);
      console.log();

      // Header info
      console.log(chalk.bold('Header:'));
      console.log(`  Magic:         0x${header.magic.toString(16)} (${header.magic === 0x4F5049 ? chalk.green('valid') : chalk.red('invalid')})`);
      console.log(`  Version:       ${header.version}`);
      console.log(`  Flags:         0x${header.flags.toString(16)}`);
      console.log();

      // Offsets
      console.log(chalk.bold('Section Offsets:'));
      console.log(`  Tables:        0x${header.tablesOffset.toString(16).padStart(4, '0')}`);
      console.log(`  Jobs:          0x${header.jobsOffset.toString(16).padStart(4, '0')}`);
      console.log(`  Job Desc:      0x${header.jobDescOffset.toString(16).padStart(4, '0')}`);
      console.log(`  Info Block:    0x${header.infoBlockOffset.toString(16).padStart(4, '0')}`);
      console.log(`  String Table:  0x${header.stringTableOffset.toString(16).padStart(4, '0')}`);
      console.log();

      // Functions
      if (options.functions || !options.strings) {
        console.log(chalk.bold('Functions:'));
        
        // Try to read job table
        if (header.jobsOffset > 0 && header.jobsOffset < buffer.length) {
          const jobCount = view.getUint16(header.jobsOffset, true);
          console.log(`  Count: ${jobCount}`);
          
          let offset = header.jobsOffset + 2;
          for (let i = 0; i < Math.min(jobCount, 50); i++) {
            const funcId = view.getUint16(offset, true);
            const funcOffset = view.getUint32(offset + 2, true);
            const funcSize = view.getUint32(offset + 6, true);
            
            const knownName = WELL_KNOWN_FUNCTIONS[funcId as keyof typeof WELL_KNOWN_FUNCTIONS];
            const name = knownName || `func_${funcId}`;
            
            console.log(`  ${chalk.yellow(i.toString().padStart(3))}: ${chalk.green(name.padEnd(20))} @ 0x${funcOffset.toString(16).padStart(4, '0')} (${funcSize} bytes)`);
            
            offset += 10; // Assume 10 bytes per entry
          }
        } else {
          console.log(chalk.gray('  No job table found'));
        }
        console.log();
      }

      // Strings
      if (options.strings) {
        console.log(chalk.bold('String Table:'));
        
        if (header.stringTableOffset > 0 && header.stringTableOffset < buffer.length) {
          const stringCount = view.getUint16(header.stringTableOffset, true);
          console.log(`  Count: ${stringCount}`);
          
          let offset = header.stringTableOffset + 2;
          for (let i = 0; i < Math.min(stringCount, 100) && offset < buffer.length; i++) {
            const str = readCString(buffer, offset, 64);
            const displayStr = str.length > 40 ? str.slice(0, 40) + '...' : str;
            console.log(`  ${chalk.yellow(i.toString().padStart(3))}: "${chalk.white(displayStr)}"`);
            offset += str.length + 1;
          }
        } else {
          console.log(chalk.gray('  No string table found'));
        }
        console.log();
      }

      // Hex dump
      if (options.hex) {
        console.log(chalk.bold('Header Hex Dump (first 256 bytes):'));
        for (let i = 0; i < Math.min(256, buffer.length); i += 16) {
          const addr = chalk.gray(i.toString(16).padStart(4, '0') + ':');
          const hex = Array.from(buffer.slice(i, i + 16))
            .map(b => b.toString(16).padStart(2, '0'))
            .join(' ');
          const ascii = Array.from(buffer.slice(i, i + 16))
            .map(b => b >= 32 && b < 127 ? String.fromCharCode(b) : '.')
            .join('');
          console.log(`${addr} ${chalk.cyan(hex.padEnd(48))} ${chalk.gray(ascii)}`);
        }
      }

    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });
