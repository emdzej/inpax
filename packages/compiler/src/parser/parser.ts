import { Token, TokenKind } from '../lexer/index.js';
import {
  AssignExpr, BinaryExpr, BinaryOperator, BlockStmt, BoolLiteral, BreakStmt, CallExpr,
  ContinueStmt, ControlDecl, ExprStmt, Expression, ForStmt, FunctionDecl, GlobalDecl,
  IdentExpr, IfStmt, ImportDecl, IndexExpr, IntLiteral, LineDecl, LocalDecl, LogicTableDecl,
  LogicTableEntry, MenuDecl, MenuItemDecl, ParamDirection, ParameterDecl, Program, RealLiteral,
  ReturnStmt, ScreenDecl, StateDecl, StateMachineDecl, Statement, StringLiteral, TypeRef,
  UnaryExpr, UnaryOperator, ValueTypeName, WhileStmt,
} from '../ast/index.js';

export class ParseError extends Error {
  constructor(
    message: string,
    public readonly line: number,
    public readonly column: number,
  ) {
    super(`${line}:${column}: ${message}`);
    this.name = 'ParseError';
  }
}

const TYPE_KEYWORDS = new Set<TokenKind>([
  'BOOL_T', 'BYTE_T', 'INT_T', 'LONG_T', 'REAL_T', 'STRING_T', 'STRUCTURE_T',
]);

const TYPE_NAMES: Record<string, ValueTypeName> = {
  BOOL_T: 'bool', BYTE_T: 'byte', INT_T: 'int',
  LONG_T: 'long', REAL_T: 'real', STRING_T: 'string',
  STRUCTURE_T: 'structure',
};

/**
 * Recursive-descent parser for the IPS language.
 *
 * The grammar is reconstructed from `docs/inpa-language-reference.md`,
 * `docs/reference/language-guide.md`, and observed source in
 * `~/Downloads/inpa/EC-APPS/INPA/CFGDAT/*.ips`. Bison-style error recovery
 * is intentionally omitted — INPACOMP-grade parser messages are not a
 * goal for a clean-room reimplementation.
 */
export class Parser {
  private pos = 0;
  constructor(private readonly tokens: Token[]) {}

  parse(): Program {
    const program: Program = {
      kind: 'Program',
      pragmas: [],
      globals: [],
      imports: [],
      functions: [],
      screens: [],
      menus: [],
      stateMachines: [],
      logicTables: [],
    };

    while (!this.eof()) {
      this.parseTopLevel(program);
    }
    return program;
  }

  // ============ Top-level ============

  private parseTopLevel(p: Program): void {
    if (this.check('SCREEN')) { p.screens.push(this.parseScreen()); return; }
    if (this.check('MENU')) { p.menus.push(this.parseMenu()); return; }
    if (this.check('STATEMACHINE')) { p.stateMachines.push(this.parseStateMachine()); return; }
    if (this.check('LOGTABLE')) { p.logicTables.push(this.parseLogicTable()); return; }
    if (this.check('IMPORT') || this.check('IMPORT32')) {
      p.imports.push(this.parseImport());
      return;
    }
    if (this.check('EXTERN')) {
      this.parseExtern();
      return;
    }

    // type-led: either a global variable or a function with a return type
    if (this.isTypeStart()) {
      const t = this.peek();
      const type = this.parseType();
      const name = this.expect('IDENT', 'identifier').text;
      if (this.check('LPAREN')) {
        p.functions.push(this.parseFunctionFromHere(name, t.line, t.column));
      } else {
        p.globals.push(this.parseGlobalRest(name, type, t.line, t.column));
      }
      return;
    }

    // void-returning function: `name(...) { ... }`
    if (this.check('IDENT')) {
      const t = this.peek();
      const name = this.advance().text;
      if (this.check('LPAREN')) {
        p.functions.push(this.parseFunctionFromHere(name, t.line, t.column));
        return;
      }
      throw this.error(`unexpected identifier '${name}'`);
    }

    throw this.error(`unexpected token '${this.peek().text}'`);
  }

