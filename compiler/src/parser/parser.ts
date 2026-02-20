import { Token, TokenType } from '../lexer/index.js';
import {
  Program, FunctionDecl, GlobalDecl, LocalDecl, ParameterDecl, PragmaDecl,
  ScreenDecl, MenuDecl, MenuItemDecl, LineDecl,
  Statement, Expression, ValueType, BlockStmt, ExpressionStmt,
  IfStmt, WhileStmt, ForStmt, ReturnStmt,
  LiteralExpr, IdentifierExpr, BinaryExpr, UnaryExpr, CallExpr, IndexExpr, AssignExpr,
} from '../ast/index.js';

/**
 * Recursive descent parser for INPA IPS (C-like syntax)
 */
export class Parser {
  private tokens: Token[];
  private pos: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  /**
   * Parse program
   */
  parse(): Program {
    const program: Program = {
      kind: 'Program',
      line: 1,
      column: 1,
      includes: [],
      pragmas: [],
      globals: [],
      functions: [],
      screens: [],
      menus: [],
    };

    while (!this.isAtEnd()) {
      this.parseTopLevel(program);
    }

    return program;
  }

  /**
   * Parse top-level: #include, #pragma, globals, functions, SCREEN, MENU
   */
  private parseTopLevel(program: Program): void {
    // Preprocessor
    if (this.check(TokenType.HASH)) {
      this.advance();
      if (this.match(TokenType.INCLUDE)) {
        const path = this.expect(TokenType.STRING, 'include path').value;
        program.includes.push(path);
        return;
      }
      if (this.match(TokenType.PRAGMA)) {
        const name = this.expect(TokenType.IDENTIFIER, 'pragma name').value;
        program.pragmas.push({
          kind: 'PragmaDecl',
          line: this.previous().line,
          column: this.previous().column,
          name,
        });
        return;
      }
      throw this.error('Unknown preprocessor directive');
    }

    // SCREEN
    if (this.check(TokenType.SCREEN)) {
      program.screens.push(this.parseScreen());
      return;
    }

    // MENU
    if (this.check(TokenType.MENU)) {
      program.menus.push(this.parseMenu());
      return;
    }

    // Global variable or function
    if (this.isType()) {
      // Type name ...
      const type = this.parseType();
      const name = this.expect(TokenType.IDENTIFIER, 'identifier').value;

      // Array?
      let arraySize: number | undefined;
      if (this.match(TokenType.LBRACKET)) {
        arraySize = parseInt(this.expect(TokenType.INTEGER, 'array size').value);
        this.expect(TokenType.RBRACKET, ']');
      }

      // Function or variable?
      if (this.check(TokenType.LPAREN)) {
        // It's a function with return type
        this.pos -= arraySize ? 4 : 2; // Backtrack
        program.functions.push(this.parseFunction());
      } else {
        // Global variable
        let initializer: Expression | undefined;
        if (this.match(TokenType.ASSIGN)) {
          initializer = this.parseExpression();
        }
        this.expect(TokenType.SEMICOLON, ';');
        program.globals.push({
          kind: 'GlobalDecl',
          line: this.previous().line,
          column: this.previous().column,
          name,
          type,
          arraySize,
          initializer,
        });
      }
      return;
    }

    // Function without return type (void): name() { }
    if (this.check(TokenType.IDENTIFIER)) {
      program.functions.push(this.parseFunction());
      return;
    }

    throw this.error(`Unexpected token: ${this.peek().type}`);
  }

  // ============ Function ============

  private parseFunction(): FunctionDecl {
    const token = this.peek();
    const name = this.expect(TokenType.IDENTIFIER, 'function name').value;
    
    this.expect(TokenType.LPAREN, '(');
    const params = this.parseParameters();
    this.expect(TokenType.RPAREN, ')');

    this.expect(TokenType.LBRACE, '{');
    
    // Parse locals and statements
    const locals: LocalDecl[] = [];
    const body: Statement[] = [];
    
    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      if (this.isType()) {
        // Local variable declaration
        const local = this.parseLocalDecl();
        locals.push(local);
      } else {
        body.push(this.parseStatement());
      }
    }
    
    this.expect(TokenType.RBRACE, '}');

