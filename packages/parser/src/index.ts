/**
 * INPA IPO Bytecode Interpreter
 *
 * @example
 * ```typescript
 * import { parseIpo } from '@emdzej/inpax-parser';
 * import { readFileSync } from 'fs';
 *
 * const buffer = readFileSync('script.ipo');
 * const ipo = parseIpo(buffer);
 * ```
 */

export * from './parser/index.js';