  private parseGlobalRest(name: string, type: TypeRef, line: number, column: number): GlobalDecl {
    let initializer: Expression | undefined;
    if (this.match('ASSIGN')) {
      initializer = this.parseExpression();
    }
    this.expect('SEMI', "';'");
    return { kind: 'GlobalDecl', name, type, initializer, line, column };
  }

  // ============ Functions ============

  private parseFunctionFromHere(name: string, line: number, column: number): FunctionDecl {
    this.expect('LPAREN', "'('");
    const params = this.parseParamList();
    this.expect('RPAREN', "')'");
    this.expect('LBRACE', "'{'");
    const body = this.parseStatements();
    this.expect('RBRACE', "'}'");
    return { kind: 'FunctionDecl', name, params, body, line, column };
  }

  private parseParamList(): ParameterDecl[] {
    const params: ParameterDecl[] = [];
    if (this.check('RPAREN')) return params;

    let pendingDirection: ParamDirection | null = null;

    do {
      // Optional direction: `in:`, `out:`, `inout:`, `returns:`. Once set
      // it applies to subsequent params in the same comma group until
      // another direction appears.
      const direction = this.tryParseDirection();
      if (direction) pendingDirection = direction;
      const dir = (pendingDirection ?? 'in') as ParamDirection;

      const typeTok = this.peek();
      const type = this.parseType();
      // Multiple identifiers can share a single type (e.g. `in: bool i1 i2 i3`).
      // Each becomes a separate parameter.
      let first = true;
      while (this.check('IDENT')) {
        const id = this.advance();
        params.push({
          kind: 'ParameterDecl',
          name: id.text,
          type,
          direction: dir,
          line: typeTok.line,
          column: typeTok.column,
        });
        first = false;
        if (this.check('COMMA') || this.check('RPAREN')) break;
      }
      if (first) {
        throw this.error("expected parameter name");
      }
    } while (this.match('COMMA'));
    return params;
  }

  private tryParseDirection(): ParamDirection | null {
    const k = this.peek().kind;
    if (k === 'IN' || k === 'OUT' || k === 'INOUT' || k === 'RETURNS') {
      const direction = (
        k === 'IN' ? 'in' :
        k === 'OUT' ? 'out' :
        k === 'INOUT' ? 'inout' : 'returns'
      ) as ParamDirection;
      this.advance();
      this.expect('COLON', "':'");
      return direction;
    }
    return null;
  }

  // ============ Imports ============

  private parseImport(): ImportDecl {
    const startTok = this.advance(); // IMPORT or IMPORT32
    const is32 = startTok.kind === 'IMPORT32';
    const conv = this.expect('STRING', 'calling convention').string ?? '';
    this.expect('LIB', "'lib'");
    const symbol = this.expect('STRING', 'DLL::Symbol').string ?? '';
    const [dll, sym] = symbol.includes('::') ? symbol.split('::') : ['', symbol];
    const alias = this.expect('IDENT', 'alias').text;
    this.expect('LPAREN', "'('");
    const params = this.parseParamList();
    this.expect('RPAREN', "')'");
    this.expect('SEMI', "';'");
    return {
      kind: 'ImportDecl',
      is32,
      convention: conv,
      dll,
      symbol: sym,
      alias,
      params,
      line: startTok.line,
      column: startTok.column,
    };
  }

  private parseExtern(): void {
    // Skip a forward declaration line: `extern name(params);`
    // The compiler doesn't actually need these — inpa.h header
    // declarations are informational; system function IDs come from a
    // hardcoded table.
    this.advance(); // EXTERN
    // burn until semicolon
    let depth = 0;
    while (!this.eof()) {
      const tok = this.peek();
      if (tok.kind === 'LPAREN') depth++;
      else if (tok.kind === 'RPAREN') depth--;
      else if (tok.kind === 'SEMI' && depth === 0) {
        this.advance();
        return;
      }
      this.advance();
    }
  }

