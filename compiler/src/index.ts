export * from './lexer/index.js';
export * from './parser/index.js';
export * from './ast/index.js';
export * from './codegen/index.js';

import { tokenize } from './lexer/index.js';
import { parse } from './parser/index.js';
import { generate } from './codegen/index.js';

/**
 * Compile IPS source to IPO binary
 */
export function compile(source: string): Buffer {
  const tokens = tokenize(source);
  const ast = parse(tokens);
  return generate(ast);
}
