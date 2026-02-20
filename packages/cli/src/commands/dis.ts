/**
 * Disassemble command
 */
import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'node:fs';
import chalk from 'chalk';

export const disCommand = new Command('dis')
  .description('Disassemble IPO bytecode file')
  .argument('<file>', 'IPO file to disassemble')
  .option('-o, --output <file>', 'Output file (default: stdout)')
  .option('-f, --function <name>', 'Disassemble specific function')
  .option('--raw', 'Show raw hex bytes')
  .action(async (file, options) => {
    // try {
    //   const buffer = new Uint8Array(readFileSync(file));
    //   const header = parseIPOHeader(buffer);

    //   // Validate magic
    //   if (header.magic !== 0x4F5049) { // "IPO" in LE
    //     console.error(chalk.red('Error: Not a valid IPO file'));
    //     process.exit(1);
    //   }

    //   console.log(chalk.bold('=== IPO Disassembly ==='));
    //   console.log(`File: ${file}`);
    //   console.log(`Version: ${header.version}`);
    //   console.log();

    //   // Read job table
    //   const view = new DataView(buffer.buffer);
    //   const jobsOffset = header.jobsOffset;

    //   if (jobsOffset === 0) {
    //     console.log(chalk.yellow('No jobs found'));
    //     return;
    //   }

    //   // Simple disassembly - iterate through code
    //   const codeStart = Math.max(
    //     header.tablesOffset,
    //     header.jobsOffset,
    //     header.stringTableOffset,
    //     0x100
    //   );

    //   console.log(chalk.bold('--- Code ---'));
    //   let offset = codeStart;
    //   let instructionCount = 0;

    //   while (offset < buffer.length && instructionCount < 1000) {
    //     const opcode = buffer[offset];
    //     const info = getOpcodeInfo(opcode);

    //     // Format output
    //     const addr = chalk.gray(`0x${offset.toString(16).padStart(4, '0')}:`);
    //     const hex = options.raw
    //       ? chalk.cyan(buffer.slice(offset, offset + 1 + info.operandBytes)
    //           .reduce((s, b) => s + b.toString(16).padStart(2, '0') + ' ', ''))
    //       : '';
    //     const mnemonic = chalk.green(info.mnemonic.padEnd(12));

    //     let operand = '';
    //     if (info.operandBytes === 2) {
    //       operand = chalk.yellow(`0x${view.getUint16(offset + 1, true).toString(16)}`);
    //     } else if (info.operandBytes === 4) {
    //       operand = chalk.yellow(view.getInt32(offset + 1, true).toString());
    //     }

    //     console.log(`${addr} ${hex}${mnemonic} ${operand}`);

    //     offset += 1 + info.operandBytes;
    //     instructionCount++;

    //     // Stop at EOF
    //     if (opcode === 0xFF) break;
    //   }

    //   console.log();
    //   console.log(chalk.gray(`${instructionCount} instructions`));

    //   // Write output if requested
    //   if (options.output) {
    //     // TODO: implement file output
    //     console.log(chalk.green(`Output written to ${options.output}`));
    //   }

    // } catch (error) {
    //   console.error(chalk.red(`Error: ${(error as Error).message}`));
    //   process.exit(1);
    // }
  });
