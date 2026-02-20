/**
 * Token types for INPA IPS language
 */
export enum TokenType {
  // Literals
  INTEGER = 'INTEGER',
  REAL = 'REAL',
  STRING = 'STRING',
  IDENTIFIER = 'IDENTIFIER',

  // Keywords - Types
  BOOL = 'BOOL',
  BYTE = 'BYTE',
  INT = 'INT',
  LONG = 'LONG',
  REAL_TYPE = 'REAL_TYPE',
  STRING_TYPE = 'STRING_TYPE',

  // Keywords - Blocks
  SCREEN = 'SCREEN',
  MENU = 'MENU',
  STATEMACHINE = 'STATEMACHINE',
  LOGICTABLE = 'LOGICTABLE',
  LINE = 'LINE',
  ITEM = 'ITEM',
  STATE = 'STATE',

  // Keywords - Control Flow
  IF = 'IF',
  THEN = 'THEN',
  ELSE = 'ELSE',
  ELSEIF = 'ELSEIF',
  ENDIF = 'ENDIF',
  WHILE = 'WHILE',
  WEND = 'WEND',
  FOR = 'FOR',
  TO = 'TO',
  STEP = 'STEP',
  NEXT = 'NEXT',
  REPEAT = 'REPEAT',
  UNTIL = 'UNTIL',
  SELECT = 'SELECT',
  CASE = 'CASE',
  DEFAULT = 'DEFAULT',
  ENDSELECT = 'ENDSELECT',

  // Keywords - Declarations
  VAR = 'VAR',
  CONST = 'CONST',
  GLOBAL = 'GLOBAL',
  LOCAL = 'LOCAL',
  FUNCTION = 'FUNCTION',
  ENDFUNC = 'ENDFUNC',
  RETURN = 'RETURN',
  EXIT = 'EXIT',
  
  // Keywords - Import/External
  IMPORT = 'IMPORT',
  EXTERNAL = 'EXTERNAL',
  OUT = 'OUT',
  INOUT = 'INOUT',
  IN = 'IN',
  
  // Keywords - UI Blocks
  ENDSCREEN = 'ENDSCREEN',
  ENDMENU = 'ENDMENU',
  ENDSTATEMACHINE = 'ENDSTATEMACHINE',
  ENDLOGICTABLE = 'ENDLOGICTABLE',
  CONTROL = 'CONTROL',
  
  // Pragmas
  PRAGMA = 'PRAGMA',
  INCLUDE = 'INCLUDE',

  // Keywords - Logical
  AND = 'AND',
  OR = 'OR',
  NOT = 'NOT',
  TRUE = 'TRUE',
  FALSE = 'FALSE',

  // Operators
  PLUS = 'PLUS',           // +
  MINUS = 'MINUS',         // -
  STAR = 'STAR',           // *
  SLASH = 'SLASH',         // /
  PERCENT = 'PERCENT',     // %
  ASSIGN = 'ASSIGN',       // =
  EQ = 'EQ',               // ==
  NE = 'NE',               // != or <>
  LT = 'LT',               // <
  LE = 'LE',               // <=
  GT = 'GT',               // >
  GE = 'GE',               // >=
  BAND = 'BAND',           // &
  BOR = 'BOR',             // |
  BXOR = 'BXOR',           // ^

  // Delimiters
  LPAREN = 'LPAREN',       // (
  RPAREN = 'RPAREN',       // )
  LBRACKET = 'LBRACKET',   // [
  RBRACKET = 'RBRACKET',   // ]
  COMMA = 'COMMA',         // ,
  COLON = 'COLON',         // :
  SEMICOLON = 'SEMICOLON', // ;
  DOT = 'DOT',             // .

  // Special
  NEWLINE = 'NEWLINE',
  EOF = 'EOF',
  COMMENT = 'COMMENT',
}

/**
 * Token with position info
 */
export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

/**
 * Source location
 */
export interface SourceLocation {
  line: number;
  column: number;
  offset: number;
}

/**
 * Keywords map
 */
export const KEYWORDS: Record<string, TokenType> = {
  // Types
  'bool': TokenType.BOOL,
  'byte': TokenType.BYTE,
  'int': TokenType.INT,
  'long': TokenType.LONG,
  'real': TokenType.REAL_TYPE,
  'string': TokenType.STRING_TYPE,

  // Blocks
  'screen': TokenType.SCREEN,
  'menu': TokenType.MENU,
  'statemachine': TokenType.STATEMACHINE,
  'logictable': TokenType.LOGICTABLE,
  'line': TokenType.LINE,
  'item': TokenType.ITEM,
  'state': TokenType.STATE,

  // Control flow
  'if': TokenType.IF,
  'then': TokenType.THEN,
  'else': TokenType.ELSE,
  'elseif': TokenType.ELSEIF,
  'endif': TokenType.ENDIF,
  'while': TokenType.WHILE,
  'wend': TokenType.WEND,
  'for': TokenType.FOR,
  'to': TokenType.TO,
  'step': TokenType.STEP,
  'next': TokenType.NEXT,
  'repeat': TokenType.REPEAT,
  'until': TokenType.UNTIL,
  'select': TokenType.SELECT,
  'case': TokenType.CASE,
  'default': TokenType.DEFAULT,
  'endselect': TokenType.ENDSELECT,

  // Declarations
  'var': TokenType.VAR,
  'const': TokenType.CONST,
  'global': TokenType.GLOBAL,
  'local': TokenType.LOCAL,
  'function': TokenType.FUNCTION,
  'endfunc': TokenType.ENDFUNC,
  'return': TokenType.RETURN,
  'exit': TokenType.EXIT,
  
  // Import/External
  'import': TokenType.IMPORT,
  'external': TokenType.EXTERNAL,
  'out': TokenType.OUT,
  'inout': TokenType.INOUT,
  'in': TokenType.IN,
  
  // UI block ends
  'endscreen': TokenType.ENDSCREEN,
  'endmenu': TokenType.ENDMENU,
  'endstatemachine': TokenType.ENDSTATEMACHINE,
  'endlogictable': TokenType.ENDLOGICTABLE,
  'control': TokenType.CONTROL,

  // Logical
  'and': TokenType.AND,
  'or': TokenType.OR,
  'not': TokenType.NOT,
  'true': TokenType.TRUE,
  'false': TokenType.FALSE,
};
