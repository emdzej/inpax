#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { parseIpo } from '@inpax/parser';
import { disassembleIpo, disassembleFunction } from './format/index.js';

const args = process.argv.slice(2);
const input = args.find(a => !a.startsWith('-'));
const output = args.includes('-o') ? args[args.indexOf('-o') + 1] : undefined;
const funcName = args.includes('-f') ? args[args.indexOf('-f') + 1] : undefined;
const listOnly = args.includes('-l');
const infoOnly = args.includes('-i');
const showRaw = args.includes('--raw');

if (!input || args.includes('-h')) {
  console.log(`inpax-dis - IPO Disassembler

Usage: inpax-dis <file.ipo> [options]

Options:
  -o <file>   Output to file
  -f <name>   Disassemble single function
  -l          List functions only
  -i          Show file info only
  --raw       Show raw bytes
  -h          Help`);
  process.exit(args.includes('-h') ? 0 : 1);
}

const buffer = readFileSync(input);
const ipo = parseIpo(buffer);

if (infoOnly) {
  console.log(`Version: ${ipo.header.versionHi}.${ipo.header.versionLo}`);
  console.log(`Globals: ${ipo.globals.types.length}`);
  console.log(`Constants: ${ipo.constants.values.length}`);
  console.log(`Functions: ${ipo.functions.size}`);
  process.exit(0);
}

if (listOnly) {
  console.log('ID    Name                           Instructions');
  console.log('----  -----------------------------  ------------');
  for (const [id, f] of [...ipo.functions.entries()].sort((a,b) => a[0]-b[0])) {
    console.log(`${id.toString().padStart(4)}  ${f.header.name.padEnd(29)}  ${f.instructions.length}`);
  }
  process.exit(0);
}

let lines: string[];
if (funcName) {
  const func = [...ipo.functions.values()].find(f => f.header.name === funcName)
    || ipo.functions.get(parseInt(funcName));
  if (!func) { console.error(`Function not found: ${funcName}`); process.exit(1); }
  lines = disassembleFunction(func, ipo, { showRaw });
} else {
  lines = disassembleIpo(ipo, { showRaw });
}

const out = lines.join('\n');
if (output) {
  writeFileSync(output, out);
  console.log(`Wrote ${lines.length} lines to ${output}`);
} else {
  console.log(out);
}
