import { Token, TokenType } from '../lexer/index.js';
import {
  Program, FunctionDecl, VariableDecl, ConstantDecl, ParameterDecl,
  ScreenDecl, MenuDecl, StateMachineDecl, LineDecl, MenuItemDecl, StateDecl,
  Statement, Expression, ValueType, ASTNode,
  AssignmentStmt, CallStmt, IfStmt, WhileStmt, ForStmt, ReturnStmt,
  LiteralExpr, IdentifierExpr, BinaryExpr, UnaryExpr, CallExpr,
} from '../ast/index.js';

/**
 * Recursive descent parser for INPA IPS
 */
export class Parser {
  private tokens: Token[];
  private pos: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens.filter(t => t.type !== TokenType.NEWLINE || this.isSignificantNewline(t));
  }

  private isSignificantNewline(t: Token): boolean {
    return false; // Filter all newlines for now
  }

  /**
   * Parse program
   */
  parse(): Program {
    const program: Program = {
      kind: 'Program',
      line: 1,
      column: 1,
      globals: [],
      constants: [],
      functions: [],
      screens: [],
      menus: [],
      stateMachines: [],
    };

    while (!this.isAtEnd()) {
      this.parseTopLevel(program);
    }

    return program;
  }

  /**
   * Parse top-level declaration
   */
  private parseTopLevel(program: Program): void {
    if (this.check(TokenType.GLOBAL) || this.check(TokenType.VAR)) {
      program.globals.push(...this.parseVariableDecls(true));
    } else if (this.check(TokenType.CONST)) {
      program.constants.push(...this.parseConstantDecls());
    } else if (this.check(TokenType.FUNCTION)) {
      program.functions.push(this.parseFunctionDecl());
    } else if (this.check(TokenType.SCREEN)) {
      program.screens.push(this.parseScreenDecl());
    } else if (this.check(TokenType.MENU)) {
      program.menus.push(this.parseMenuDecl());
    } else if (this.check(TokenType.STATEMACHINE)) {
      program.stateMachines.push(this.parseStateMachineDecl());
    } else {
      throw this.error(`Unexpected token: ${this.peek().type}`);
    }
  }

  // ============ Declarations ============

  private parseVariableDecls(isGlobal: boolean): VariableDecl[] {
    const decls: VariableDecl[] = [];
    this.advance(); // skip 'global' or 'var'

    while (!this.isAtEnd() && this.isType()) {
      const type = this.parseType();
      
      do {
        const name = this.expect(TokenType.IDENTIFIER, 'variable name').value;
        decls.push({
          kind: 'VariableDecl',
          line: this.previous().line,
          column: this.previous().column,
          name,
          type,
          isGlobal,
        });
      } while (this.match(TokenType.COMMA));
    }

    return decls;
  }

  private parseConstantDecls(): ConstantDecl[] {
    const decls: ConstantDecl[] = [];
    this.advance(); // skip 'const'

    while (!this.isAtEnd() && this.isType()) {
      const type = this.parseType();
      const name = this.expect(TokenType.IDENTIFIER, 'constant name').value;
      this.expect(TokenType.ASSIGN, '=');
      const value = this.parseExpression();

      decls.push({
        kind: 'ConstantDecl',
        line: this.previous().line,
        column: this.previous().column,
        name,
        type,
        value,
      });
    }

    return decls;
  }

  private parseFunctionDecl(): FunctionDecl {
    const token = this.expect(TokenType.FUNCTION, 'function');
    const name = this.expect(TokenType.IDENTIFIER, 'function name').value;
    
    this.expect(TokenType.LPAREN, '(');
    const params = this.parseParameters();
    this.expect(TokenType.RPAREN, ')');

    const locals: VariableDecl[] = [];
    if (this.check(TokenType.VAR) || this.check(TokenType.LOCAL)) {
      locals.push(...this.parseVariableDecls(false));
    }

    const body = this.parseStatements(TokenType.ENDFUNC);
    this.expect(TokenType.ENDFUNC, 'endfunc');

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
      let direction: 'in' | 'out' | 'inout' = 'in';
      if (this.match(TokenType.IDENTIFIER)) {
        const dir = this.previous().value.toLowerCase();
        if (dir === 'out') direction = 'out';
        else if (dir === 'inout') direction = 'inout';
        else this.pos--; // Put back
      }

      const type = this.parseType();
      const name = this.expect(TokenType.IDENTIFIER, 'parameter name').value;

      params.push({
        kind: 'ParameterDecl',
        line: this.previous().line,
        column: this.previous().column,
        name,
        type,
        direction,
      });
    } while (this.match(TokenType.COMMA));

    return params;
  }

  // ============ UI Declarations ============

  private parseScreenDecl(): ScreenDecl {
    const token = this.expect(TokenType.SCREEN, 'screen');
    const name = this.expect(TokenType.IDENTIFIER, 'screen name').value;

    const lines: LineDecl[] = [];
    let initFunc: FunctionDecl | undefined;

    // Parse screen body until we hit another top-level or EOF
    while (!this.isAtEnd() && !this.isTopLevel()) {
      if (this.check(TokenType.LINE)) {
        lines.push(this.parseLineDecl());
      } else if (this.check(TokenType.FUNCTION)) {
        initFunc = this.parseFunctionDecl();
      } else {
        break;
      }
    }

    return {
      kind: 'ScreenDecl',
      line: token.line,
      column: token.column,
      name,
      initFunc,
      lines,
    };
  }

  private parseLineDecl(): LineDecl {
    const token = this.expect(TokenType.LINE, 'line');
    const name = this.expect(TokenType.IDENTIFIER, 'line name').value;

    return {
      kind: 'LineDecl',
      line: token.line,
      column: token.column,
      name,
      controls: [],
    };
  }

  private parseMenuDecl(): MenuDecl {
    const token = this.expect(TokenType.MENU, 'menu');
    const name = this.expect(TokenType.IDENTIFIER, 'menu name').value;
    const title = this.check(TokenType.STRING) ? this.advance().value : name;

    const items: MenuItemDecl[] = [];
    while (!this.isAtEnd() && this.check(TokenType.ITEM)) {
      items.push(this.parseMenuItemDecl());
    }

    return {
      kind: 'MenuDecl',
      line: token.line,
      column: token.column,
      name,
      title,
      items,
    };
  }

  private parseMenuItemDecl(): MenuItemDecl {
    const token = this.expect(TokenType.ITEM, 'item');
    const name = this.expect(TokenType.IDENTIFIER, 'item name').value;
    const label = this.check(TokenType.STRING) ? this.advance().value : name;

    return {
      kind: 'MenuItemDecl',
      line: token.line,
      column: token.column,
      name,
      label,
    };
  }

  private parseStateMachineDecl(): StateMachineDecl {
    const token = this.expect(TokenType.STATEMACHINE, 'statemachine');
    const name = this.expect(TokenType.IDENTIFIER, 'statemachine name').value;

    const states: StateDecl[] = [];
    while (!this.isAtEnd() && this.check(TokenType.STATE)) {
      states.push(this.parseStateDecl());
    }

    return {
      kind: 'StateMachineDecl',
      line: token.line,
      column: token.column,
      name,
      states,
    };
  }

  private parseStateDecl(): StateDecl {
    const token = this.expect(TokenType.STATE, 'state');
    const name = this.expect(TokenType.IDENTIFIER, 'state name').value;

    return {
      kind: 'StateDecl',
      line: token.line,
      column: token.column,
      name,
    };
  }

  // ============ Statements ============

  private parseStatements(until: TokenType): Statement[] {
    const stmts: Statement[] = [];
    
    while (!this.isAtEnd() && !this.check(until)) {
      stmts.push(this.parseStatement());
    }

    return stmts;
  }

  private parseStatement(): Statement {
    if (this.check(TokenType.IF)) return this.parseIfStmt();
    if (this.check(TokenType.WHILE)) return this.parseWhileStmt();
    if (this.check(TokenType.FOR)) return this.parseForStmt();
    if (this.check(TokenType.RETURN)) return this.parseReturnStmt();

    // Assignment or call
    const expr = this.parseExpression();
    
    if (this.match(TokenType.ASSIGN)) {
      const value = this.parseExpression();
      return {
        kind: 'AssignmentStmt',
        line: expr.line,
        column: expr.column,
        target: expr,
        value,
      };
    }

    if (expr.kind === 'CallExpr') {
      return {
        kind: 'CallStmt',
        line: expr.line,
        column: expr.column,
        name: (expr as CallExpr).name,
        args: (expr as CallExpr).args,
      };
    }

    throw this.error('Expected statement');
  }

  private parseIfStmt(): IfStmt {
    const token = this.expect(TokenType.IF, 'if');
    const condition = this.parseExpression();
    this.match(TokenType.THEN);

    const thenBranch = this.parseStatements(TokenType.ENDIF);
    const elseIfBranches: { condition: Expression; body: Statement[] }[] = [];
    let elseBranch: Statement[] | undefined;

    while (this.match(TokenType.ELSEIF)) {
      const cond = this.parseExpression();
      this.match(TokenType.THEN);
      const body = this.parseStatements(TokenType.ENDIF);
      elseIfBranches.push({ condition: cond, body });
    }

    if (this.match(TokenType.ELSE)) {
      elseBranch = this.parseStatements(TokenType.ENDIF);
    }

    this.expect(TokenType.ENDIF, 'endif');

    return {
      kind: 'IfStmt',
      line: token.line,
      column: token.column,
      condition,
      thenBranch,
      elseIfBranches,
      elseBranch,
    };
  }

  private parseWhileStmt(): WhileStmt {
    const token = this.expect(TokenType.WHILE, 'while');
    const condition = this.parseExpression();
    const body = this.parseStatements(TokenType.WEND);
    this.expect(TokenType.WEND, 'wend');

    return {
      kind: 'WhileStmt',
      line: token.line,
      column: token.column,
      condition,
      body,
    };
  }

  private parseForStmt(): ForStmt {
    const token = this.expect(TokenType.FOR, 'for');
    const variable = this.expect(TokenType.IDENTIFIER, 'variable').value;
    this.expect(TokenType.ASSIGN, '=');
    const start = this.parseExpression();
    this.expect(TokenType.TO, 'to');
    const end = this.parseExpression();
    
    let step: Expression | undefined;
    if (this.match(TokenType.STEP)) {
      step = this.parseExpression();
    }

    const body = this.parseStatements(TokenType.NEXT);
    this.expect(TokenType.NEXT, 'next');

    return {
      kind: 'ForStmt',
      line: token.line,
      column: token.column,
      variable,
      start,
      end,
      step,
      body,
    };
  }

  private parseReturnStmt(): ReturnStmt {
    const token = this.expect(TokenType.RETURN, 'return');
    let value: Expression | undefined;
    
    if (!this.isAtEnd() && !this.isStatementEnd()) {
      value = this.parseExpression();
    }

    return {
      kind: 'ReturnStmt',
      line: token.line,
      column: token.column,
      value,
    };
  }

  // ============ Expressions ============

  private parseExpression(): Expression {
    return this.parseOr();
  }

  private parseOr(): Expression {
    let left = this.parseAnd();

    while (this.match(TokenType.OR)) {
      const right = this.parseAnd();
      left = {
        kind: 'BinaryExpr',
        line: left.line,
        column: left.column,
        operator: 'or',
        left,
        right,
      };
    }

    return left;
  }

  private parseAnd(): Expression {
    let left = this.parseEquality();

    while (this.match(TokenType.AND)) {
      const right = this.parseEquality();
      left = {
        kind: 'BinaryExpr',
        line: left.line,
        column: left.column,
        operator: 'and',
        left,
        right,
      };
    }

    return left;
  }

  private parseEquality(): Expression {
    let left = this.parseComparison();

    while (this.match(TokenType.EQ, TokenType.NE)) {
      const op = this.previous().value;
      const right = this.parseComparison();
      left = {
        kind: 'BinaryExpr',
        line: left.line,
        column: left.column,
        operator: op,
        left,
        right,
      };
    }

    return left;
  }

  private parseComparison(): Expression {
    let left = this.parseTerm();

    while (this.match(TokenType.LT, TokenType.LE, TokenType.GT, TokenType.GE)) {
      const op = this.previous().value;
      const right = this.parseTerm();
      left = {
        kind: 'BinaryExpr',
        line: left.line,
        column: left.column,
        operator: op,
        left,
        right,
      };
    }

    return left;
  }

  private parseTerm(): Expression {
    let left = this.parseFactor();

    while (this.match(TokenType.PLUS, TokenType.MINUS)) {
      const op = this.previous().value;
      const right = this.parseFactor();
      left = {
        kind: 'BinaryExpr',
        line: left.line,
        column: left.column,
        operator: op,
        left,
        right,
      };
    }

    return left;
  }

  private parseFactor(): Expression {
    let left = this.parseUnary();

    while (this.match(TokenType.STAR, TokenType.SLASH, TokenType.PERCENT)) {
      const op = this.previous().value;
      const right = this.parseUnary();
      left = {
        kind: 'BinaryExpr',
        line: left.line,
        column: left.column,
        operator: op,
        left,
        right,
      };
    }

    return left;
  }

  private parseUnary(): Expression {
    if (this.match(TokenType.MINUS, TokenType.NOT)) {
      const op = this.previous().value;
      const operand = this.parseUnary();
      return {
        kind: 'UnaryExpr',
        line: this.previous().line,
        column: this.previous().column,
        operator: op,
        operand,
      };
    }

    return this.parseCall();
  }

  private parseCall(): Expression {
    let expr = this.parsePrimary();

    if (expr.kind === 'IdentifierExpr' && this.match(TokenType.LPAREN)) {
      const args: Expression[] = [];
      
      if (!this.check(TokenType.RPAREN)) {
        do {
          args.push(this.parseExpression());
        } while (this.match(TokenType.COMMA));
      }
      
      this.expect(TokenType.RPAREN, ')');
      
      return {
        kind: 'CallExpr',
        line: expr.line,
        column: expr.column,
        name: (expr as IdentifierExpr).name,
        args,
      };
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
      return { kind: 'LiteralExpr', line: token.line, column: token.column, type: 'int', value: parseInt(token.value) };
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

  private isTopLevel(): boolean {
    return this.check(TokenType.GLOBAL) || this.check(TokenType.VAR) ||
           this.check(TokenType.CONST) || this.check(TokenType.FUNCTION) ||
           this.check(TokenType.SCREEN) || this.check(TokenType.MENU) ||
           this.check(TokenType.STATEMACHINE);
  }

  private isStatementEnd(): boolean {
    return this.check(TokenType.ENDIF) || this.check(TokenType.ELSE) ||
           this.check(TokenType.ELSEIF) || this.check(TokenType.WEND) ||
           this.check(TokenType.NEXT) || this.check(TokenType.ENDFUNC);
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
