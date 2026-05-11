/**
 * INPA INI Parser
 * 
 * Parses INI files with INPA-specific format:
 * - Comments: // (C++ style)
 * - Sections: [SECTION_NAME]
 * - Key-value pairs: KEY=value or KEY = value
 * - Multi-value entries: ENTRY=code,description,
 */

export interface IniSection {
  [key: string]: string | string[];
}

export interface IniFile {
  [section: string]: IniSection;
}

export interface ParseOptions {
  /** Treat duplicate keys as arrays (default: true) */
  arrayDuplicates?: boolean;
  /** Trim whitespace from values (default: true) */
  trimValues?: boolean;
  /** Include empty values (default: false) */
  includeEmpty?: boolean;
}

const DEFAULT_OPTIONS: Required<ParseOptions> = {
  arrayDuplicates: true,
  trimValues: true,
  includeEmpty: false,
};

/**
 * Parse INI content string into structured object
 */
export function parse(content: string, options: ParseOptions = {}): IniFile {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const result: IniFile = {};
  
  let currentSection = '';
  const lines = content.split(/\r?\n/);
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // Remove comments (// style)
    const commentIndex = line.indexOf('//');
    if (commentIndex !== -1) {
      line = line.slice(0, commentIndex);
    }
    
    // Trim whitespace
    line = line.trim();
    
    // Skip empty lines
    if (!line) continue;
    
    // Section header: [SECTION_NAME]
    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      if (!result[currentSection]) {
        result[currentSection] = {};
      }
      continue;
    }
    
    // Key=Value pair
    const eqIndex = line.indexOf('=');
    if (eqIndex !== -1) {
      const key = line.slice(0, eqIndex).trim();
      let value = line.slice(eqIndex + 1);
      
      if (opts.trimValues) {
        value = value.trim();
      }
      
      // Skip empty values unless configured otherwise
      if (!value && !opts.includeEmpty) continue;
      
      // Handle duplicate keys as arrays
      if (currentSection && key) {
        const section = result[currentSection] || (result[currentSection] = {});
        
        if (opts.arrayDuplicates && key in section) {
          const existing = section[key];
          if (Array.isArray(existing)) {
            existing.push(value);
          } else {
            section[key] = [existing, value];
          }
        } else {
          section[key] = value;
        }
      }
    }
  }
  
  return result;
}

/**
 * Stringify INI object back to INI format
 */
export function stringify(data: IniFile, options: { comment?: string } = {}): string {
  const lines: string[] = [];
  
  if (options.comment) {
    lines.push(`// ${options.comment}`);
    lines.push('');
  }
  
  for (const [section, entries] of Object.entries(data)) {
    lines.push(`[${section}]`);
    
    for (const [key, value] of Object.entries(entries)) {
      if (Array.isArray(value)) {
        for (const v of value) {
          lines.push(`${key}=${v}`);
        }
      } else {
        lines.push(`${key}=${value}`);
      }
    }
    
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Get a value from parsed INI, with optional default
 */
export function get(ini: IniFile, section: string, key: string): string | string[] | undefined;
export function get(ini: IniFile, section: string, key: string, defaultValue: string): string;
export function get(ini: IniFile, section: string, key: string, defaultValue?: string): string | string[] | undefined {
  const value = ini[section]?.[key];
  if (value === undefined) return defaultValue;
  return value;
}

/**
 * Get first value if key has multiple values
 */
export function getFirst(ini: IniFile, section: string, key: string): string | undefined {
  const value = ini[section]?.[key];
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Get all values as array (even if single)
 */
export function getAll(ini: IniFile, section: string, key: string): string[] {
  const value = ini[section]?.[key];
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Check if section exists
 */
export function hasSection(ini: IniFile, section: string): boolean {
  return section in ini;
}

/**
 * Check if key exists in section
 */
export function hasKey(ini: IniFile, section: string, key: string): boolean {
  return ini[section]?.[key] !== undefined;
}

/**
 * Get all section names
 */
export function sections(ini: IniFile): string[] {
  return Object.keys(ini);
}

/**
 * Get all keys in a section
 */
export function keys(ini: IniFile, section: string): string[] {
  return Object.keys(ini[section] || {});
}
