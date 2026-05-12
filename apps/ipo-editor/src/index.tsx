#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import React from 'react';
import { render } from 'ink';
import { Command } from 'commander';
import chalk from 'chalk';
import { canonicalCodepage, isCodepageSupported } from './lib/codepage.js';
import { looksLikeCp125x, walkIpo } from './lib/walker.js';
import { App } from './components/App.js';

interface Flags {
  codepage?: string;
  /** Set to `false` when `--no-backup` is passed (commander semantics). */
  backup?: boolean;
  allowFfi?: boolean;
  readonly?: boolean;
}

const program = new Command();

program
  .name('ipo-editor')
  .description('Terminal UI for editing constants in compiled INPA .ipo files')
  .version('0.0.0');

program
  .argument('<file>', '.ipo file to open')
  .option('--codepage <name>', 'codepage for string decode/encode', 'cp1252')
  .option('--no-backup', 'do not write <file>.bak on save')
  .option('--allow-ffi', 'allow editing strings that look like FFI descriptors')
  .option('--readonly', 'view only — no edits or save')
  .action((file: string, opts: Flags) => {
    const filePath = resolvePath(file);

    const codepage = canonicalCodepage(opts.codepage ?? 'cp1252');
    if (!isCodepageSupported(codepage)) {
      console.error(chalk.red(`unknown codepage: ${opts.codepage}`));
      process.exit(2);
    }

    let bytes: Uint8Array;
    try {
      bytes = readFileSync(filePath);
    } catch (err) {
      console.error(chalk.red(`cannot read ${filePath}: ${(err as Error).message}`));
      process.exit(1);
    }

    let walk: ReturnType<typeof walkIpo>;
    try {
      walk = walkIpo(bytes, codepage);
    } catch (err) {
      console.error(chalk.red(`not a valid .ipo file: ${(err as Error).message}`));
      process.exit(1);
    }

    // Boot heuristic — show a hint if the constant pool contains bytes
    // that would render as gibberish in plain Latin-1 but make sense
    // under cp125x.
    let hint: string | undefined;
    if (codepage === 'iso-8859-1' && looksLikeCp125x(bytes, walk.constantsBlock)) {
      hint =
        'bytes 0x80–0x9F detected — file may be cp1252 (German) or cp1250 (Polish). Reopen with --codepage cp125x.';
    }

    render(
      <App
        filePath={filePath}
        walk={walk}
        readonly={opts.readonly === true}
        allowFfi={opts.allowFfi === true}
        // commander turns `--no-backup` into `opts.backup === false`;
        // omitting the flag leaves it undefined → backup ON by default.
        backup={opts.backup !== false}
        initialHint={hint}
      />,
      { exitOnCtrlC: true },
    );
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(chalk.red((err as Error).message));
  process.exit(1);
});
