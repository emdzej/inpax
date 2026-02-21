/**
 * INPA-specific INI types and parsers
 */

import { parse, getFirst, getAll } from './ini-parser.js';
import type { IniFile } from './ini-parser.js';

// === INPA.INI Types ===

export interface InpaConfig {
  info: {
    version: string;
    date: string;
    variant: string;
  };
  environ: {
    printer: string;
    pem: boolean;
    language: string;
  };
  script: {
    editor: string;
    scriptSelect: string;
    defini: string;
  };
  config: {
    title: string;
    fKeys: FKeyConfig[];
  };
}

export interface FKeyConfig {
  key: number;
  script: string;
  text: string;
  archive?: string;
  button?: string;
}

/**
 * Parse INPA.INI configuration file
 */
export function parseInpaConfig(content: string): InpaConfig {
  const ini = parse(content);
  
  const fKeys: FKeyConfig[] = [];
  const config = ini['CONFIG'] || {};
  
  // Parse F-key entries (F1-F10, with optional modifiers)
  for (let i = 1; i <= 10; i++) {
    const script = config[`F${i}`];
    if (script && typeof script === 'string') {
      fKeys.push({
        key: i,
        script,
        text: (config[`F${i}_Text`] || config[`F${i}_TEXT`] || script) as string,
        archive: config[`F${i}_ARCHIV`] as string | undefined,
        button: config[`F${i}_KNOPF`] as string | undefined,
      });
    }
  }
  
  return {
    info: {
      version: getFirst(ini, 'INFO', 'VERSION') || '',
      date: getFirst(ini, 'INFO', 'DATUM') || '',
      variant: getFirst(ini, 'INFO', 'VARIANTE') || '',
    },
    environ: {
      printer: getFirst(ini, 'ENVIRON', 'DRUCKER') || 'WIN',
      pem: (getFirst(ini, 'ENVIRON', 'PEM') || '').toUpperCase() === 'JA',
      language: getFirst(ini, 'ENVIRON', 'LANGUAGE') || 'ENGLISH',
    },
    script: {
      editor: getFirst(ini, 'SCRIPT', 'EDITOR') || 'WIN',
      scriptSelect: getFirst(ini, 'SCRIPT', 'SCRIPTSELECT') || 'LIST',
      defini: getFirst(ini, 'SCRIPT', 'DEFINI') || '',
    },
    config: {
      title: getFirst(ini, 'CONFIG', 'TITEL') || 'INPA',
      fKeys,
    },
  };
}

// === Group Config Types (E46.ENG, etc.) ===

export interface MenuEntry {
  code: string;
  description: string;
  isEmpty: boolean;
}

export interface MenuSection {
  name: string;
  description: string;
  entries: MenuEntry[];
}

export interface GroupConfig {
  sections: MenuSection[];
}

/**
 * Parse ENTRY values: "code,description," or ",," for separator
 */
function parseEntry(value: string): MenuEntry {
  const parts = value.split(',');
  const code = (parts[0] || '').trim();
  const description = (parts[1] || '').trim();
  
  return {
    code,
    description,
    isEmpty: !code && !description,
  };
}

/**
 * Parse group config files (E46.ENG, E39.GER, etc.)
 */
export function parseGroupConfig(content: string): GroupConfig {
  const ini = parse(content);
  const sections: MenuSection[] = [];
  
  for (const [sectionName, sectionData] of Object.entries(ini)) {
    const description = (sectionData['DESCRIPTION'] || sectionName) as string;
    const entries: MenuEntry[] = [];
    
    // Get all ENTRY values
    const entryValues = getAll(ini, sectionName, 'ENTRY');
    for (const value of entryValues) {
      entries.push(parseEntry(value));
    }
    
    sections.push({
      name: sectionName,
      description,
      entries,
    });
  }
  
  return { sections };
}

/**
 * Find root menu section
 */
export function findRootSection(config: GroupConfig): MenuSection | undefined {
  return config.sections.find(s => s.name === 'ROOT' || s.name.startsWith('ROOT'));
}

/**
 * Find section by name pattern
 */
export function findSection(config: GroupConfig, pattern: string | RegExp): MenuSection | undefined {
  if (typeof pattern === 'string') {
    return config.sections.find(s => s.name === pattern);
  }
  return config.sections.find(s => pattern.test(s.name));
}

/**
 * Get all non-empty entries from a section
 */
export function getValidEntries(section: MenuSection): MenuEntry[] {
  return section.entries.filter(e => !e.isEmpty);
}