  // ============ UI Blocks ============

  private parseScreen(): ScreenDecl {
    const t = this.expect('SCREEN', 'SCREEN');
    const name = this.expect('IDENT', 'screen name').text;
    this.expect('LPAREN', "'('");
    this.expect('RPAREN', "')'");
    this.expect('LBRACE', "'{'");
    const body: Statement[] = [];
    const lines: LineDecl[] = [];
    while (!this.check('RBRACE') && !this.eof()) {
      if (this.check('LINE')) {
        lines.push(this.parseLine());
      } else {
        body.push(this.parseStatement());
      }
    }
    this.expect('RBRACE', "'}'");
    return { kind: 'ScreenDecl', name, body, lines, line: t.line, column: t.column };
  }

  private parseLine(): LineDecl {
    const t = this.expect('LINE', 'LINE');
    this.expect('LPAREN', "'('");
    const label = this.expect('STRING', 'label').string ?? '';
    this.expect('COMMA', "','");
    const tag = this.expect('STRING', 'tag').string ?? '';
    this.expect('RPAREN', "')'");
    this.expect('LBRACE', "'{'");
    const body: Statement[] = [];
    let control: ControlDecl | undefined;
    while (!this.check('RBRACE') && !this.eof()) {
      if (this.check('CONTROL')) {
        control = this.parseControl();
      } else {
        body.push(this.parseStatement());
      }
    }
    this.expect('RBRACE', "'}'");
    return { kind: 'LineDecl', label, tag, body, control, line: t.line, column: t.column };
  }

  private parseControl(): ControlDecl {
    const t = this.expect('CONTROL', 'CONTROL');
    this.expect('LBRACE', "'{'");
    const body = this.parseStatements();
    this.expect('RBRACE', "'}'");
    return { kind: 'ControlDecl', body, line: t.line, column: t.column };
  }

  private parseMenu(): MenuDecl {
    const t = this.expect('MENU', 'MENU');
    const name = this.expect('IDENT', 'menu name').text;
    this.expect('LPAREN', "'('");
    this.expect('RPAREN', "')'");
    this.expect('LBRACE', "'{'");
    const init: Statement[] = [];
    const items: MenuItemDecl[] = [];
    while (!this.check('RBRACE') && !this.eof()) {
      if (this.check('INIT')) {
        this.advance();
        this.expect('LBRACE', "'{'");
        init.push(...this.parseStatements());
        this.expect('RBRACE', "'}'");
      } else if (this.check('ITEM')) {
        items.push(this.parseMenuItem());
      } else {
        throw this.error('expected INIT or ITEM inside MENU');
      }
    }
    this.expect('RBRACE', "'}'");
    return { kind: 'MenuDecl', name, init, items, line: t.line, column: t.column };
  }

  private parseMenuItem(): MenuItemDecl {
    const t = this.expect('ITEM', 'ITEM');
    this.expect('LPAREN', "'('");
    const keyTok = this.expect('INT', 'menu key');
    const key = keyTok.numeric ?? 0;
    this.expect('COMMA', "','");
    const label = this.expect('STRING', 'label').string ?? '';
    this.expect('RPAREN', "')'");
    this.expect('LBRACE', "'{'");
    const body = this.parseStatements();
    this.expect('RBRACE', "'}'");
    return { kind: 'MenuItemDecl', key, label, body, line: t.line, column: t.column };
  }

