export * from './ast/index.js';
export * from './lexer/index.js';
export * from './parser/index.js';
export * from './semantic/index.js';
export * from './codegen/index.js';
export * from './writer/index.js';
export * from './preprocessor/index.js';
export {
  DEFAULT_SOURCE_ENCODING,
  canonicalEncoding,
  decodeBytes,
  isEncodingSupported,
} from './encoding.js';

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
  /**
   * Encoding used when the default `fileReader` reads `#include`d
   * files from disk. The caller's own `source` string is already
   * decoded — this only affects includes. Defaults to `cp1252`
   * (matches every BMW German script we've inspected). Ignored when
   * `fileReader` is overridden — the custom reader is responsible
   * for its own decoding.
   */
  encoding?: string;
  /** Test hook: virtual file system for `#include` resolution. */
  fileReader?: PreprocessOptions['fileReader'];
}

export function compile(source: string, options: CompileOptions = {}): Uint8Array {
  const preprocessed = preprocess(source, {
    filePath: options.filePath,
    includePaths: options.includePaths,
    encoding: options.encoding,
    fileReader: options.fileReader,
  });
  const tokens = tokenize(preprocessed);
  const ast = parse(tokens);
  const symbols = analyze(ast);
  const result = runCodegen(symbols);
  return writeIpo(result);
}
