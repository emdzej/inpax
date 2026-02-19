/**
 * INPA IPO Bytecode Interpreter
 * 
 * @example
 * ```typescript
 * import { parseIpo, VM } from '@inpax/interpreter';
 * import { readFileSync } from 'fs';
 * 
 * const buffer = readFileSync('script.ipo');
 * const ipo = parseIpo(buffer);
 * const vm = new VM(ipo);
 * vm.run();
 * ```
 */

export * from './types/index.js';
export * from './parser/index.js';
export * from './vm/index.js';
export * from './runtime/index.js';
