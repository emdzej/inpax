/**
 * CLI handlers for `ipo-editor patch init` and `ipo-editor patch apply`.
 *
 * Pure imperative glue between commander, filesystem, and the patch
 * library — no business logic here.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve as resolvePath } from 'node:path';
import chalk from 'chalk';
import { canonicalCodepage, isCodepageSupported } from '../lib/codepage.js';
import { walkIpo } from '../lib/walker.js';
import { initPatch } from './init.js';
import { applyPatches } from './apply.js';
import { patchToYaml, patchFromYaml } from './serialize.js';
import type { ConflictPolicy, ConstantType } from './types.js';

export interface InitFlags {
  output?: string;
  inputEncoding?: string;
  targetEncoding?: string;
  types?: string;
  withNotes?: boolean;
  location?: string;
  description?: string;
}

const VALID_TYPES = new Set<ConstantType>(['bool', 'byte', 'int', 'long', 'real', 'string']);

function parseTypes(raw: string | undefined): ConstantType[] {
  if (!raw) return ['string'];
  const parts = raw.split(',').map((s) => s.trim().toLowerCase());
  const out: ConstantType[] = [];
  for (const p of parts) {
    if (!VALID_TYPES.has(p as ConstantType)) {
      throw new Error(`unknown type '${p}' — expected one of: ${[...VALID_TYPES].join(', ')}`);
    }
    out.push(p as ConstantType);
  }
  return out;
}

export function runPatchInit(file: string, opts: InitFlags): void {
  const filePath = resolvePath(file);
  const inputEncoding = canonicalCodepage(opts.inputEncoding ?? 'cp1252');
  const targetEncoding = canonicalCodepage(opts.targetEncoding ?? 'cp1252');

  if (!isCodepageSupported(inputEncoding)) {
    console.error(chalk.red(`unsupported input encoding: ${opts.inputEncoding}`));
    process.exit(2);
  }
  if (!isCodepageSupported(targetEncoding)) {
    console.error(chalk.red(`unsupported target encoding: ${opts.targetEncoding}`));
    process.exit(2);
  }

  const types = parseTypes(opts.types);

  const bytes = readFileSync(filePath);
  const walk = walkIpo(bytes, inputEncoding);

  const doc = initPatch(walk, {
    name: basename(filePath),
    location: opts.location ?? 'unknown',
    targetEncoding,
    types,
    withNotes: opts.withNotes === true,
    description: opts.description,
  });

  const yaml = patchToYaml(doc);
  const outputPath = opts.output ?? `${filePath}.patch.yaml`;
  writeFileSync(outputPath, yaml, 'utf8');

  console.log(chalk.green(`Wrote ${chalk.cyan(outputPath)}`));
  console.log(chalk.gray(`  ${doc.patches.length} entries (types: ${types.join(', ')})`));
  console.log(chalk.gray(`  original sha256: ${doc.original.checksum.value}`));

  // Stock INPA always reads .ipo strings as cp1252 — see
  // docs/research/ipo-encoding.md. Warn at init time so a translator
  // building a non-cp1252 patch knows the resulting file won't render
  // correctly in real INPA.
  if (targetEncoding !== 'cp1252') {
    console.warn(
      chalk.yellow(
        `warning: target_encoding is '${targetEncoding}', not cp1252. Stock INPA.exe will misrender strings in the patched IPO (it always reads .ipo as cp1252). Our own tooling can still read it with --input-encoding ${targetEncoding}.`,
      ),
    );
  }
}

export interface ApplyFlags {
  output?: string;
  dryRun?: boolean;
  ignoreChecksum?: boolean;
  onConflict?: string;
  inputEncoding?: string;
  outputEncoding?: string;
}

function parseConflict(raw: string | undefined): ConflictPolicy {
  if (raw === undefined) return 'refuse';
  const v = raw.trim().toLowerCase();
  if (v === 'refuse' || v === 'last-wins') return v;
  throw new Error(`unknown --on-conflict value '${raw}' — expected 'refuse' or 'last-wins'`);
}

export function runPatchApply(file: string, patchPaths: string[], opts: ApplyFlags): void {
  if (patchPaths.length === 0) {
    console.error(chalk.red('apply: at least one patch file required'));
    process.exit(2);
  }
  const filePath = resolvePath(file);
  const inputEncoding = canonicalCodepage(opts.inputEncoding ?? 'cp1252');
  if (!isCodepageSupported(inputEncoding)) {
    console.error(chalk.red(`unsupported input encoding: ${opts.inputEncoding}`));
    process.exit(2);
  }
  if (opts.outputEncoding && !isCodepageSupported(canonicalCodepage(opts.outputEncoding))) {
    console.error(chalk.red(`unsupported output encoding: ${opts.outputEncoding}`));
    process.exit(2);
  }

  const policy = parseConflict(opts.onConflict);

  const bytes = readFileSync(filePath);
  const walk = walkIpo(bytes, inputEncoding);

  const patches = patchPaths.map((p) => {
    const text = readFileSync(p, 'utf8');
    return patchFromYaml(text);
  });

  const result = applyPatches(walk, {
    patches,
    ignoreChecksum: opts.ignoreChecksum === true,
    onConflict: policy,
    outputEncodingOverride: opts.outputEncoding
      ? canonicalCodepage(opts.outputEncoding)
      : undefined,
  });

  for (const w of result.warnings) {
    console.warn(chalk.yellow(`warning: ${w}`));
  }

  console.log(
    chalk.green(`Would apply ${result.effectiveEdits.size} edits across ${patches.length} patch(es)`),
  );
  for (const [idx, value] of result.effectiveEdits) {
    const display = typeof value === 'string' ? JSON.stringify(value) : String(value);
    console.log(chalk.gray(`  const[${idx}] = ${display}`));
  }

  if (opts.dryRun) {
    console.log(chalk.gray('--dry-run: not writing output'));
    return;
  }

  const outputPath = resolvePath(opts.output ?? filePath);
  writeFileSync(outputPath, result.bytes);
  console.log(chalk.green(`Wrote ${chalk.cyan(outputPath)}`));
}
