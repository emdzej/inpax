import { Token, TokenType, KEYWORDS } from './tokens.js';

/**
 * Lexer for INPA IPS source files (C-like syntax)
 */
export class Lexer {
  private source: string;
  private pos: number = 0;
  private line: number = 1;
  private column: number = 1;

  constructor(source: string) {
    this.source = source;
  }

  /**
   * Tokenize entire source
   */
  tokenize(): Token[] {
    const tokens: Token[] = [];
    
    while (!this.isAtEnd()) {
      this.skipWhitespaceAndComments();
      if (this.isAtEnd()) break;
      tokens.push(this.nextToken());
    }
    
    tokens.push(this.makeToken(TokenType.EOF, ''));
    return tokens;
  }

  /**
   * Get next token
   */
  private nextToken(): Token {
    const ch = this.peek();

    // String
    if (ch === '"') {
      return this.readString();
    }

    // Number
    if (this.isDigit(ch)) {
      return this.readNumber();
    }

    // Identifier or keyword
    if (this.isAlpha(ch) || ch === '_') {
      return this.readIdentifier();
    }

    // Operators and delimiters
    return this.readOperator();
  }

  /**
   * Skip whitespace and comments
   */
  private skipWhitespaceAndComments(): void {
    while (!this.isAtEnd()) {
      const ch = this.peek();
      
      if (ch === ' ' || ch === '\t' || ch === '\r') {
        this.advance();
      } else if (ch === '\n') {
        this.advance();
        this.line++;
        this.column = 1;
      } else if (ch === '/' && this.peekNext() === '/') {
        // Line comment
        while (!this.isAtEnd() && this.peek() !== '\n') {
          this.advance();
        }
      } else if (ch === '/' && this.peekNext() === '*') {
        // Block comment
        this.advance(); // /
        this.advance(); // *
        while (!this.isAtEnd() && !(this.peek() === '*' && this.peekNext() === '/')) {
          if (this.peek() === '\n') {
            this.line++;
            this.column = 1;
          }
          this.advance();
        }
        if (!this.isAtEnd()) {
          this.advance(); // *
          this.advance(); // /
        }
      } else {
        break;
      }
    }
  }

  /**
   * Read string literal
   */
  private readString(): Token {
    this.advance(); // Skip opening quote
    
    let value = '';
    while (!this.isAtEnd() && this.peek() !== '"') {
      if (this.peek() === '\\') {
        this.advance();
        const escaped = this.advance();
        switch (escaped) {
          case 'n': value += '\n'; break;
          case 'r': value += '\r'; break;
          case 't': value += '\t'; break;
          case '"': value += '"'; break;
          case '\\': value += '\\'; break;
          default: value += escaped;
        }
      } else if (this.peek() === '\n') {
        throw new Error(`Unterminated string at line ${this.line}`);
      } else {
        value += this.advance();
      }
    }
    
    if (this.isAtEnd()) {
      throw new Error(`Unterminated string at line ${this.line}`);
    }
    
    this.advance(); // Skip closing quote
    return this.makeToken(TokenType.STRING, value);
  }

  /**
   * Read number (integer or real)
   */
  private readNumber(): Token {
    let value = '';
    
    // Check for hex
    if (this.peek() === '0' && (this.peekNext() === 'x' || this.peekNext() === 'X')) {
      value += this.advance(); // 0
      value += this.advance(); // x
      while (this.isHexDigit(this.peek())) {
        value += this.advance();
      }
      return this.makeToken(TokenType.INTEGER, value);
    }
    
    while (this.isDigit(this.peek())) {
      value += this.advance();
    }
    
    // Check for decimal
    if (this.peek() === '.' && this.isDigit(this.peekNext())) {
      value += this.advance(); // .
      while (this.isDigit(this.peek())) {
        value += this.advance();
      }
      return this.makeToken(TokenType.REAL, value);
    }
    
    return this.makeToken(TokenType.INTEGER, value);
  }

  /**
   * Read identifier or keyword
   */
  private readIdentifier(): Token {
    let value = '';
    
    while (this.isAlphaNumeric(this.peek()) || this.peek() === '_') {
      value += this.advance();
    }
    
    const lower = value.toLowerCase();
    const keywordType = KEYWORDS[lower];
    
    if (keywordType) {
      return this.makeToken(keywordType, lower);
    }
    
    return this.makeToken(TokenType.IDENTIFIER, value);
  }

