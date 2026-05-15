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
import { runPatchInit, runPatchApply } from './patch/cli.js';

interface EditFlags {
  codepage?: string;
  /** Set to `false` when `--no-backup` is passed (commander semantics). */
  backup?: boolean;
  allowFfi?: boolean;
  readonly?: boolean;
}

const program = new Command();

program
  .name('ipo-editor')
  .description('Edit constants in compiled INPA .ipo files; init and apply patch files')
  .version('0.0.0');

// ---- `edit` (default command) ----
program
  .command('edit', { isDefault: true })
  .description('Open a TUI to edit constants interactively')
  .argument('<file>', '.ipo file to open')
  .option('--codepage <name>', 'codepage for string decode/encode', 'cp1252')
  .option('--no-backup', 'do not write <file>.bak on save')
  .option('--allow-ffi', 'allow editing strings that look like FFI descriptors')
  .option('--readonly', 'view only — no edits or save')
  .action((file: string, opts: EditFlags) => {
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

// ---- `patch` (subcommand group) ----
const patchCmd = program
  .command('patch')
  .description('Create or apply translation/override patches for .ipo files');

patchCmd
  .command('init')
  .description('Emit a starter patch file listing the IPO\'s current constants')
  .argument('<file>', '.ipo file to scan')
  .option('-o, --output <path>', 'output patch path (default: <file>.patch.yaml)')
  .option('--input-encoding <name>', 'codepage used to decode strings in the IPO', 'cp1252')
  .option(
    '--target-encoding <name>',
    'codepage strings will be encoded into when this patch is applied',
    'cp1252',
  )
  .option(
    '--types <list>',
    'comma-separated constant types to include (bool,byte,int,long,real,string)',
    'string',
  )
  .option('--with-notes', 'add per-entry notes with offset/length info', false)
  .option('--location <name>', 'install-tree label (inpa, nfs, ncsexpert, …)', 'unknown')
  .option('--description <text>', 'free-form description carried in the patch')
  .action((file: string, opts) => {
    try {
      runPatchInit(file, opts);
    } catch (err) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

patchCmd
  .command('apply')
  .description('Apply one or more patch files to an .ipo and write the result')
  .argument('<file>', '.ipo file to patch')
  .argument('<patches...>', 'one or more YAML patch files')
  .option('-o, --output <path>', 'output .ipo path (default: overwrite input)')
  .option('--dry-run', 'verify and report changes without writing', false)
  .option(
    '--ignore-checksum',
    'apply even if a patch\'s checksum does not match the IPO',
    false,
  )
  .option(
    '--on-conflict <policy>',
    'how to handle overlapping entries: refuse | last-wins',
    'refuse',
  )
  .option('--input-encoding <name>', 'codepage for decoding the IPO', 'cp1252')
  .option(
    '--output-encoding <name>',
    'override the patches\' target_encoding when writing strings',
  )
  .action((file: string, patches: string[], opts) => {
    try {
      runPatchApply(file, patches, opts);
    } catch (err) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(chalk.red((err as Error).message));
  process.exit(1);
});
