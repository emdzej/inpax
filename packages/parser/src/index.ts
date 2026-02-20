/**
 * INPA IPO Bytecode Interpreter
 *
 * @example
 * ```typescript
 * import { parseIpo } from '@inpax/parser';
 * import { readFileSync } from 'fs';
 *
 * const buffer = readFileSync('script.ipo');
 * const ipo = parseIpo(buffer);
 * ```
 */

export * from './parser/index.js';