  /**
   * Read operator or delimiter
   */
  private readOperator(): Token {
    const ch = this.advance();
    
    switch (ch) {
      case '+':
        if (this.peek() === '+') { this.advance(); return this.makeToken(TokenType.PLUSPLUS, '++'); }
        return this.makeToken(TokenType.PLUS, ch);
      case '-':
        if (this.peek() === '-') { this.advance(); return this.makeToken(TokenType.MINUSMINUS, '--'); }
        return this.makeToken(TokenType.MINUS, ch);
      case '*': return this.makeToken(TokenType.STAR, ch);
      case '/': return this.makeToken(TokenType.SLASH, ch);
      case '%': return this.makeToken(TokenType.PERCENT, ch);
      case '&':
        if (this.peek() === '&') { this.advance(); return this.makeToken(TokenType.LAND, '&&'); }
        return this.makeToken(TokenType.BAND, ch);
      case '|':
        if (this.peek() === '|') { this.advance(); return this.makeToken(TokenType.LOR, '||'); }
        return this.makeToken(TokenType.BOR, ch);
      case '^': return this.makeToken(TokenType.BXOR, ch);
      case '(': return this.makeToken(TokenType.LPAREN, ch);
      case ')': return this.makeToken(TokenType.RPAREN, ch);
      case '{': return this.makeToken(TokenType.LBRACE, ch);
      case '}': return this.makeToken(TokenType.RBRACE, ch);
      case '[': return this.makeToken(TokenType.LBRACKET, ch);
      case ']': return this.makeToken(TokenType.RBRACKET, ch);
      case ',': return this.makeToken(TokenType.COMMA, ch);
      case ':': return this.makeToken(TokenType.COLON, ch);
      case ';': return this.makeToken(TokenType.SEMICOLON, ch);
      case '.': return this.makeToken(TokenType.DOT, ch);
      case '#': return this.makeToken(TokenType.HASH, ch);
      
      case '=':
        if (this.peek() === '=') { this.advance(); return this.makeToken(TokenType.EQ, '=='); }
        return this.makeToken(TokenType.ASSIGN, ch);
      
      case '!':
        if (this.peek() === '=') { this.advance(); return this.makeToken(TokenType.NE, '!='); }
        return this.makeToken(TokenType.LNOT, ch);
      
      case '<':
        if (this.peek() === '=') { this.advance(); return this.makeToken(TokenType.LE, '<='); }
        return this.makeToken(TokenType.LT, ch);
      
      case '>':
        if (this.peek() === '=') { this.advance(); return this.makeToken(TokenType.GE, '>='); }
        return this.makeToken(TokenType.GT, ch);
      
      default:
        throw new Error(`Unexpected character '${ch}' at line ${this.line}, column ${this.column}`);
    }
  }

  // ============ Helper methods ============

  private peek(): string {
    if (this.isAtEnd()) return '\0';
    return this.source[this.pos];
  }

  private peekNext(): string {
    if (this.pos + 1 >= this.source.length) return '\0';
    return this.source[this.pos + 1];
  }

  private advance(): string {
    const ch = this.source[this.pos++];
    this.column++;
    return ch;
  }

  private isAtEnd(): boolean {
    return this.pos >= this.source.length;
  }

  private isDigit(ch: string): boolean {
    return ch >= '0' && ch <= '9';
  }

  private isHexDigit(ch: string): boolean {
    return this.isDigit(ch) || (ch >= 'a' && ch <= 'f') || (ch >= 'A' && ch <= 'F');
  }

  private isAlpha(ch: string): boolean {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z');
  }

  private isAlphaNumeric(ch: string): boolean {
    return this.isAlpha(ch) || this.isDigit(ch);
  }

  private makeToken(type: TokenType, value: string): Token {
    return {
      type,
      value,
      line: this.line,
      column: this.column - value.length,
    };
  }
}

export function tokenize(source: string): Token[] {
  return new Lexer(source).tokenize();
}
