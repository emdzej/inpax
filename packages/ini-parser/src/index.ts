/**
 * @emdzej/inpax-ini-parser
 * INI file parser for INPA configuration files
 */

export {
  parse,
  stringify,
  get,
  getFirst,
  getAll,
  hasSection,
  hasKey,
  sections,
  keys,
  type IniFile,
  type IniSection,
  type ParseOptions,
} from './ini-parser.js';
// `parseFile` / `parseFileSync` live under `@emdzej/inpax-ini-parser/node`
// — Node-only so browser bundles don't pull `fs` into the static graph.

export {
  parseInpaConfig,
  parseGroupConfig,
  findRootSection,
  findSection,
  getValidEntries,
  type InpaConfig,
  type FKeyConfig,
  type MenuEntry,
  type MenuSection,
  type GroupConfig,
} from './inpa-config.js';
