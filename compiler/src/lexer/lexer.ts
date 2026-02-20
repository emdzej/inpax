import { Token, TokenType, KEYWORDS } from './tokens.js';

/**
 * Lexer for INPA IPS source files
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
      const token = this.nextToken();
      if (token.type !== TokenType.COMMENT) {
        tokens.push(token);
      }
    }
    
    tokens.push(this.makeToken(TokenType.EOF, ''));
    return tokens;
  }

  /**
   * Get next token
   */
  private nextToken(): Token {
    this.skipWhitespace();
    
    if (this.isAtEnd()) {
      return this.makeToken(TokenType.EOF, '');
    }

    const ch = this.peek();

    // Newline
    if (ch === '\n') {
      this.advance();
      const token = this.makeToken(TokenType.NEWLINE, '\\n');
      this.line++;
      this.column = 1;
      return token;
    }

    // Comment
    if (ch === ';' || (ch === '/' && this.peekNext() === '/')) {
      return this.readComment();
    }

    // String
    if (ch === '"') {
      return this.readString();
    }

    // Number
    if (this.isDigit(ch) || (ch === '-' && this.isDigit(this.peekNext()))) {
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
   * Read string literal
   */
  private readString(): Token {
    const start = this.pos;
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
    
    if (this.peek() === '-') {
      value += this.advance();
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
   * Read comment (to end of line)
   */
  private readComment(): Token {
    let value = '';
    
    // Skip ; or //
    if (this.peek() === ';') {
      this.advance();
    } else {
      this.advance(); // /
      this.advance(); // /
    }
    
    while (!this.isAtEnd() && this.peek() !== '\n') {
      value += this.advance();
    }
    
    return this.makeToken(TokenType.COMMENT, value.trim());
  }

  /**
   * Read operator or delimiter
   */
  private readOperator(): Token {
    const ch = this.advance();
    
    switch (ch) {
      case '+': return this.makeToken(TokenType.PLUS, ch);
      case '-': return this.makeToken(TokenType.MINUS, ch);
      case '*': return this.makeToken(TokenType.STAR, ch);
      case '/': return this.makeToken(TokenType.SLASH, ch);
      case '%': return this.makeToken(TokenType.PERCENT, ch);
      case '&': return this.makeToken(TokenType.BAND, ch);
      case '|': return this.makeToken(TokenType.BOR, ch);
      case '^': return this.makeToken(TokenType.BXOR, ch);
      case '(': return this.makeToken(TokenType.LPAREN, ch);
      case ')': return this.makeToken(TokenType.RPAREN, ch);
      case '[': return this.makeToken(TokenType.LBRACKET, ch);
      case ']': return this.makeToken(TokenType.RBRACKET, ch);
      case ',': return this.makeToken(TokenType.COMMA, ch);
      case ':': return this.makeToken(TokenType.COLON, ch);
      case ';': return this.makeToken(TokenType.SEMICOLON, ch);
      case '.': return this.makeToken(TokenType.DOT, ch);
      
      case '=':
        if (this.peek() === '=') {
          this.advance();
          return this.makeToken(TokenType.EQ, '==');
        }
        return this.makeToken(TokenType.ASSIGN, ch);
      
      case '!':
        if (this.peek() === '=') {
          this.advance();
          return this.makeToken(TokenType.NE, '!=');
        }
        throw new Error(`Unexpected character '!' at line ${this.line}`);
      
      case '<':
        if (this.peek() === '=') {
          this.advance();
          return this.makeToken(TokenType.LE, '<=');
        }
        if (this.peek() === '>') {
          this.advance();
          return this.makeToken(TokenType.NE, '<>');
        }
        return this.makeToken(TokenType.LT, ch);
      
      case '>':
        if (this.peek() === '=') {
          this.advance();
          return this.makeToken(TokenType.GE, '>=');
        }
        return this.makeToken(TokenType.GT, ch);
      
      default:
        throw new Error(`Unexpected character '${ch}' at line ${this.line}, column ${this.column}`);
    }
  }

  // ============ Helper methods ============

  private skipWhitespace(): void {
    while (!this.isAtEnd()) {
      const ch = this.peek();
      if (ch === ' ' || ch === '\t' || ch === '\r') {
        this.advance();
      } else {
        break;
      }
    }
  }

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
