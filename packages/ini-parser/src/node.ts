/**
 * Node-only INI file loaders.
 *
 * Lives in a separate subpath (`@emdzej/inpax-ini-parser/node`) so the
 * browser entry never pulls `node:fs/promises` into its bundle. Web
 * consumers read the file bytes through their own host APIs
 * (`FileSystemFileHandle`, `<input type=file>` etc.) and pass the
 * resulting string straight to `parse()` from the main entry.
 */

import { parse, type IniFile, type ParseOptions } from './ini-parser.js';

/**
 * Asynchronously read and parse an INI file from disk.
 */
export async function parseFile(
  path: string,
  options?: ParseOptions
): Promise<IniFile> {
  const fs = await import('node:fs/promises');
  const content = await fs.readFile(path, 'utf-8');
  return parse(content, options);
}

/**
 * Synchronously read and parse an INI file from disk.
 */
export function parseFileSync(path: string, options?: ParseOptions): IniFile {
  // `require` is Node-only — by living in this subpath we keep that
  // dependency away from any browser bundle that imports the main entry.
  const fs = require('node:fs') as typeof import('node:fs');
  const content = fs.readFileSync(path, 'utf-8');
  return parse(content, options);
}
