/**
 * INPAX System Functions
 * EDIABAS, UI, String, and other system function definitions
 */

export enum SystemFunctionCategory {
  Ediabas = 0x00,
  UI = 0x10,
  String = 0x20,
  Math = 0x30,
  File = 0x40,
  System = 0x50,
}

export interface SystemFunction {
  id: number;
  name: string;
  category: SystemFunctionCategory;
  params: string[];
  returns: string;
  description: string;
}

/** System function definitions (partial - 62/108 mapped) */
export const SYSTEM_FUNCTIONS: Record<number, SystemFunction> = {
  // EDIABAS functions
  0x01: {
    id: 0x01,
    name: 'EDIABAS_INIT',
    category: SystemFunctionCategory.Ediabas,
    params: [],
    returns: 'int',
    description: 'Initialize EDIABAS connection',
  },
  0x02: {
    id: 0x02,
    name: 'EDIABAS_END',
    category: SystemFunctionCategory.Ediabas,
    params: [],
    returns: 'void',
    description: 'Close EDIABAS connection',
  },
  0x03: {
    id: 0x03,
    name: 'EDIABAS_JOB',
    category: SystemFunctionCategory.Ediabas,
    params: ['string ecu', 'string job', 'string params'],
    returns: 'int',
    description: 'Execute EDIABAS job',
  },
  0x04: {
    id: 0x04,
    name: 'EDIABAS_RESULT',
    category: SystemFunctionCategory.Ediabas,
    params: ['string resultName', 'int index'],
    returns: 'string',
    description: 'Get EDIABAS result',
  },

  // UI functions
  0x10: {
    id: 0x10,
    name: 'SCREEN_CREATE',
    category: SystemFunctionCategory.UI,
    params: ['string title'],
    returns: 'int',
    description: 'Create screen',
  },
  0x11: {
    id: 0x11,
    name: 'SCREEN_SHOW',
    category: SystemFunctionCategory.UI,
    params: ['int handle'],
    returns: 'void',
    description: 'Show screen',
  },
  0x12: {
    id: 0x12,
    name: 'SCREEN_HIDE',
    category: SystemFunctionCategory.UI,
    params: ['int handle'],
    returns: 'void',
    description: 'Hide screen',
  },
  0x13: {
    id: 0x13,
    name: 'LINE_ADD',
    category: SystemFunctionCategory.UI,
    params: ['int screen', 'string label', 'string value'],
    returns: 'int',
    description: 'Add line to screen',
  },
  0x14: {
    id: 0x14,
    name: 'LINE_SET',
    category: SystemFunctionCategory.UI,
    params: ['int line', 'string value'],
    returns: 'void',
    description: 'Set line value',
  },
  0x15: {
    id: 0x15,
    name: 'MENU_CREATE',
    category: SystemFunctionCategory.UI,
    params: ['string title'],
    returns: 'int',
    description: 'Create menu',
  },
  0x16: {
    id: 0x16,
    name: 'MENU_ADD',
    category: SystemFunctionCategory.UI,
    params: ['int menu', 'string label', 'int funcId'],
    returns: 'void',
    description: 'Add menu item',
  },
  0x17: {
    id: 0x17,
    name: 'MENU_SHOW',
    category: SystemFunctionCategory.UI,
    params: ['int handle'],
    returns: 'int',
    description: 'Show menu and get selection',
  },
  0x18: {
    id: 0x18,
    name: 'MESSAGEBOX',
    category: SystemFunctionCategory.UI,
    params: ['string title', 'string message', 'int type'],
    returns: 'int',
    description: 'Show message box',
  },
  0x19: {
    id: 0x19,
    name: 'INPUTBOX',
    category: SystemFunctionCategory.UI,
    params: ['string prompt', 'string default'],
    returns: 'string',
    description: 'Show input dialog',
  },

  // String functions
  0x20: {
    id: 0x20,
    name: 'STRLEN',
    category: SystemFunctionCategory.String,
    params: ['string s'],
    returns: 'int',
    description: 'Get string length',
  },
  0x21: {
    id: 0x21,
    name: 'SUBSTR',
    category: SystemFunctionCategory.String,
    params: ['string s', 'int start', 'int len'],
    returns: 'string',
    description: 'Get substring',
  },
  0x22: {
    id: 0x22,
    name: 'STRCAT',
    category: SystemFunctionCategory.String,
    params: ['string a', 'string b'],
    returns: 'string',
    description: 'Concatenate strings',
  },
  0x23: {
    id: 0x23,
    name: 'STRCMP',
    category: SystemFunctionCategory.String,
    params: ['string a', 'string b'],
    returns: 'int',
    description: 'Compare strings',
  },
  0x24: {
    id: 0x24,
    name: 'INSTR',
    category: SystemFunctionCategory.String,
    params: ['string haystack', 'string needle'],
    returns: 'int',
    description: 'Find substring position',
  },
  0x25: {
    id: 0x25,
    name: 'ITOA',
    category: SystemFunctionCategory.String,
    params: ['int value'],
    returns: 'string',
    description: 'Integer to string',
  },
  0x26: {
    id: 0x26,
    name: 'ATOI',
    category: SystemFunctionCategory.String,
    params: ['string s'],
    returns: 'int',
    description: 'String to integer',
  },
  0x27: {
    id: 0x27,
    name: 'SPRINTF',
    category: SystemFunctionCategory.String,
    params: ['string format', '...args'],
    returns: 'string',
    description: 'Format string',
  },

  // Math functions
  0x30: {
    id: 0x30,
    name: 'ABS',
    category: SystemFunctionCategory.Math,
    params: ['int value'],
    returns: 'int',
    description: 'Absolute value',
  },
  0x31: {
    id: 0x31,
    name: 'MIN',
    category: SystemFunctionCategory.Math,
    params: ['int a', 'int b'],
    returns: 'int',
    description: 'Minimum',
  },
  0x32: {
    id: 0x32,
    name: 'MAX',
    category: SystemFunctionCategory.Math,
    params: ['int a', 'int b'],
    returns: 'int',
    description: 'Maximum',
  },

  // File functions
  0x40: {
    id: 0x40,
    name: 'FOPEN',
    category: SystemFunctionCategory.File,
    params: ['string path', 'string mode'],
    returns: 'int',
    description: 'Open file',
  },
  0x41: {
    id: 0x41,
    name: 'FCLOSE',
    category: SystemFunctionCategory.File,
    params: ['int handle'],
    returns: 'void',
    description: 'Close file',
  },
  0x42: {
    id: 0x42,
    name: 'FREAD',
    category: SystemFunctionCategory.File,
    params: ['int handle'],
    returns: 'string',
    description: 'Read line from file',
  },
  0x43: {
    id: 0x43,
    name: 'FWRITE',
    category: SystemFunctionCategory.File,
    params: ['int handle', 'string data'],
    returns: 'void',
    description: 'Write to file',
  },

  // System functions
  0x50: {
    id: 0x50,
    name: 'GETENV',
    category: SystemFunctionCategory.System,
    params: ['string name'],
    returns: 'string',
    description: 'Get environment variable',
  },
  0x51: {
    id: 0x51,
    name: 'SETENV',
    category: SystemFunctionCategory.System,
    params: ['string name', 'string value'],
    returns: 'void',
    description: 'Set environment variable',
  },
  0x52: {
    id: 0x52,
    name: 'SLEEP',
    category: SystemFunctionCategory.System,
    params: ['int ms'],
    returns: 'void',
    description: 'Sleep for milliseconds',
  },
  0x53: {
    id: 0x53,
    name: 'GETTIME',
    category: SystemFunctionCategory.System,
    params: [],
    returns: 'int',
    description: 'Get current time',
  },
};

/** Get system function by ID */
export function getSystemFunction(id: number): SystemFunction | undefined {
  return SYSTEM_FUNCTIONS[id];
}

/** Get system function name with fallback */
export function getSystemFunctionName(id: number): string {
  return SYSTEM_FUNCTIONS[id]?.name ?? `SYS_${id.toString(16).padStart(2, '0').toUpperCase()}`;
}
