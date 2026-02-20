#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { compile, tokenize, parse } from './index.js';

const args = process.argv.slice(2);
const input = args.find(a => !a.startsWith('-'));
const output = args.includes('-o') ? args[args.indexOf('-o') + 1] : undefined;
const tokensOnly = args.includes('--tokens');
const astOnly = args.includes('--ast');

if (!input || args.includes('-h')) {
  console.log(`inpax-compile - IPS to IPO Compiler

Usage: inpax-compile <file.ips> [options]

Options:
  -o <file>   Output IPO file (default: input.ipo)
  --tokens    Show tokens only
  --ast       Show AST only
  -h          Help`);
  process.exit(args.includes('-h') ? 0 : 1);
}

try {
  const source = readFileSync(input, 'utf-8');

  if (tokensOnly) {
    const tokens = tokenize(source);
    for (const t of tokens) {
      console.log(`${t.line}:${t.column} ${t.type} ${JSON.stringify(t.value)}`);
    }
    process.exit(0);
  }

  if (astOnly) {
    const tokens = tokenize(source);
    const ast = parse(tokens);
    console.log(JSON.stringify(ast, null, 2));
    process.exit(0);
  }

  const ipo = compile(source);
  const outFile = output || input.replace(/\.ips$/i, '.ipo');
  writeFileSync(outFile, ipo);
  console.log(`Compiled ${input} -> ${outFile} (${ipo.length} bytes)`);

} catch (error) {
  console.error('Error:', error instanceof Error ? error.message : error);
  process.exit(1);
}
