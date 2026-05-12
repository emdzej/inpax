import { KEYWORDS, Token, TokenKind } from './tokens.js';

export class LexError extends Error {
  constructor(
    message: string,
    public readonly line: number,
    public readonly column: number,
  ) {
    super(`${line}:${column}: ${message}`);
    this.name = 'LexError';
  }
}

const HEX = /^[0-9a-fA-F]$/;
const BIN_PATTERN = /^[01X]$/i;

export class Lexer {
  private pos = 0;
  private line = 1;
  private col = 1;

  constructor(private readonly src: string) {}

  tokenize(): Token[] {
    const tokens: Token[] = [];
    while (!this.eof()) {
      this.skipTrivia();
      if (this.eof()) break;
      tokens.push(this.next());
    }
    tokens.push({ kind: 'EOF', text: '', line: this.line, column: this.col });
    return tokens;
  }

  private next(): Token {
    const c = this.peek();
    if (c === '"') return this.readString();
    if (c === '0' && (this.peek(1) === 'y' || this.peek(1) === 'Y')) {
      return this.readBitPattern();
    }
    if (this.isDigit(c)) return this.readNumber();
    if (this.isIdentStart(c)) return this.readIdent();
    if (c === '#') return this.readPragmaOrInclude();
    return this.readOperator();
  }

  private readString(): Token {
    const startLine = this.line;
    const startCol = this.col;
    this.advance(); // "
    let raw = '';
    let value = '';
    while (!this.eof() && this.peek() !== '"') {
      const ch = this.peek();
      if (ch === '\\') {
        raw += ch;
        this.advance();
        const esc = this.peek();
        raw += esc;
        this.advance();
        switch (esc) {
          case 'n': value += '\n'; break;
          case 'r': value += '\r'; break;
          case 't': value += '\t'; break;
          case '\\': value += '\\'; break;
          case '"': value += '"'; break;
          case '0': value += '\0'; break;
          default: value += esc;
        }
        continue;
      }
      if (ch === '\n') {
        throw new LexError('unterminated string literal', startLine, startCol);
      }
      raw += ch;
      value += ch;
      this.advance();
    }
    if (this.eof()) {
      throw new LexError('unterminated string literal', startLine, startCol);
    }
    this.advance(); // closing "
    return { kind: 'STRING', text: `"${raw}"`, line: startLine, column: startCol, string: value };
  }

  private readBitPattern(): Token {
    const startLine = this.line;
    const startCol = this.col;
    this.advance(); // 0
    this.advance(); // y
    let bits = '';
    while (!this.eof() && BIN_PATTERN.test(this.peek())) {
      bits += this.peek();
      this.advance();
    }
    if (bits.length === 0) {
      throw new LexError('expected bit pattern after `0y`', startLine, startCol);
    }
    let value = 0;
    let mask = 0;
    for (const b of bits) {
      value <<= 1;
      mask <<= 1;
      if (b === '1') {
        value |= 1;
        mask |= 1;
      } else if (b === '0') {
        mask |= 1;
      }
      // 'X' / 'x' -> don't-care: leave both bits 0
    }
    return {
      kind: 'BITPATTERN',
      text: `0y${bits}`,
      line: startLine,
      column: startCol,
      pattern: { value: value >>> 0, mask: mask >>> 0, width: bits.length },
    };
  }

  private readNumber(): Token {
    const startLine = this.line;
    const startCol = this.col;
    let text = '';
    let isReal = false;
    if (this.peek() === '0' && (this.peek(1) === 'x' || this.peek(1) === 'X')) {
      text += this.peek();
      this.advance();
      text += this.peek();
      this.advance();
      while (!this.eof() && HEX.test(this.peek())) {
        text += this.peek();
        this.advance();
      }
      return {
        kind: 'INT',
        text,
        line: startLine,
        column: startCol,
        numeric: parseInt(text.slice(2), 16),
      };
    }
    while (!this.eof() && this.isDigit(this.peek())) {
      text += this.peek();
      this.advance();
    }
    if (this.peek() === '.' && this.isDigit(this.peek(1))) {
      isReal = true;
      text += '.';
      this.advance();
      while (!this.eof() && this.isDigit(this.peek())) {
        text += this.peek();
        this.advance();
      }
    }
    if (this.peek() === 'e' || this.peek() === 'E') {
      isReal = true;
      text += this.peek();
      this.advance();
      if (this.peek() === '+' || this.peek() === '-') {
        text += this.peek();
        this.advance();
      }
      while (!this.eof() && this.isDigit(this.peek())) {
        text += this.peek();
        this.advance();
      }
    }
    const numeric = isReal ? parseFloat(text) : parseInt(text, 10);
    return {
      kind: isReal ? 'REAL' : 'INT',
      text,
      line: startLine,
      column: startCol,
      numeric,
    };
  }