  private parseStateMachine(): StateMachineDecl {
    const t = this.expect('STATEMACHINE', 'STATEMACHINE');
    const name = this.expect('IDENT', 'state machine name').text;
    this.expect('LPAREN', "'('");
    this.expect('RPAREN', "')'");
    this.expect('LBRACE', "'{'");
    const init: Statement[] = [];
    const states: StateDecl[] = [];
    while (!this.check('RBRACE') && !this.eof()) {
      if (this.check('INIT')) {
        this.advance();
        this.expect('LBRACE', "'{'");
        init.push(...this.parseStatements());
        this.expect('RBRACE', "'}'");
      } else if (this.check('IDENT')) {
        const idTok = this.advance();
        this.expect('LBRACE', "'{'");
        const body = this.parseStatements();
        this.expect('RBRACE', "'}'");
        states.push({
          kind: 'StateDecl',
          name: idTok.text,
          body,
          line: idTok.line,
          column: idTok.column,
        });
      } else {
        throw this.error('expected INIT or state inside STATEMACHINE');
      }
    }
    this.expect('RBRACE', "'}'");
    return {
      kind: 'StateMachineDecl',
      name,
      init,
      states,
      line: t.line,
      column: t.column,
    };
  }

  private parseLogicTable(): LogicTableDecl {
    const t = this.expect('LOGTABLE', 'LOGTABLE');
    const name = this.expect('IDENT', 'logic table name').text;
    this.expect('LPAREN', "'('");
    // outputs and inputs share parameter syntax with `out:` / `in:`.
    const outputs: ParameterDecl[] = [];
    const inputs: ParameterDecl[] = [];
    const params = this.parseParamList();
    this.expect('RPAREN', "')'");
    for (const p of params) {
      if (p.direction === 'out') outputs.push(p);
      else inputs.push(p);
    }
    this.expect('LBRACE', "'{'");
    const entries: LogicTableEntry[] = [];
    while (!this.check('RBRACE') && !this.eof()) {
      entries.push(this.parseLogicTableEntry());
    }
    this.expect('RBRACE', "'}'");
    return {
      kind: 'LogicTableDecl',
      name,
      outputs,
      inputs,
      entries,
      line: t.line,
      column: t.column,
    };
  }

  private parseLogicTableEntry(): LogicTableEntry {
    // `<input>: <output>;`  where each side is `0y<bits>` or `OTHER`.
    const tok = this.peek();
    let inputValue = 0;
    let inputMask = 0;
    if (this.check('OTHER')) {
      this.advance();
    } else {
      const p = this.expect('BITPATTERN', 'bit pattern or OTHER').pattern!;
      inputValue = p.value;
      inputMask = p.mask;
    }
    this.expect('COLON', "':'");
    let outputValue = 0;
    if (this.check('OTHER')) {
      this.advance();
    } else {
      const p = this.expect('BITPATTERN', 'bit pattern or OTHER').pattern!;
      outputValue = p.value;
    }
    // Trailing terminator is `;` per the language doc.
    if (this.check('SEMI')) this.advance();
    return {
      kind: 'LogicTableEntry',
      inputValue: inputValue >>> 0,
      inputMask: inputMask >>> 0,
      outputValue: outputValue >>> 0,
      line: tok.line,
      column: tok.column,
    };
  }

  // ============ Statements ============

  private parseStatements(): Statement[] {
    const out: Statement[] = [];
    while (!this.check('RBRACE') && !this.eof()) {
      out.push(this.parseStatement());
    }
    return out;
  }

  private parseStatement(): Statement {
    if (this.check('LBRACE')) return this.parseBlock();
    if (this.check('IF')) return this.parseIf();
    if (this.check('WHILE')) return this.parseWhile();
    // `for` is NOT in the INPA bison grammar — only `if_construct`
    // and `while_construct` exist (verified via Ghidra string scan).
    // Reject loudly so the user sees a clear error instead of us
    // silently emitting bytecode INPACOMP would never have produced.
    if (this.check('FOR')) {
      throw this.error(
        "'for' loops are not part of the INPA language — use 'while' instead",
      );
    }
    if (this.check('RETURN')) return this.parseReturn();
    if (this.check('BREAK')) {
      const t = this.advance();
      this.expect('SEMI', "';'");
      return { kind: 'BreakStmt', line: t.line, column: t.column } as BreakStmt;
    }
    if (this.check('CONTINUE')) {
      const t = this.advance();
      this.expect('SEMI', "';'");
      return { kind: 'ContinueStmt', line: t.line, column: t.column } as ContinueStmt;
    }
    if (this.isTypeStart()) return this.parseLocalDecl();

    const t = this.peek();
    const expr = this.parseExpression();
    this.expect('SEMI', "';'");
    return { kind: 'ExprStmt', expression: expr, line: t.line, column: t.column } as ExprStmt;
  }

  private parseBlock(): BlockStmt {
    const t = this.expect('LBRACE', "'{'");
    const statements = this.parseStatements();
    this.expect('RBRACE', "'}'");
    return { kind: 'BlockStmt', statements, line: t.line, column: t.column };
  }

  private parseIf(): IfStmt {
    const t = this.expect('IF', 'if');
    this.expect('LPAREN', "'('");
    const condition = this.parseExpression();
    this.expect('RPAREN', "')'");
    const then = this.parseStatement();
    let elseBranch: Statement | undefined;
    if (this.match('ELSE')) elseBranch = this.parseStatement();
    return {
      kind: 'IfStmt',
      condition,
      then,
      else: elseBranch,
      line: t.line,
      column: t.column,
    };
  }

  private parseWhile(): WhileStmt {
    const t = this.expect('WHILE', 'while');
    this.expect('LPAREN', "'('");
    const condition = this.parseExpression();
    this.expect('RPAREN', "')'");
    const body = this.parseStatement();
    return { kind: 'WhileStmt', condition, body, line: t.line, column: t.column };
  }

  private parseReturn(): ReturnStmt {
    const t = this.expect('RETURN', 'return');
    // INPA user functions don't return values — the convention is
    // `out:` / `inout:` parameters (every real BMW script does it this
    // way). The bison grammar has a `RETURN` token but no
    // `return_statement` rule visible in INPACOMP's string table, so
    // bare `return;` is plausible as an early-exit statement; a
    // `return <expr>;` form is not. Reject the value form to match
    // INPACOMP behaviour.
    if (!this.check('SEMI')) {
      throw this.error(
        "INPA does not support 'return <value>;' — use an out: parameter instead",
      );
    }
    this.expect('SEMI', "';'");
    return { kind: 'ReturnStmt', value: undefined, line: t.line, column: t.column };
  }

  private parseLocalDecl(): LocalDecl {
    const decl = this.parseLocalDeclInline();
    this.expect('SEMI', "';'");
    return decl;
  }

  private parseLocalDeclInline(): LocalDecl {
    const t = this.peek();
    const type = this.parseType();
    const name = this.expect('IDENT', 'variable name').text;
    let initializer: Expression | undefined;
    if (this.match('ASSIGN')) initializer = this.parseExpression();
    return {
      kind: 'LocalDecl',
      name,
      type,
      initializer,
      line: t.line,
      column: t.column,
    };
  }

  // ============ Types ============

  private parseType(): TypeRef {
    const t = this.peek();
    if (!TYPE_KEYWORDS.has(t.kind)) {
      throw this.error(`expected type, got '${t.text}'`);
    }
    this.advance();
    const name = TYPE_NAMES[t.kind];
    let arraySize: number | undefined;
    if (this.match('LBRACKET')) {
      if (!this.check('RBRACKET')) {
        arraySize = this.expect('INT', 'array size').numeric ?? 0;
      }
      this.expect('RBRACKET', "']'");
    }
    return { name, arraySize, line: t.line, column: t.column };
  }

  private isTypeStart(): boolean {
    return TYPE_KEYWORDS.has(this.peek().kind);
  }

  // ============ Expressions (Pratt-ish precedence climbing) ============

  private parseExpression(): Expression {
    return this.parseAssignment();
  }

  private parseAssignment(): Expression {
    const left = this.parseLogicalOr();
    if (this.match('ASSIGN')) {
      const value = this.parseAssignment();
      return {
        kind: 'AssignExpr',
        target: left,
        value,
        line: left.line,
        column: left.column,
      } as AssignExpr;
    }
    return left;
  }

  private parseLogicalOr(): Expression {
    let left = this.parseLogicalAnd();
    while (this.check('PIPEPIPE') || this.check('OR_KW')) {
      this.advance();
      const right = this.parseLogicalAnd();
      left = this.bin('||', left, right);
    }
    return left;
  }

  private parseLogicalAnd(): Expression {
    let left = this.parseBitOr();
    while (this.check('AMPAMP') || this.check('AND_KW')) {
      this.advance();
      const right = this.parseBitOr();
      left = this.bin('&&', left, right);
    }
    return left;
  }

  private parseBitOr(): Expression {
    let left = this.parseBitXor();
    while (this.match('PIPE')) {
      const right = this.parseBitXor();
      left = this.bin('|', left, right);
    }
    return left;
  }

  private parseBitXor(): Expression {
    let left = this.parseBitAnd();
    while (this.match('CARET')) {
      const right = this.parseBitAnd();
      left = this.bin('^', left, right);
    }
    return left;
  }

  private parseBitAnd(): Expression {
    let left = this.parseEquality();
    while (this.match('AMP')) {
      const right = this.parseEquality();
      left = this.bin('&', left, right);
    }
    return left;
  }

  private parseEquality(): Expression {
    let left = this.parseRelational();
    while (this.check('EQ') || this.check('NE')) {
      const op = this.advance().kind === 'EQ' ? '==' : '!=';
      const right = this.parseRelational();
      left = this.bin(op as BinaryOperator, left, right);
    }
    return left;
  }

  private parseRelational(): Expression {
    let left = this.parseAdditive();
    while (
      this.check('LT') || this.check('LE') ||
      this.check('GT') || this.check('GE')
    ) {
      const k = this.advance().kind;
      const op = (k === 'LT' ? '<' : k === 'LE' ? '<=' : k === 'GT' ? '>' : '>=') as BinaryOperator;
      const right = this.parseAdditive();
      left = this.bin(op, left, right);
    }
    return left;
  }

  private parseAdditive(): Expression {
    let left = this.parseMultiplicative();
    while (this.check('PLUS') || this.check('MINUS')) {
      const op = (this.advance().kind === 'PLUS' ? '+' : '-') as BinaryOperator;
      const right = this.parseMultiplicative();
      left = this.bin(op, left, right);
    }
    return left;
  }

  private parseMultiplicative(): Expression {
    let left = this.parseUnary();
    while (this.check('STAR') || this.check('SLASH') || this.check('PERCENT')) {
      // Modulo `%` has no ALU sub-op in the documented opcode table
      // and no `MOD` token in INPACOMP's grammar — reject at parse
      // time rather than emit bytecode the VM can't execute.
      if (this.check('PERCENT')) {
        throw this.error("modulo '%' is not part of the INPA language");
      }
      const k = this.advance().kind;
      const op = (k === 'STAR' ? '*' : '/') as BinaryOperator;
      const right = this.parseUnary();
      left = this.bin(op, left, right);
    }
    return left;
  }

  private parseUnary(): Expression {
    if (this.match('MINUS')) {
      const t = this.previous();
      const operand = this.parseUnary();
      return {
        kind: 'UnaryExpr',
        operator: '-',
        operand,
        line: t.line,
        column: t.column,
      } as UnaryExpr;
    }
    if (this.match('BANG') || this.match('NOT_KW')) {
      const t = this.previous();
      const operand = this.parseUnary();
      return {
        kind: 'UnaryExpr',
        operator: '!',
        operand,
        line: t.line,
        column: t.column,
      } as UnaryExpr;
    }
    // INPA has no `++` / `--` (prefix or postfix). The lexer still
    // produces a single PLUSPLUS / MINUSMINUS token to avoid having
    // `x ++ 1` parse silently as `x + +1`; we reject it here with a
    // clear message rather than letting it fall through to `parsePostfix`.
    if (this.check('PLUSPLUS') || this.check('MINUSMINUS')) {
      throw this.error(
        `'${this.peek().text}' is not part of the INPA language`,
      );
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Expression {
    let expr = this.parsePrimary();
    while (true) {
      if (this.match('LPAREN')) {
        const args: Expression[] = [];
        if (!this.check('RPAREN')) {
          do { args.push(this.parseExpression()); } while (this.match('COMMA'));
        }
        this.expect('RPAREN', "')'");
        if (expr.kind !== 'IdentExpr') {
          throw this.error('only simple identifiers can be called');
        }
        expr = {
          kind: 'CallExpr',
          callee: expr.name,
          args,
          line: expr.line,
          column: expr.column,
        } as CallExpr;
      } else if (this.check('LBRACKET')) {
        // No `arr[i]` operator exists in INPA — `[N]` only appears as
        // a buffer-length suffix on a *type* (`string[80] buf`). A
        // postfix `[` on an expression therefore can't be valid.
        throw this.error(
          "array indexing 'expr[i]' is not part of the INPA language",
        );
      } else if (this.check('PLUSPLUS') || this.check('MINUSMINUS')) {
        throw this.error(
          `'${this.peek().text}' is not part of the INPA language`,
        );
      } else {
        break;
      }
    }
    return expr;
  }

  private parsePrimary(): Expression {
    const t = this.peek();
    if (this.match('TRUE')) {
      return { kind: 'BoolLiteral', value: true, line: t.line, column: t.column } as BoolLiteral;
    }
    if (this.match('FALSE')) {
      return { kind: 'BoolLiteral', value: false, line: t.line, column: t.column } as BoolLiteral;
    }
    if (this.check('INT')) {
      const tok = this.advance();
      return {
        kind: 'IntLiteral',
        value: tok.numeric ?? 0,
        wide: false,
        line: tok.line,
        column: tok.column,
      } as IntLiteral;
    }
    if (this.check('REAL')) {
      const tok = this.advance();
      return {
        kind: 'RealLiteral',
        value: tok.numeric ?? 0,
        line: tok.line,
        column: tok.column,
      } as RealLiteral;
    }
    if (this.check('STRING')) {
      const tok = this.advance();
      return {
        kind: 'StringLiteral',
        value: tok.string ?? '',
        line: tok.line,
        column: tok.column,
      } as StringLiteral;
    }
    if (this.check('IDENT')) {
      const tok = this.advance();
      return {
        kind: 'IdentExpr',
        name: tok.text,
        line: tok.line,
        column: tok.column,
      } as IdentExpr;
    }
    if (this.match('LPAREN')) {
      const expr = this.parseExpression();
      this.expect('RPAREN', "')'");
      return expr;
    }
    throw this.error(`unexpected token '${t.text}' in expression`);
  }

  private bin(op: BinaryOperator, left: Expression, right: Expression): BinaryExpr {
    return {
      kind: 'BinaryExpr',
      operator: op,
      left,
      right,
      line: left.line,
      column: left.column,
    };
  }

  private unary(op: UnaryOperator, operand: Expression, t: Token): UnaryExpr {
    return {
      kind: 'UnaryExpr',
      operator: op,
      operand,
      line: t.line,
      column: t.column,
    };
  }

  // ============ Token helpers ============

  private peek(): Token { return this.tokens[this.pos]; }
  private previous(): Token { return this.tokens[this.pos - 1]; }
  private eof(): boolean { return this.peek().kind === 'EOF'; }

  private check(kind: TokenKind): boolean {
    return this.peek().kind === kind;
  }

  private match(kind: TokenKind): boolean {
    if (this.check(kind)) { this.advance(); return true; }
    return false;
  }

  private advance(): Token {
    const tok = this.tokens[this.pos];
    if (!this.eof()) this.pos++;
    return tok;
  }

  private expect(kind: TokenKind, what: string): Token {
    if (this.check(kind)) return this.advance();
    throw this.error(`expected ${what}, got '${this.peek().text}'`);
  }

  private error(message: string): ParseError {
    const t = this.peek();
    return new ParseError(message, t.line, t.column);
  }
}

export function parse(tokens: Token[]): Program {
  return new Parser(tokens).parse();
}
