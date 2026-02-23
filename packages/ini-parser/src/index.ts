/**
 * @emdzej/inpax-ini-parser
 * INI file parser for INPA configuration files
 */

export {
  parse,
  parseFile,
  parseFileSync,
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