  private readIdent(): Token {
    const startLine = this.line;
    const startCol = this.col;
    let text = '';
    while (!this.eof() && this.isIdentPart(this.peek())) {
      text += this.peek();
      this.advance();
    }
    // Case-sensitive keyword lookup — see tokens.ts for the rationale.
    const keyword = KEYWORDS[text];
    return {
      kind: keyword ?? 'IDENT',
      text,
      line: startLine,
      column: startCol,
    };
  }

  private readPragmaOrInclude(): Token {
    // Preprocessor lines are eaten before the lexer normally runs (the
    // preprocessor pre-strips them). If one slips through, emit it as an
    // identifier-like token so the parser can produce a helpful error.
    const startLine = this.line;
    const startCol = this.col;
    let text = '';
    while (!this.eof() && this.peek() !== '\n') {
      text += this.peek();
      this.advance();
    }
    return { kind: 'IDENT', text, line: startLine, column: startCol };
  }

  private readOperator(): Token {
    const startLine = this.line;
    const startCol = this.col;
    const c = this.peek();
    const n = this.peek(1);
    const mk = (kind: TokenKind, len: number, text: string): Token => {
      for (let i = 0; i < len; i++) this.advance();
      return { kind, text, line: startLine, column: startCol };
    };
    switch (c) {
      case '+': return n === '+' ? mk('PLUSPLUS', 2, '++') : mk('PLUS', 1, '+');
      case '-': return n === '-' ? mk('MINUSMINUS', 2, '--') : mk('MINUS', 1, '-');
      case '*': return mk('STAR', 1, '*');
      case '/': return mk('SLASH', 1, '/');
      case '%': return mk('PERCENT', 1, '%');
      case '=': return n === '=' ? mk('EQ', 2, '==') : mk('ASSIGN', 1, '=');
      case '!': return n === '=' ? mk('NE', 2, '!=') : mk('BANG', 1, '!');
      case '<': return n === '=' ? mk('LE', 2, '<=') : mk('LT', 1, '<');
      case '>': return n === '=' ? mk('GE', 2, '>=') : mk('GT', 1, '>');
      case '&': return n === '&' ? mk('AMPAMP', 2, '&&') : mk('AMP', 1, '&');
      case '|': return n === '|' ? mk('PIPEPIPE', 2, '||') : mk('PIPE', 1, '|');
      case '^': return n === '^' ? mk('CARETCARET', 2, '^^') : mk('CARET', 1, '^');
      case '(': return mk('LPAREN', 1, '(');
      case ')': return mk('RPAREN', 1, ')');
      case '{': return mk('LBRACE', 1, '{');
      case '}': return mk('RBRACE', 1, '}');
      case '[': return mk('LBRACKET', 1, '[');
      case ']': return mk('RBRACKET', 1, ']');
      case ',': return mk('COMMA', 1, ',');
      case ':': return mk('COLON', 1, ':');
      case ';': return mk('SEMI', 1, ';');
      case '.': return mk('DOT', 1, '.');
    }
    throw new LexError(`unexpected character '${c}'`, startLine, startCol);
  }

  private skipTrivia(): void {
    while (!this.eof()) {
      const c = this.peek();
      if (c === ' ' || c === '\t' || c === '\r') {
        this.advance();
      } else if (c === '\n') {
        this.advance();
      } else if (c === '/' && this.peek(1) === '/') {
        while (!this.eof() && this.peek() !== '\n') this.advance();
      } else if (c === '/' && this.peek(1) === '*') {
        this.advance(); this.advance();
        while (!this.eof() && !(this.peek() === '*' && this.peek(1) === '/')) {
          this.advance();
        }
        if (!this.eof()) { this.advance(); this.advance(); }
      } else {
        break;
      }
    }
  }

  private peek(offset = 0): string {
    return this.src[this.pos + offset] ?? '';
  }

  private advance(): string {
    const ch = this.src[this.pos++];
    if (ch === '\n') { this.line++; this.col = 1; } else { this.col++; }
    return ch;
  }

  private eof(): boolean {
    return this.pos >= this.src.length;
  }

  private isDigit(c: string): boolean {
    return c >= '0' && c <= '9';
  }

  private isIdentStart(c: string): boolean {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
  }

  private isIdentPart(c: string): boolean {
    return this.isIdentStart(c) || this.isDigit(c);
  }
}

export function tokenize(source: string): Token[] {
  return new Lexer(source).tokenize();
}
