/**
 * Token taxonomy for the IPS language.
 *
 * The lexer is deliberately permissive: keywords are matched
 * case-insensitively (so `SCREEN` and `screen` are equivalent — INPACOMP
 * accepts both), and the parser later decides which contexts demand the
 * upper-case spelling.
 */

export type TokenKind =
  // literals
  | 'INT' | 'REAL' | 'STRING' | 'IDENT' | 'BITPATTERN'
  // type keywords
  | 'BOOL_T' | 'BYTE_T' | 'INT_T' | 'LONG_T' | 'REAL_T' | 'STRING_T'
  | 'STRUCTURE_T'
  // control flow
  | 'IF' | 'ELSE' | 'WHILE' | 'FOR' | 'RETURN' | 'BREAK' | 'CONTINUE'
  // UI / language blocks
  | 'SCREEN' | 'MENU' | 'LINE' | 'ITEM' | 'INIT'
  | 'STATEMACHINE' | 'LOGTABLE' | 'CONTROL' | 'OTHER'
  // imports
  | 'IMPORT' | 'IMPORT32' | 'LIB' | 'EXTERN'
  // directions
  | 'IN' | 'OUT' | 'INOUT' | 'RETURNS'
  // constants
  | 'TRUE' | 'FALSE'
  // logical word operators
  | 'AND_KW' | 'OR_KW' | 'NOT_KW'
  // operators
  | 'PLUS' | 'MINUS' | 'STAR' | 'SLASH' | 'PERCENT'
  | 'ASSIGN' | 'EQ' | 'NE' | 'LT' | 'LE' | 'GT' | 'GE'
  | 'AMP' | 'PIPE' | 'CARET' | 'AMPAMP' | 'PIPEPIPE' | 'CARETCARET'
  | 'BANG' | 'PLUSPLUS' | 'MINUSMINUS'
  // delimiters
  | 'LPAREN' | 'RPAREN' | 'LBRACE' | 'RBRACE' | 'LBRACKET' | 'RBRACKET'
  | 'COMMA' | 'COLON' | 'SEMI' | 'DOT'
  // misc
  | 'EOF';

export interface Token {
  readonly kind: TokenKind;
  readonly text: string;
  readonly line: number;
  readonly column: number;
  /** Used for numeric literals. */
  readonly numeric?: number;
  /** Used for string literals (after escape processing). */
  readonly string?: string;
  /** Used for `0y` bit patterns (mask, value). */
  readonly pattern?: { value: number; mask: number; width: number };
}

/**
 * Identifier-to-keyword map. Lookup is **case-sensitive** — INPA keeps
 * type names lower-case (`int`, `string`) so that capitalised
 * identifiers (`String`, `Section`) are free for use as variable /
 * parameter names. Block-flavoured keywords (`SCREEN`, `MENU`, …) are
 * conventionally upper-case in real BMW scripts so we recognise them
 * in that form only.
 *
 * Where BMW code uses both cases (booleans, word operators) we list
 * each spelling explicitly. Adding a new case-variant here is cheaper
 * than reintroducing the case-insensitive lookup, which previously
 * caused parameter names like `String` to be lexed as `STRING_T`.
 */
export const KEYWORDS: Record<string, TokenKind> = {
  // types — lowercase only
  bool: 'BOOL_T',
  byte: 'BYTE_T',
  int: 'INT_T',
  long: 'LONG_T',
  real: 'REAL_T',
  string: 'STRING_T',
  // Opaque struct pointer used in Win32 import32 signatures
  // (e.g. `inout: structure ReOpenBuff` in startus.ips). Treated as
  // a generic handle by the AST for now.
  structure: 'STRUCTURE_T',

  // control flow — lowercase only
  if: 'IF',
  else: 'ELSE',
  while: 'WHILE',
  for: 'FOR',
  return: 'RETURN',
  break: 'BREAK',
  continue: 'CONTINUE',

  // block / UI keywords — uppercase only (BMW convention)
  SCREEN: 'SCREEN',
  MENU: 'MENU',
  LINE: 'LINE',
  ITEM: 'ITEM',
  INIT: 'INIT',
  STATEMACHINE: 'STATEMACHINE',
  LOGTABLE: 'LOGTABLE',
  CONTROL: 'CONTROL',
  OTHER: 'OTHER',

  // imports
  import: 'IMPORT',
  import32: 'IMPORT32',
  lib: 'LIB',
  extern: 'EXTERN',

  // directions
  in: 'IN',
  out: 'OUT',
  inout: 'INOUT',
  returns: 'RETURNS',

  // booleans — both cases (BMW scripts mix `TRUE` and `true`).
  TRUE: 'TRUE',
  FALSE: 'FALSE',
  true: 'TRUE',
  false: 'FALSE',

  // word-form logical operators — every common case variant.
  and: 'AND_KW', AND: 'AND_KW', And: 'AND_KW',
  or: 'OR_KW',  OR: 'OR_KW',  Or: 'OR_KW',
  not: 'NOT_KW', NOT: 'NOT_KW', Not: 'NOT_KW',
};
