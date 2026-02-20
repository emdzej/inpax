/**
 * Token types for INPA IPS language (C-like syntax)
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

  // Keywords - Control Flow
  IF = 'IF',
  ELSE = 'ELSE',
  WHILE = 'WHILE',
  FOR = 'FOR',
  RETURN = 'RETURN',
  BREAK = 'BREAK',
  CONTINUE = 'CONTINUE',

  // Keywords - UI Blocks
  SCREEN = 'SCREEN',
  MENU = 'MENU',
  LINE = 'LINE',
  ITEM = 'ITEM',
  INIT = 'INIT',

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
  NE = 'NE',               // !=
  LT = 'LT',               // <
  LE = 'LE',               // <=
  GT = 'GT',               // >
  GE = 'GE',               // >=
  BAND = 'BAND',           // &
  BOR = 'BOR',             // |
  BXOR = 'BXOR',           // ^
  LAND = 'LAND',           // &&
  LOR = 'LOR',             // ||
  LNOT = 'LNOT',           // !
  PLUSPLUS = 'PLUSPLUS',   // ++
  MINUSMINUS = 'MINUSMINUS', // --

  // Delimiters
  LPAREN = 'LPAREN',       // (
  RPAREN = 'RPAREN',       // )
  LBRACE = 'LBRACE',       // {
  RBRACE = 'RBRACE',       // }
  LBRACKET = 'LBRACKET',   // [
  RBRACKET = 'RBRACKET',   // ]
  COMMA = 'COMMA',         // ,
  COLON = 'COLON',         // :
  SEMICOLON = 'SEMICOLON', // ;
  DOT = 'DOT',             // .

  // Preprocessor
  HASH = 'HASH',           // #
  PRAGMA = 'PRAGMA',
  INCLUDE = 'INCLUDE',

  // Special
  EOF = 'EOF',
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
 * Keywords map (case-insensitive)
 */
export const KEYWORDS: Record<string, TokenType> = {
  // Types
  'bool': TokenType.BOOL,
  'byte': TokenType.BYTE,
  'int': TokenType.INT,
  'long': TokenType.LONG,
  'real': TokenType.REAL_TYPE,
  'string': TokenType.STRING_TYPE,

  // Control flow
  'if': TokenType.IF,
  'else': TokenType.ELSE,
  'while': TokenType.WHILE,
  'for': TokenType.FOR,
  'return': TokenType.RETURN,
  'break': TokenType.BREAK,
  'continue': TokenType.CONTINUE,

  // UI blocks
  'screen': TokenType.SCREEN,
  'menu': TokenType.MENU,
  'line': TokenType.LINE,
  'item': TokenType.ITEM,
  'init': TokenType.INIT,

  // Logical
  'and': TokenType.AND,
  'or': TokenType.OR,
  'not': TokenType.NOT,
  'true': TokenType.TRUE,
  'false': TokenType.FALSE,

  // Preprocessor (after #)
  'pragma': TokenType.PRAGMA,
  'include': TokenType.INCLUDE,
};
