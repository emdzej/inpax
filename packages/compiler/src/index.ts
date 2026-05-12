export * from './ast/index.js';
export * from './lexer/index.js';
export * from './parser/index.js';
export * from './semantic/index.js';
export * from './codegen/index.js';
export * from './writer/index.js';
export * from './preprocessor/index.js';

import { preprocess, PreprocessOptions } from './preprocessor/index.js';
import { tokenize } from './lexer/index.js';
import { parse } from './parser/index.js';
import { analyze } from './semantic/index.js';
import { compile as runCodegen } from './codegen/index.js';
import { writeIpo } from './writer/index.js';

export interface CompileOptions {
  /** Absolute path of the source — anchors `#include` lookup. */
  filePath?: string;
  /** Search roots for `#include`, scanned after the source's own dir. */
  includePaths?: string[];
  /** Test hook: virtual file system for `#include` resolution. */
  fileReader?: PreprocessOptions['fileReader'];
}

export function compile(source: string, options: CompileOptions = {}): Uint8Array {
  const preprocessed = preprocess(source, {
    filePath: options.filePath,
    includePaths: options.includePaths,
    fileReader: options.fileReader,
  });
  const tokens = tokenize(preprocessed);
  const ast = parse(tokens);
  const symbols = analyze(ast);
  const result = runCodegen(symbols);
  return writeIpo(result);
}