    return {
      kind: 'FunctionDecl',
      line: token.line,
      column: token.column,
      name,
      params,
      locals,
      body,
    };
  }

  private parseParameters(): ParameterDecl[] {
    const params: ParameterDecl[] = [];
    
    if (this.check(TokenType.RPAREN)) return params;

    do {
      const type = this.parseType();
      const name = this.expect(TokenType.IDENTIFIER, 'parameter name').value;

      let arraySize: number | undefined;
      if (this.match(TokenType.LBRACKET)) {
        if (!this.check(TokenType.RBRACKET)) {
          arraySize = parseInt(this.expect(TokenType.INTEGER, 'array size').value);
        }
        this.expect(TokenType.RBRACKET, ']');
      }

      params.push({
        kind: 'ParameterDecl',
        line: this.previous().line,
        column: this.previous().column,
        name,
        type,
        arraySize,
      });
    } while (this.match(TokenType.COMMA));

    return params;
  }

  private parseLocalDecl(): LocalDecl {
    const type = this.parseType();
    const name = this.expect(TokenType.IDENTIFIER, 'variable name').value;

    let arraySize: number | undefined;
    if (this.match(TokenType.LBRACKET)) {
      arraySize = parseInt(this.expect(TokenType.INTEGER, 'array size').value);
      this.expect(TokenType.RBRACKET, ']');
    }

    let initializer: Expression | undefined;
    if (this.match(TokenType.ASSIGN)) {
      initializer = this.parseExpression();
    }

    this.expect(TokenType.SEMICOLON, ';');

    return {
      kind: 'LocalDecl',
      line: this.previous().line,
      column: this.previous().column,
      name,
      type,
      arraySize,
      initializer,
    };
  }

  // ============ UI Declarations ============

  private parseScreen(): ScreenDecl {
    const token = this.expect(TokenType.SCREEN, 'SCREEN');
    const name = this.expect(TokenType.IDENTIFIER, 'screen name').value;
    this.expect(TokenType.LPAREN, '(');
    this.expect(TokenType.RPAREN, ')');
    this.expect(TokenType.LBRACE, '{');

    const body: Statement[] = [];
    const lines: LineDecl[] = [];

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      if (this.check(TokenType.LINE)) {
        lines.push(this.parseLine());
      } else {
        body.push(this.parseStatement());
      }
    }

    this.expect(TokenType.RBRACE, '}');

    return {
      kind: 'ScreenDecl',
      line: token.line,
      column: token.column,
      name,
      body,
      lines,
    };
  }

  private parseLine(): LineDecl {
    const token = this.expect(TokenType.LINE, 'LINE');
    this.expect(TokenType.LPAREN, '(');
    const label = this.expect(TokenType.STRING, 'label').value;
    this.expect(TokenType.COMMA, ',');
    const tag = this.expect(TokenType.STRING, 'tag').value;
    this.expect(TokenType.RPAREN, ')');
    this.expect(TokenType.LBRACE, '{');

    const body: Statement[] = [];
    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      body.push(this.parseStatement());
    }

    this.expect(TokenType.RBRACE, '}');

    return {
      kind: 'LineDecl',
      line: token.line,
      column: token.column,
      label,
      tag,
      body,
    };
  }

  private parseMenu(): MenuDecl {
    const token = this.expect(TokenType.MENU, 'MENU');
    const name = this.expect(TokenType.IDENTIFIER, 'menu name').value;
    this.expect(TokenType.LPAREN, '(');
    this.expect(TokenType.RPAREN, ')');
    this.expect(TokenType.LBRACE, '{');

    let init: Statement[] | undefined;
    const items: MenuItemDecl[] = [];

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      if (this.check(TokenType.INIT)) {
        this.advance();
        this.expect(TokenType.LBRACE, '{');
        init = [];
        while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
          init.push(this.parseStatement());
        }
        this.expect(TokenType.RBRACE, '}');
      } else if (this.check(TokenType.ITEM)) {
        items.push(this.parseMenuItem());
      } else {
        throw this.error('Expected INIT or ITEM in MENU');
      }
    }

    this.expect(TokenType.RBRACE, '}');

    return {
      kind: 'MenuDecl',
      line: token.line,
      column: token.column,
      name,
      init,
      items,
    };
  }

  private parseMenuItem(): MenuItemDecl {
    const token = this.expect(TokenType.ITEM, 'ITEM');
    this.expect(TokenType.LPAREN, '(');
    const key = parseInt(this.expect(TokenType.INTEGER, 'key').value);
    this.expect(TokenType.COMMA, ',');
    const label = this.expect(TokenType.STRING, 'label').value;
    this.expect(TokenType.RPAREN, ')');
    this.expect(TokenType.LBRACE, '{');

    const body: Statement[] = [];
    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      body.push(this.parseStatement());
    }

    this.expect(TokenType.RBRACE, '}');

    return {
      kind: 'MenuItemDecl',
      line: token.line,
      column: token.column,
      key,
      label,
      body,
    };
  }

  // ============ Statements ============

  private parseStatement(): Statement {
    if (this.check(TokenType.LBRACE)) return this.parseBlock();
    if (this.check(TokenType.IF)) return this.parseIf();
    if (this.check(TokenType.WHILE)) return this.parseWhile();
    if (this.check(TokenType.FOR)) return this.parseFor();
    if (this.check(TokenType.RETURN)) return this.parseReturn();
    if (this.check(TokenType.BREAK)) {
      const token = this.advance();
      this.expect(TokenType.SEMICOLON, ';');
      return { kind: 'BreakStmt', line: token.line, column: token.column };
    }
    if (this.check(TokenType.CONTINUE)) {
      const token = this.advance();
      this.expect(TokenType.SEMICOLON, ';');
      return { kind: 'ContinueStmt', line: token.line, column: token.column };
    }

    // Expression statement
    const expr = this.parseExpression();
    this.expect(TokenType.SEMICOLON, ';');
    return {
      kind: 'ExpressionStmt',
      line: expr.line,
      column: expr.column,
      expression: expr,
    };
  }

  private parseBlock(): BlockStmt {
    const token = this.expect(TokenType.LBRACE, '{');
    const statements: Statement[] = [];
    
    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      statements.push(this.parseStatement());
    }
    
    this.expect(TokenType.RBRACE, '}');
    return { kind: 'BlockStmt', line: token.line, column: token.column, statements };
  }

  private parseIf(): IfStmt {
    const token = this.expect(TokenType.IF, 'if');
    this.expect(TokenType.LPAREN, '(');
    const condition = this.parseExpression();
    this.expect(TokenType.RPAREN, ')');
    
    const thenBranch = this.parseStatement();
    let elseBranch: Statement | undefined;
    
    if (this.match(TokenType.ELSE)) {
      elseBranch = this.parseStatement();
    }

    return {
      kind: 'IfStmt',
      line: token.line,
      column: token.column,
      condition,
      thenBranch,
      elseBranch,
    };
  }

  private parseWhile(): WhileStmt {
    const token = this.expect(TokenType.WHILE, 'while');
    this.expect(TokenType.LPAREN, '(');
    const condition = this.parseExpression();
    this.expect(TokenType.RPAREN, ')');
    const body = this.parseStatement();

    return {
      kind: 'WhileStmt',
      line: token.line,
      column: token.column,
      condition,
      body,
    };
  }

  private parseFor(): ForStmt {
    const token = this.expect(TokenType.FOR, 'for');
    this.expect(TokenType.LPAREN, '(');
    
    let init: Expression | LocalDecl | undefined;
    if (!this.check(TokenType.SEMICOLON)) {
      if (this.isType()) {
        const type = this.parseType();
        const name = this.expect(TokenType.IDENTIFIER, 'variable').value;
        let initializer: Expression | undefined;
        if (this.match(TokenType.ASSIGN)) {
          initializer = this.parseExpression();
        }
        init = {
          kind: 'LocalDecl',
          line: token.line,
          column: token.column,
          name,
          type,
          initializer,
        };
      } else {
        init = this.parseExpression();
      }
    }
    this.expect(TokenType.SEMICOLON, ';');
    
    let condition: Expression | undefined;
    if (!this.check(TokenType.SEMICOLON)) {
      condition = this.parseExpression();
    }
    this.expect(TokenType.SEMICOLON, ';');
    
    let update: Expression | undefined;
    if (!this.check(TokenType.RPAREN)) {
      update = this.parseExpression();
    }
    this.expect(TokenType.RPAREN, ')');
    
    const body = this.parseStatement();

    return {
      kind: 'ForStmt',
      line: token.line,
      column: token.column,
      init,
      condition,
      update,
      body,
    };
  }

  private parseReturn(): ReturnStmt {
    const token = this.expect(TokenType.RETURN, 'return');
    let value: Expression | undefined;
    
    if (!this.check(TokenType.SEMICOLON)) {
      value = this.parseExpression();
    }
    this.expect(TokenType.SEMICOLON, ';');

    return {
      kind: 'ReturnStmt',
      line: token.line,
      column: token.column,
      value,
    };
  }

  // ============ Expressions ============

  private parseExpression(): Expression {
    return this.parseAssignment();
  }

  private parseAssignment(): Expression {
    const expr = this.parseOr();

    if (this.match(TokenType.ASSIGN)) {
      const value = this.parseAssignment();
      return {
        kind: 'AssignExpr',
        line: expr.line,
        column: expr.column,
        target: expr,
        value,
      };
    }

    return expr;
  }

  private parseOr(): Expression {
    let left = this.parseAnd();

    while (this.match(TokenType.LOR, TokenType.OR)) {
      const op = this.previous().value;
      const right = this.parseAnd();
      left = { kind: 'BinaryExpr', line: left.line, column: left.column, operator: op, left, right };
    }

    return left;
  }

  private parseAnd(): Expression {
    let left = this.parseEquality();

    while (this.match(TokenType.LAND, TokenType.AND)) {
      const op = this.previous().value;
      const right = this.parseEquality();
      left = { kind: 'BinaryExpr', line: left.line, column: left.column, operator: op, left, right };
    }

    return left;
  }

  private parseEquality(): Expression {
    let left = this.parseComparison();

    while (this.match(TokenType.EQ, TokenType.NE)) {
      const op = this.previous().value;
      const right = this.parseComparison();
      left = { kind: 'BinaryExpr', line: left.line, column: left.column, operator: op, left, right };
    }

    return left;
  }

  private parseComparison(): Expression {
    let left = this.parseBitOr();

    while (this.match(TokenType.LT, TokenType.LE, TokenType.GT, TokenType.GE)) {
      const op = this.previous().value;
      const right = this.parseBitOr();
      left = { kind: 'BinaryExpr', line: left.line, column: left.column, operator: op, left, right };
    }

    return left;
  }

  private parseBitOr(): Expression {
    let left = this.parseBitXor();

    while (this.match(TokenType.BOR)) {
      const right = this.parseBitXor();
      left = { kind: 'BinaryExpr', line: left.line, column: left.column, operator: '|', left, right };
    }

    return left;
  }

  private parseBitXor(): Expression {
    let left = this.parseBitAnd();

    while (this.match(TokenType.BXOR)) {
      const right = this.parseBitAnd();
      left = { kind: 'BinaryExpr', line: left.line, column: left.column, operator: '^', left, right };
    }

    return left;
  }

  private parseBitAnd(): Expression {
    let left = this.parseTerm();

    while (this.match(TokenType.BAND)) {
      const right = this.parseTerm();
      left = { kind: 'BinaryExpr', line: left.line, column: left.column, operator: '&', left, right };
    }

    return left;
  }

  private parseTerm(): Expression {
    let left = this.parseFactor();

    while (this.match(TokenType.PLUS, TokenType.MINUS)) {
      const op = this.previous().value;
      const right = this.parseFactor();
      left = { kind: 'BinaryExpr', line: left.line, column: left.column, operator: op, left, right };
    }

    return left;
  }

  private parseFactor(): Expression {
    let left = this.parseUnary();

    while (this.match(TokenType.STAR, TokenType.SLASH, TokenType.PERCENT)) {
      const op = this.previous().value;
      const right = this.parseUnary();
      left = { kind: 'BinaryExpr', line: left.line, column: left.column, operator: op, left, right };
    }

    return left;
  }

  private parseUnary(): Expression {
    if (this.match(TokenType.MINUS, TokenType.LNOT, TokenType.NOT)) {
      const op = this.previous().value;
      const operand = this.parseUnary();
      return { kind: 'UnaryExpr', line: operand.line, column: operand.column, operator: op, operand, prefix: true };
    }

    if (this.match(TokenType.PLUSPLUS, TokenType.MINUSMINUS)) {
      const op = this.previous().value;
      const operand = this.parseUnary();
      return { kind: 'UnaryExpr', line: operand.line, column: operand.column, operator: op, operand, prefix: true };
    }

    return this.parsePostfix();
  }

  private parsePostfix(): Expression {
    let expr = this.parsePrimary();

    while (true) {
      if (this.match(TokenType.LPAREN)) {
        // Function call
        const args: Expression[] = [];
        if (!this.check(TokenType.RPAREN)) {
          do {
            args.push(this.parseExpression());
          } while (this.match(TokenType.COMMA));
        }
        this.expect(TokenType.RPAREN, ')');
        expr = { kind: 'CallExpr', line: expr.line, column: expr.column, name: (expr as IdentifierExpr).name, args };
      } else if (this.match(TokenType.LBRACKET)) {
        // Array index
        const index = this.parseExpression();
        this.expect(TokenType.RBRACKET, ']');
        expr = { kind: 'IndexExpr', line: expr.line, column: expr.column, array: expr, index };
      } else if (this.match(TokenType.PLUSPLUS, TokenType.MINUSMINUS)) {
        const op = this.previous().value;
        expr = { kind: 'UnaryExpr', line: expr.line, column: expr.column, operator: op, operand: expr, prefix: false };
      } else {
        break;
      }
    }

    return expr;
  }

  private parsePrimary(): Expression {
    const token = this.peek();

    if (this.match(TokenType.TRUE)) {
      return { kind: 'LiteralExpr', line: token.line, column: token.column, type: 'bool', value: true };
    }
    if (this.match(TokenType.FALSE)) {
      return { kind: 'LiteralExpr', line: token.line, column: token.column, type: 'bool', value: false };
    }
    if (this.match(TokenType.INTEGER)) {
      const val = token.value.startsWith('0x') ? parseInt(token.value, 16) : parseInt(token.value);
      return { kind: 'LiteralExpr', line: token.line, column: token.column, type: 'int', value: val };
    }
    if (this.match(TokenType.REAL)) {
      return { kind: 'LiteralExpr', line: token.line, column: token.column, type: 'real', value: parseFloat(token.value) };
    }
    if (this.match(TokenType.STRING)) {
      return { kind: 'LiteralExpr', line: token.line, column: token.column, type: 'string', value: token.value };
    }
    if (this.match(TokenType.IDENTIFIER)) {
      return { kind: 'IdentifierExpr', line: token.line, column: token.column, name: token.value };
    }
    if (this.match(TokenType.LPAREN)) {
      const expr = this.parseExpression();
      this.expect(TokenType.RPAREN, ')');
      return expr;
    }

    throw this.error(`Unexpected token: ${token.type}`);
  }

  // ============ Helpers ============

  private parseType(): ValueType {
    if (this.match(TokenType.BOOL)) return 'bool';
    if (this.match(TokenType.BYTE)) return 'byte';
    if (this.match(TokenType.INT)) return 'int';
    if (this.match(TokenType.LONG)) return 'long';
    if (this.match(TokenType.REAL_TYPE)) return 'real';
    if (this.match(TokenType.STRING_TYPE)) return 'string';
    throw this.error('Expected type');
  }

  private isType(): boolean {
    return this.check(TokenType.BOOL) || this.check(TokenType.BYTE) ||
           this.check(TokenType.INT) || this.check(TokenType.LONG) ||
           this.check(TokenType.REAL_TYPE) || this.check(TokenType.STRING_TYPE);
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private previous(): Token {
    return this.tokens[this.pos - 1];
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private check(type: TokenType): boolean {
    return !this.isAtEnd() && this.peek().type === type;
  }

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.pos++;
    return this.previous();
  }

  private expect(type: TokenType, what: string): Token {
    if (this.check(type)) return this.advance();
    throw this.error(`Expected ${what}, got ${this.peek().type}`);
  }

  private error(message: string): Error {
    const token = this.peek();
    return new Error(`Parse error at line ${token.line}, column ${token.column}: ${message}`);
  }
}

export function parse(tokens: Token[]): Program {
  return new Parser(tokens).parse();
}
