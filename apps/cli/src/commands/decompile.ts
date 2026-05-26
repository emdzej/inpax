/**
 * `inpax decompile <file>` — print BEST/2 bytecode as readable
 * assembly. Library functions in @emdzej/inpax-dis keep the
 * `disassemble*` name; only the CLI surface changed.
 */
import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'node:fs';
import chalk from 'chalk';
import { parseIpo } from '@emdzej/inpax-parser';
import { disassembleIpo, disassembleFunction, type DisassemblyOptions } from '@emdzej/inpax-dis';
import { decompile } from '@emdzej/inpax-decompiler';

export const decompileCommand = new Command('decompile')
  .description('Decompile IPO bytecode into readable assembly or .IPS-like source')
  .argument('<file>', 'IPO file to decompile')
  .option('-o, --output <file>', 'Output file (default: stdout)')
  .option('-f, --function <name>', 'Decompile a specific function only (assembly mode)')
  .option(
    '--ips',
    'Reconstruct IPS-like source instead of assembly (lifts FRAME+CALL → function calls, JMPZ patterns → if/else/while)',
    false,
  )
  .option('--no-color', 'Disable colored output')
  .option('--no-raw', 'Hide raw hex bytes')
  .option('--no-comments', 'Hide comments')
  .option('--no-labels', 'Do not resolve jump labels')
  .action(async (file, options) => {
    try {
      const buffer = readFileSync(file);

      console.error(chalk.gray(`Parsing ${file}...`));
      const ipo = parseIpo(buffer);

      console.error(chalk.gray(`Version: ${ipo.header.versionHi}.${ipo.header.versionLo}`));
      console.error(chalk.gray(`Functions: ${ipo.functions.size}`));
      console.error();

      // --ips picks the source-level decompiler; everything else
      // remains assembly mode. --function applies to assembly only —
      // the source-level emitter walks the full IPO.
      if (options.ips) {
        if (options.function) {
          console.error(
            chalk.yellow(
              'warning: --function is ignored in --ips mode (source-level emitter walks the full IPO)\n',
            ),
          );
        }
        const source = decompile(ipo);
        if (options.output) {
          writeFileSync(options.output, source);
          console.error(chalk.green(`Output written to ${options.output}`));
        } else {
          console.log(source);
        }
        return;
      }

      const disOptions: DisassemblyOptions = {
        showRaw: options.raw !== false,
        showAddress: true,
        resolveLabels: options.labels !== false,
        showComments: options.comments !== false,
        noColor: options.noColor || options.output, // No colors when outputting to file
      };

      let lines: string[];

      if (options.function) {
        // Disassemble specific function
        const func = Array.from(ipo.functions.values()).find(
          f => f.header.name === options.function
        );

        if (!func) {
          console.error(chalk.red(`Function not found: ${options.function}`));
          console.error(chalk.gray('Available functions:'));
          for (const [, f] of ipo.functions) {
            console.error(chalk.gray(`  - ${f.header.name}`));
          }
          process.exit(1);
        }

        lines = disassembleFunction(func, ipo, disOptions);
      } else {
        // Disassemble entire file
        lines = disassembleIpo(ipo, disOptions);
      }

      const output = lines.join('\n');

      if (options.output) {
        writeFileSync(options.output, output);
        console.error(chalk.green(`Output written to ${options.output}`));
      } else {
        console.log(output);
      }

    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });
