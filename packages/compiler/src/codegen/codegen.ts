import { AluOp, Opcode, Scope, SystemFunction, ValueType } from '@emdzej/inpax-core';
import {
  AssignExpr, BinaryExpr, BinaryOperator, BlockStmt, BoolLiteral, CallExpr,
  ExprStmt, Expression, ForStmt, FunctionDecl, IdentExpr, IfStmt, IntLiteral,
  LocalDecl, ParameterDecl, RealLiteral, ReturnStmt, Statement, StringLiteral,
  UnaryExpr, WhileStmt,
} from '../ast/index.js';
import {
  FUNC_ID_INPAEXIT, FUNC_ID_INPAINIT, FUNC_ID_SHUTDOWN, FUNC_ID_STARTUP,
  FunctionInfo, GlobalInfo, ImportInfo, LocalInfo, SemanticError,
  SymbolTable,
} from '../semantic/index.js';
import { ConstantPool } from './constant-pool.js';
import {
  Instruction, alloc, alu, callExternal, callSystem, callUser, frame, instr,
  jmp, jmpnz, load, loadInOutRef, logtable, move, pushImmInt, pushR, pushRefOut,
  pushRefStore, ret, typeMarkerFor,
} from './encoding.js';
import { ValueType as VT } from '@emdzej/inpax-core';

export class CodegenError extends Error {
  constructor(
    message: string,
    public readonly line: number,
    public readonly column: number,
  ) {
    super(`${line}:${column}: ${message}`);
    this.name = 'CodegenError';
  }
}

export interface CompiledFunction {
  readonly id: number;
  readonly name: string;
  readonly instructions: Instruction[];
}

export interface CompiledLine {
  readonly label: string;
  readonly tag: string;
  /** LineFunc (0x22) body instructions. */
  readonly bodyInstructions: Instruction[];
  /** Optional ControlFunc (0x23) — present if a `CONTROL { ... }` was declared. */
  readonly controlInstructions?: Instruction[];
}

export interface CompiledScreen {
  readonly id: number;
  readonly name: string;
  /** Screen block (0x01) instructions — usually empty unless the SCREEN
   *  itself declares locals (not supported yet). */
  readonly screenInstructions: Instruction[];
  /** ScreenFunc (0x21) instructions — the screen body outside any LINE. */
  readonly bodyInstructions: Instruction[];
  readonly lines: CompiledLine[];
}

export interface CompiledMenuItem {
  readonly key: number;
  readonly label: string;
  readonly bodyInstructions: Instruction[];
}

export interface CompiledMenu {
  readonly id: number;
  readonly name: string;
  /** Menu block (0x02) instructions — runs as INIT. */
  readonly initInstructions: Instruction[];
  readonly items: CompiledMenuItem[];
}

export interface CompiledState {
  readonly name: string;
  readonly bodyInstructions: Instruction[];
}

export interface CompiledStateMachine {
  readonly id: number;
  readonly name: string;
  /** StateMachine block (0x03) instructions = the INIT block body. */
  readonly initInstructions: Instruction[];
  readonly states: CompiledState[];
}

export interface CompiledLogicTableEntry {
  readonly inputValue: number;
  readonly inputMask: number;
  readonly outputValue: number;
}

export interface CompiledLogicTable {
  /** Function block (0x05) ID — allocated alongside user funcs (>= 4). */
  readonly funcId: number;
  readonly name: string;
  /** Number of input bits (PUSHIMM INT inside the lookup function). */
  readonly inputBits: number;
  /** Number of output bits (PUSHIMM INT inside the lookup function). */
  readonly outputBits: number;
  /** Entries for the type-0x04 data block that follows the function. */
  readonly entries: CompiledLogicTableEntry[];
}

export interface CodegenResult {
  readonly constants: ConstantPool;
  readonly globals: ReadonlyArray<GlobalInfo>;
  /** Source-declared functions, in source order (id >= 4). */
  readonly userFunctions: CompiledFunction[];
  readonly screens: CompiledScreen[];
  readonly menus: CompiledMenu[];
  readonly stateMachines: CompiledStateMachine[];
  readonly logicTables: CompiledLogicTable[];
  readonly inpainit: CompiledFunction;
  readonly inpaexit: CompiledFunction;
  /** Synthetic `__inpa_startup__` (id 0). */
  readonly startup: CompiledFunction;
  /** Synthetic `__inpa_shutdown__` (id 1). */
  readonly shutdown: CompiledFunction;
}

const SYSTEM_FN_LOOKUP: Map<string, number> = (() => {
  const m = new Map<string, number>();
  for (const [name, value] of Object.entries(SystemFunction)) {
    if (typeof value === 'number') m.set(name.toLowerCase(), value);
  }
  return m;
})();

function aluOpFor(op: BinaryOperator): AluOp {
  switch (op) {
    case '+':  return AluOp.ADD;
    case '-':  return AluOp.SUB;
    case '*':  return AluOp.MUL;
    case '/':  return AluOp.DIV;
    case '<':  return AluOp.LT;
    case '>':  return AluOp.GT;
    case '<=': return AluOp.LE;
    case '>=': return AluOp.GE;
    case '==': return AluOp.EQ;
    case '!=': return AluOp.NE;
    case '&&': return AluOp.AND;
    case '||': return AluOp.OR;
    case '^^': return AluOp.XOR;
    case '&':  return AluOp.BAND;
    case '|':  return AluOp.BOR;
    case '^':  return AluOp.BXOR;
    // `%` has no direct ALU op in the documented table; reject for now.
    case '%':
      throw new Error('modulo is not supported by the IPO VM (no ALU op)');
  }
}

export class Codegen {
  private current?: FunctionInfo;
  private readonly constants = new ConstantPool();
  /** Memoises the constant index for each import's descriptor string. */
  private readonly importDescriptorConst = new Map<string, number>();

  constructor(private readonly symbols: SymbolTable) {}

  compile(): CodegenResult {
    const userFunctions = this.symbols.userFunctions.map((fn) =>
      this.compileFunction(fn),
    );
    const menus = this.symbols.menus.map((info) => this.compileMenu(info.id, info.decl));
    const screens = this.symbols.screens.map((info) => this.compileScreen(info.id, info.decl));
    const stateMachines = this.symbols.stateMachines.map((info) =>
      this.compileStateMachine(info.id, info.decl),
    );
    const logicTables = this.symbols.logicTables.map((info) =>
      this.compileLogicTable(info.funcId, info.decl),
    );
    const inpainit = this.compileFunction(this.symbols.inpainit);
    const inpaexit = this.compileFunction(this.symbols.inpaexit);

    return {
      constants: this.constants,
      globals: this.symbols.globals,
      userFunctions,
      menus,
      screens,
      stateMachines,
      logicTables,
      inpainit,
      inpaexit,
      startup: this.synthStartup(),
      shutdown: this.synthShutdown(),
    };
  }

  private compileStateMachine(
    id: number,
    decl: import('../ast/index.js').StateMachineDecl,
  ): CompiledStateMachine {
    return {
      id,
      name: decl.name,
      initInstructions: this.compileBlockBody(decl.init, 'STATEMACHINE INIT'),
      states: decl.states.map((s) => ({
        name: s.name,
        bodyInstructions: this.compileBlockBody(s.body, `STATE ${s.name}`),
      })),
    };
  }

  /**
   * Compile a LOGTABLE — a declarative truth table that real INPACOMP
   * lowers into a two-block pair:
   *   * a `0x05` function `lt_<name>` containing
   *       PUSHIMM INT <input-bit-width>
   *       PUSHIMM INT <output-bit-width>
   *       LOGTABLE 0x44 0
   *       RET
   *   * a `0x04` data block named ` LT_<name>` (with the leading space)
   *     holding `<count>` × 3×u32 entries (input, mask, output).
   *
   * Verified against EHC_2.IPO's `handst` logic table at file offset
   * 0xE7A. The `0x44` magic on the LOGTABLE op was constant across all
   * samples — purpose unknown, but emit verbatim until we learn more.
   *
   * Bit widths are derived from the entry data: the input/output widths
   * are the position of the highest set bit across all observed values
   * and masks. Source `0y` literals don't carry their declared width
   * explicitly, so this is the closest reproduction we can do without
   * threading the bit count through the AST.
   */
  private compileLogicTable(
    funcId: number,
    decl: import('../ast/index.js').LogicTableDecl,
  ): CompiledLogicTable {
    const entries = decl.entries.map((e) => ({
      inputValue: e.inputValue >>> 0,
      inputMask: e.inputMask >>> 0,
      outputValue: e.outputValue >>> 0,
    }));
    // Bit width = (number of `in:` / `out:` parameters), one bit each
    // since LOGTABLE only operates on bool parameters per the docs.
    const inputBits = decl.inputs.length;
    const outputBits = decl.outputs.length;
    return { funcId, name: decl.name, inputBits, outputBits, entries };
  }

  // ============ Screen / Menu compilation ============

  private compileScreen(id: number, decl: import('../ast/index.js').ScreenDecl): CompiledScreen {
    return {
      id,
      name: decl.name,
      // Screen-scope locals (declared at the SCREEN level) would emit
      // ALLOCs here. Not supported in stage 2d.
      screenInstructions: [],
      bodyInstructions: this.compileBlockBody(decl.body, 'SCREEN'),
      lines: decl.lines.map((l) => ({
        label: l.label,
        tag: l.tag,
        bodyInstructions: this.compileBlockBody(l.body, 'LINE'),
        controlInstructions: l.control
          ? this.compileBlockBody(l.control.body, 'CONTROL')
          : undefined,
      })),
    };
  }

  private compileMenu(id: number, decl: import('../ast/index.js').MenuDecl): CompiledMenu {
    return {
      id,
      name: decl.name,
      initInstructions: this.compileBlockBody(decl.init, 'MENU INIT'),
      items: decl.items.map((it) => ({
        key: it.key,
        label: it.label,
        bodyInstructions: this.compileBlockBody(it.body, 'MENU ITEM'),
      })),
    };
  }

  /**
   * Compile a sequence of statements that do not belong to a regular
   * function — i.e. SCREEN body, LINE body, CONTROL body, MENU INIT or
   * MENU ITEM. These have no local variables (yet) and no parameters,
   * so identifier references must resolve to globals.
   */
  private compileBlockBody(body: import('../ast/index.js').Statement[], context: string): Instruction[] {
    const out: Instruction[] = [];
    const prev = this.current;
    this.current = undefined;
    for (const stmt of body) {
      if (stmt.kind === 'LocalDecl') {
        throw new CodegenError(
          `local variables inside ${context} are not supported yet`,
          stmt.line,
          stmt.column,
        );
      }
      this.emitStatement(out, stmt);
    }
    this.current = prev;
    return out;
  }

  /**
   * Build the synthetic `__inpa_startup__` function (block ID 0).
   *
   * Real INPACOMP emits global-initializer triples before the
   * `FRAME; CALL_USER inpainit` epilogue — one
   *   LOAD CONST <init-expr>
   *   PUSHR GLOBAL <slot>
   *   MOVE 0, 1
   * per global declared with `= <expr>` in source order (see the
   * prologue of `__inpa_startup__` in `disasm/startus.txt` around
   * 0x20EE: `LOAD CONST #[2] / LOADREF GLOBAL #[1] / STORE` …).
   *
   * Without this prologue every global starts at its type default,
   * silently breaking scripts that rely on literal initialisers like
   * `string CR="?"` (the carriage-return marker used throughout
   * BMW_STD.H).
   */
  private synthStartup(): CompiledFunction {
    const out: Instruction[] = [];
    // `emitExpression` reads `this.current` to resolve identifiers;
    // global initializers run *outside* any user function, so locals
    // and params are not in scope — only globals, constants, and
    // already-initialised globals are legal references. Setting
    // `current` to undefined makes `lookupLocal` always miss, so
    // resolution falls through to the global table directly.
    this.current = undefined;
    for (const g of this.symbols.globals) {
      if (!g.decl.initializer) continue;
      this.emitExpression(out, g.decl.initializer);
      out.push(pushR(Scope.Global, g.slot));
      out.push(move());
    }
    out.push(frame());
    out.push(callUser(FUNC_ID_INPAINIT));
    return {
      id: FUNC_ID_STARTUP,
      name: '__inpa_startup__',
      instructions: out,
    };
  }

  /**
   * Build the synthetic `__inpa_shutdown__` function (block ID 1).
   * Just `FRAME; CALL_USER inpaexit` — real INPACOMP emits no
   * per-global teardown either.
   */
  private synthShutdown(): CompiledFunction {
    return {
      id: FUNC_ID_SHUTDOWN,
      name: '__inpa_shutdown__',
      instructions: [frame(), callUser(FUNC_ID_INPAEXIT)],
    };
  }

  private compileFunction(fn: FunctionInfo): CompiledFunction {
    this.current = fn;
    const out: Instruction[] = [];
    // Reserve a stack slot for every declared local. Parameters live in
    // slots already pushed by the caller — only non-params need ALLOC.
    // Initialisers are emitted lazily when their LocalDecl is visited
    // inside the body, just like INPACOMP does.
    for (const local of fn.locals) {
      if (local.direction === 'local') {
        out.push(alloc(typeMarkerFor(local.type)));
      }
    }
    for (const stmt of fn.decl.body) {
      this.emitStatement(out, stmt);
    }
    out.push(ret());
    this.current = undefined;
    return { id: fn.id, name: fn.name, instructions: out };
  }

  // ============ Statements ============

  private emitStatement(out: Instruction[], stmt: Statement): void {
    switch (stmt.kind) {
      case 'BlockStmt':
        for (const s of stmt.statements) this.emitStatement(out, s);
        return;
      case 'ExprStmt':
        this.emitExpression(out, stmt.expression);
        return;
      case 'LocalDecl':
        this.emitLocalInit(out, stmt);
        return;
      case 'IfStmt':
        this.emitIf(out, stmt);
        return;
      case 'WhileStmt':
        this.emitWhile(out, stmt);
        return;
      case 'ForStmt':
        this.emitFor(out, stmt);
        return;
      case 'ReturnStmt':
        this.emitReturn(out, stmt);
        return;
      case 'BreakStmt':
      case 'ContinueStmt':
        // Loop control: requires backpatched jumps; revisit in stage 2b.
        throw new CodegenError(
          `${stmt.kind} not implemented yet`,
          stmt.line,
          stmt.column,
        );
    }
  }

  private emitLocalInit(out: Instruction[], decl: LocalDecl): void {
    if (!decl.initializer) return;
    const local = this.requireLocal(decl.name, decl.line, decl.column);
    this.emitAssign(out, local, decl.initializer);
  }

  private emitAssign(
    out: Instruction[],
    target: LocalInfo | GlobalInfo,
    value: Expression,
  ): void {
    this.emitExpression(out, value);
    if (isLocal(target) && isRefParam(target)) {
      // Writing to an `out:` / `inout:` parameter goes through the ref
      // descriptor the caller placed in our local slot — see
      // `disasm/mj-concat.txt` outstr / outint.
      out.push(pushRefOut(Scope.Local, target.slot));
    } else {
      const scope = isLocal(target) ? Scope.Local : Scope.Global;
      out.push(pushR(scope, target.slot));
    }
    out.push(move());
  }

  private emitIf(out: Instruction[], stmt: IfStmt): void {
    this.emitCondition(out, stmt.condition);
    // JMPNZ is the misnamed "jump if condition register is 0 (false)"
    // — i.e. skip the THEN branch when the predicate evaluated false.
    const jumpToElse = out.length;
    out.push(jmpnz());
    this.emitStatement(out, stmt.then);
    if (stmt.else) {
      const jumpToEnd = out.length;
      out.push(jmp());
      this.patchJump(out, jumpToElse, out.length);
      this.emitStatement(out, stmt.else);
      this.patchJump(out, jumpToEnd, out.length);
    } else {
      this.patchJump(out, jumpToElse, out.length);
    }
  }

  private emitWhile(out: Instruction[], stmt: WhileStmt): void {
    const loopStart = out.length;
    this.emitCondition(out, stmt.condition);
    const exitJump = out.length;
    out.push(jmpnz());
    this.emitStatement(out, stmt.body);
    out.push(jmp(loopStart));
    this.patchJump(out, exitJump, out.length);
  }

  private emitFor(out: Instruction[], stmt: ForStmt): void {
    if (stmt.init) {
      if ((stmt.init as LocalDecl).kind === 'LocalDecl') {
        this.emitLocalInit(out, stmt.init as LocalDecl);
      } else {
        this.emitExpression(out, stmt.init as Expression);
      }
    }
    const loopStart = out.length;
    const exitJump = stmt.condition ? this.beginConditionalJump(out, stmt.condition) : -1;
    this.emitStatement(out, stmt.body);
    if (stmt.update) this.emitExpression(out, stmt.update);
    out.push(jmp(loopStart));
    if (exitJump >= 0) this.patchJump(out, exitJump, out.length);
  }

  /**
   * Emits a predicate expression followed by `MOVE 0,1`. The MOVE
   * (a) copies the top-of-stack bool into the VM's condition register
   * (which JMPNZ reads) and (b) pops it so the stack stays balanced.
   * This matches the pattern observed in real INPA bytecode — see the
   * comparison sequences in `disasm/alu.txt`.
   */
  private emitCondition(out: Instruction[], expr: Expression): void {
    this.emitExpression(out, expr);
    out.push(move());
  }

  private beginConditionalJump(out: Instruction[], expr: Expression): number {
    this.emitCondition(out, expr);
    const site = out.length;
    out.push(jmpnz());
    return site;
  }

  private emitReturn(out: Instruction[], stmt: ReturnStmt): void {
    if (stmt.value) {
      this.emitExpression(out, stmt.value);
    }
    out.push(ret());
  }

  // ============ Expressions ============

  private emitExpression(out: Instruction[], expr: Expression): void {
    switch (expr.kind) {
      case 'BoolLiteral':   return this.emitBool(out, expr);
      case 'IntLiteral':    return this.emitInt(out, expr);
      case 'RealLiteral':   return this.emitReal(out, expr);
      case 'StringLiteral': return this.emitString(out, expr);
      case 'IdentExpr':     return this.emitIdent(out, expr);
      case 'UnaryExpr':     return this.emitUnary(out, expr);
      case 'BinaryExpr':    return this.emitBinary(out, expr);
      case 'AssignExpr':    return this.emitAssignExpr(out, expr);
      case 'CallExpr':      return this.emitCall(out, expr);
      case 'IndexExpr':
        throw new CodegenError(
          'array indexing is not implemented yet',
          expr.line,
          expr.column,
        );
    }
  }

  private emitBool(out: Instruction[], expr: BoolLiteral): void {
    const idx = this.constants.add(ValueType.Bool, expr.value);
    out.push(load(Scope.Const, idx));
  }

  private emitInt(out: Instruction[], expr: IntLiteral): void {
    const type = expr.wide ? ValueType.Long : ValueType.Int;
    const idx = this.constants.add(type, expr.value);
    out.push(load(Scope.Const, idx));
  }

  private emitReal(out: Instruction[], expr: RealLiteral): void {
    const idx = this.constants.add(ValueType.Real, expr.value);
    out.push(load(Scope.Const, idx));
  }

  private emitString(out: Instruction[], expr: StringLiteral): void {
    const idx = this.constants.add(ValueType.String, expr.value);
    out.push(load(Scope.Const, idx));
  }

  private emitIdent(out: Instruction[], expr: IdentExpr): void {
    const local = this.lookupLocal(expr.name);
    if (local) {
      // Reading an `out:`/`inout:` parameter needs the ref-aware load
      // path (0x03 LOADINOUTREF), so the VM follows the descriptor to
      // the caller's variable rather than returning the descriptor
      // itself.
      if (isRefParam(local)) {
        out.push(loadInOutRef(Scope.Local, local.slot));
      } else {
        out.push(load(Scope.Local, local.slot));
      }
      return;
    }
    const global = this.symbols.globalsByName.get(expr.name);
    if (global) {
      out.push(load(Scope.Global, global.slot));
      return;
    }
    const handle = this.resolveHandle(expr.name);
    if (handle) {
      // Screen / Menu / StateMachine handles: pushed via PUSHREF (0x02)
      // with the scope distinguishing the kind — matches the docs and
      // the disasm snippet `02 41 00 00 ; STOREREF Menu #[0]`.
      out.push(pushRefStore(handle.scope, handle.id));
      return;
    }
    throw new CodegenError(
      `unknown identifier '${expr.name}'`,
      expr.line,
      expr.column,
    );
  }

  private resolveHandle(name: string): { scope: Scope; id: number } | undefined {
    for (const s of this.symbols.screens) {
      if (s.name === name) return { scope: Scope.Screen, id: s.id };
    }
    for (const m of this.symbols.menus) {
      if (m.name === name) return { scope: Scope.Menu, id: m.id };
    }
    for (const sm of this.symbols.stateMachines) {
      if (sm.name === name) return { scope: Scope.StateMachine, id: sm.id };
    }
    return undefined;
  }

  private emitUnary(out: Instruction[], expr: UnaryExpr): void {
    switch (expr.operator) {
      case '-':
        this.emitExpression(out, expr.operand);
        out.push(alu(AluOp.NEG));
        return;
      case '!':
        this.emitExpression(out, expr.operand);
        out.push(alu(AluOp.NOT));
        return;
      case '++pre': case '--pre': case '++post': case '--post':
        throw new CodegenError(
          `${expr.operator} not implemented yet`,
          expr.line,
          expr.column,
        );
    }
  }

  private emitBinary(out: Instruction[], expr: BinaryExpr): void {
    this.emitExpression(out, expr.left);
    this.emitExpression(out, expr.right);
    out.push(alu(aluOpFor(expr.operator)));
  }

  private emitAssignExpr(out: Instruction[], expr: AssignExpr): void {
    if (expr.target.kind !== 'IdentExpr') {
      throw new CodegenError(
        'assignment target must be an identifier',
        expr.line,
        expr.column,
      );
    }
    const target = this.resolveLValue(expr.target);
    this.emitAssign(out, target, expr.value);
  }

  private emitCall(out: Instruction[], expr: CallExpr): void {
    out.push(frame());
    const userFn = this.symbols.functions.get(expr.callee);
    if (userFn) {
      this.emitUserCallArgs(out, expr, userFn);
      out.push(callUser(userFn.id));
      return;
    }
    const importFn = this.symbols.imports.get(expr.callee);
    if (importFn) {
      this.emitImportCallArgs(out, expr, importFn);
      out.push(callExternal(this.descriptorConstIndex(importFn)));
      return;
    }
    const sysId = SYSTEM_FN_LOOKUP.get(expr.callee.toLowerCase());
    if (sysId !== undefined) {
      // For stage 2a: only support all-`in:` system functions. Push
      // each arg as a value.
      for (const arg of expr.args) this.emitExpression(out, arg);
      out.push(callSystem(sysId));
      return;
    }
    throw new CodegenError(
      `unknown function '${expr.callee}'`,
      expr.line,
      expr.column,
    );
  }

  private emitImportCallArgs(
    out: Instruction[],
    call: CallExpr,
    imp: ImportInfo,
  ): void {
    // `returns:` is encoded as `%X` in the descriptor — the runtime
    // uses it as a hint that the slot is the C-style return value — but
    // at the callsite it still consumes an argument, exactly like an
    // `out:` parameter (see usages in startus.ips, e.g.
    // `ApiSetConfig(Handle,"APITRACE","0",Returned)` where the 4th arg
    // fills the `returns: int ReturnedValue` slot).
    if (call.args.length !== imp.decl.params.length) {
      throw new CodegenError(
        `'${imp.alias}' expects ${imp.decl.params.length} arguments, got ${call.args.length}`,
        call.line,
        call.column,
      );
    }
    for (let i = 0; i < call.args.length; i++) {
      const param = imp.decl.params[i];
      const arg = call.args[i];
      if (param.direction === 'in') {
        this.emitExpression(out, arg);
      } else {
        // out / inout / returns all expect a writable destination at
        // the callsite, pushed as a ref descriptor.
        this.emitOutArg(out, arg, param);
      }
    }
  }

  private descriptorConstIndex(imp: ImportInfo): number {
    const existing = this.importDescriptorConst.get(imp.alias);
    if (existing !== undefined) return existing;
    const idx = this.constants.add(VT.String, imp.descriptor);
    this.importDescriptorConst.set(imp.alias, idx);
    return idx;
  }

  private emitUserCallArgs(
    out: Instruction[],
    call: CallExpr,
    fn: FunctionInfo,
  ): void {
    const expected = fn.decl.params.length;
    if (call.args.length !== expected) {
      throw new CodegenError(
        `'${fn.name}' expects ${expected} arguments, got ${call.args.length}`,
        call.line,
        call.column,
      );
    }
    for (let i = 0; i < call.args.length; i++) {
      const param = fn.decl.params[i];
      const arg = call.args[i];
      switch (param.direction) {
        case 'in':
          this.emitExpression(out, arg);
          break;
        case 'out': {
          // Allocate a temp and push a STOREREF marker for the callee.
          // The temp's value is discarded after the call — but the
          // backing local must exist somewhere; INPACOMP allocates an
          // anonymous local upstream. For stage 2a, only allow passing
          // a named local as the out arg.
          this.emitOutArg(out, arg, param);
          break;
        }
        case 'inout':
          this.emitOutArg(out, arg, param);
          break;
        case 'returns':
          throw new CodegenError(
            "'returns' params not implemented",
            param.line,
            param.column,
          );
      }
    }
  }

  private emitOutArg(
    out: Instruction[],
    arg: Expression,
    param: ParameterDecl,
  ): void {
    if (arg.kind !== 'IdentExpr') {
      throw new CodegenError(
        `${param.direction}: argument must be a variable name`,
        arg.line,
        arg.column,
      );
    }
    const local = this.lookupLocal((arg as IdentExpr).name);
    const global = this.symbols.globalsByName.get((arg as IdentExpr).name);
    if (!local && !global) {
      throw new CodegenError(
        `unknown variable '${(arg as IdentExpr).name}'`,
        arg.line,
        arg.column,
      );
    }
    const scope = local ? Scope.Local : Scope.Global;
    const slot = local ? local.slot : global!.slot;
    out.push(pushRefStore(scope, slot));
  }

  // ============ Helpers ============

  private resolveLValue(expr: IdentExpr): LocalInfo | GlobalInfo {
    const local = this.lookupLocal(expr.name);
    if (local) return local;
    const global = this.symbols.globalsByName.get(expr.name);
    if (global) return global;
    throw new CodegenError(
      `unknown identifier '${expr.name}'`,
      expr.line,
      expr.column,
    );
  }

  private lookupLocal(name: string): LocalInfo | undefined {
    return this.current?.localsByName.get(name);
  }

  private requireLocal(name: string, line: number, column: number): LocalInfo {
    const l = this.lookupLocal(name);
    if (!l) throw new SemanticError(`unknown local '${name}'`, line, column);
    return l;
  }

  /**
   * Replace the jump at `siteIndex` with one that targets `targetIndex`.
   * The VM treats the jump operand as an absolute instruction index
   * (within the current function), not a relative byte offset — see
   * `opJmp` / `opJmpNZ` in packages/interpreter.
   */
  private patchJump(out: Instruction[], siteIndex: number, targetIndex: number): void {
    const existing = out[siteIndex];
    if (existing.opcode !== Opcode.JMP && existing.opcode !== Opcode.JMPNZ) {
      throw new Error(`patch site is not a jump at ${siteIndex}`);
    }
    out[siteIndex] = instr(existing.opcode, existing.op1, targetIndex & 0xffff);
  }
}

function isLocal(x: LocalInfo | GlobalInfo): x is LocalInfo {
  return (x as LocalInfo).direction !== undefined;
}

function isRefParam(l: LocalInfo): boolean {
  return l.direction === 'out' || l.direction === 'inout';
}

export function compile(symbols: SymbolTable): CodegenResult {
  return new Codegen(symbols).compile();
}
