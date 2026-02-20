import {
  Program, FunctionDecl, GlobalDecl, LocalDecl,
  Statement, Expression, ValueType, BlockStmt, ExpressionStmt,
  IfStmt, WhileStmt, ForStmt, ReturnStmt,
  LiteralExpr, IdentifierExpr, BinaryExpr, UnaryExpr, CallExpr, IndexExpr, AssignExpr,
} from '../ast/index.js';

const SEPARATOR = 0x0a;

/** Block types */
enum BlockType {
  Screen = 0x01,
  Menu = 0x02,
  StateMachine = 0x03,
  LogicTable = 0x04,
  Function = 0x05,
  GlobalData = 0x11,
  ConstantData = 0x12,
  ScreenFunc = 0x21,
  LineFunc = 0x22,
  ControlFunc = 0x23,
  MenuItemFunc = 0x24,
  StateFunc = 0x25,
}

/** Value type IDs */
enum TypeId {
  Void = 0,
  Bool = 1,
  Byte = 2,
  Int = 3,
  Long = 4,
  Real = 5,
  String = 6,
}

/** Opcodes - must match docs/opcode-reference.md */
enum Opcode {
  LOAD = 0x01,
  PUSHREF = 0x02,
  NOP = 0x04,
  MOVE = 0x05,
  ALLOC = 0x08,
  ALU = 0x09,
  JMP = 0x0a,
  JMPNZ = 0x0b,
  CALL = 0x0c,
  RET = 0x0e,
  FRAME = 0x0f,
  LOGTABLE = 0x10,
  PUSHIMM = 0x11,
}

/** ALU operations */
enum AluOp {
  ADD = 0x60, SUB = 0x61, MUL = 0x62, DIV = 0x63,
  LT = 0x64, LE = 0x65, GT = 0x66, GE = 0x67,
  EQ = 0x68, NE = 0x69, AND = 0x6a, OR = 0x6b,
  MOD = 0x6c, NEG = 0x6d, NOT = 0x6e,
}

/** Scope IDs */
enum Scope {
  Global = 0x00,
  Const = 0x01,
  Local = 0x02,
}

/**
 * IPO Code Generator
 */
export class CodeGenerator {
  private buffer: number[] = [];
  private globals: Map<string, { index: number; type: TypeId }> = new Map();
  private constants: { type: TypeId; value: any }[] = [];
  private constantMap: Map<string, number> = new Map();
  private locals: Map<string, { index: number; type: TypeId }> = new Map();
  private functionIds: Map<string, number> = new Map();
  private nextFuncId: number = 4; // 0-3 reserved

  /**
   * Generate IPO from AST
   */
  generate(program: Program): Buffer {
    this.buffer = [];
    
    // Collect all symbols
    this.collectSymbols(program);
    
    // Write header
    this.writeHeader();
    
    // Write __inpa_startup__ (function 0)
    this.writeFunction(0, '__inpa_startup__', []);
    
    // Write __inpa_shutdown__ (function 1)
    this.writeFunction(1, '__inpa_shutdown__', []);
    
    // Write inpainit (function 2)
    const inpainit = program.functions.find(f => f.name.toLowerCase() === 'inpainit');
    if (inpainit) {
      this.writeUserFunction(2, inpainit);
    } else {
      this.writeFunction(2, 'inpainit', []);
    }
    
    // Write inpaexit (function 3)
    const inpaexit = program.functions.find(f => f.name.toLowerCase() === 'inpaexit');
    if (inpaexit) {
      this.writeUserFunction(3, inpaexit);
    } else {
      this.writeFunction(3, 'inpaexit', []);
    }
    
    // Write global data
    this.writeGlobalData();
    
    // Write constant data
    this.writeConstantData();
    
    // Write user functions
    for (const func of program.functions) {
      const name = func.name.toLowerCase();
      if (name !== 'inpainit' && name !== 'inpaexit') {
        const id = this.functionIds.get(func.name) || this.nextFuncId++;
        this.writeUserFunction(id, func);
      }
    }
    
    // Write screens
    for (const screen of program.screens) {
      this.writeScreen(screen);
    }
    
    // Write menus
    for (const menu of program.menus) {
      this.writeMenu(menu);
    }

    return Buffer.from(this.buffer);
  }

  /**
   * Collect symbols from program
   */
  private collectSymbols(program: Program): void {
    // Globals
    let globalIndex = 0;
    for (const v of program.globals) {
      this.globals.set(v.name, { index: globalIndex++, type: this.typeToId(v.type) });
    }
    
    // Functions
    for (const func of program.functions) {
      const name = func.name.toLowerCase();
      if (name === 'inpainit') {
        this.functionIds.set(func.name, 2);
      } else if (name === 'inpaexit') {
        this.functionIds.set(func.name, 3);
      } else {
        this.functionIds.set(func.name, this.nextFuncId++);
      }
    }
  }

  /**
   * Write file header
   */
  private writeHeader(): void {
    this.buffer.push(0x05); // version_hi
    this.buffer.push(0x00); // version_lo
    this.writeString('Compiled by inpax-compile');
    this.buffer.push(SEPARATOR);
  }

  /**
   * Write block header
   */
  private writeBlockHeader(
    type: BlockType,
    name: string,
    blockId: number,
    flags: number,
    arg1: string,
    arg2: string,
    marker: number,
    size: number
  ): void {
    this.buffer.push(type);
    this.writeString(name);
    this.buffer.push(SEPARATOR);
    this.writeU16(blockId);
    this.writeU16(flags);
    this.writeString(arg1);
    this.buffer.push(SEPARATOR);
    this.writeString(arg2);
    this.buffer.push(SEPARATOR);
    this.buffer.push(marker);
    this.writeU16(size);
  }

  /**
   * Write empty function
   */
  private writeFunction(id: number, name: string, instructions: number[]): void {
    const instrs = instructions.length > 0 ? instructions : [this.makeInstr(Opcode.RET, 0, 0)];
    this.writeBlockHeader(BlockType.Function, name, id, 0, '', '', 0, instrs.length);
    for (const instr of instrs) {
      this.writeU32(instr);
    }
  }

  /**
   * Write user function
   */
  private writeUserFunction(id: number, func: FunctionDecl): void {
    // Setup locals
    this.locals.clear();
    let localIndex = 0;
    for (const param of func.params) {
      this.locals.set(param.name, { index: localIndex++, type: this.typeToId(param.type) });
    }
    for (const local of func.locals) {
      this.locals.set(local.name, { index: localIndex++, type: this.typeToId(local.type) });
    }

    // Compile body
    const instructions = this.compileStatements(func.body);
    instructions.push(this.makeInstr(Opcode.RET, 0, 0));

    this.writeBlockHeader(BlockType.Function, func.name, id, 0, '', '', 0, instructions.length);
    for (const instr of instructions) {
      this.writeU32(instr);
    }
  }

  /**
   * Write global data block
   */
  private writeGlobalData(): void {
    const types: number[] = [];
    for (const [_, info] of this.globals) {
      types.push(info.type);
    }
    
    this.writeBlockHeader(BlockType.GlobalData, 'Global Data', 0, 0, '', '', 0, types.length);
    for (const t of types) {
      this.buffer.push(t);
    }
  }

  /**
   * Write constant data block
   */
  private writeConstantData(): void {
    this.writeBlockHeader(BlockType.ConstantData, 'Constant Data', 0, 0, '', '', 0, this.constants.length);
    
    for (const c of this.constants) {
      this.buffer.push(c.type);
      switch (c.type) {
        case TypeId.Bool:
          this.buffer.push(c.value ? 1 : 0);
          break;
        case TypeId.Byte:
          this.buffer.push(c.value & 0xff);
          break;
        case TypeId.Int:
          this.writeS16(c.value);
          break;
        case TypeId.Long:
          this.writeS32(c.value);
          break;
        case TypeId.Real:
          this.writeF64(c.value);
          break;
        case TypeId.String:
          this.writeString(c.value);
          this.buffer.push(SEPARATOR);
          break;
      }
    }
  }

  /**
   * Write screen
   */
  private writeScreen(screen: any): void {
    this.writeBlockHeader(BlockType.Screen, screen.name, 0, 0, '', '', 0, 0);
  }

  /**
   * Write menu
   */
  private writeMenu(menu: any): void {
    this.writeBlockHeader(BlockType.Menu, menu.name, 0, 0, '', '', 0, 0);
  }

  // ============ Compilation ============

  private compileStatements(stmts: Statement[]): number[] {
    const instrs: number[] = [];
    for (const stmt of stmts) {
      instrs.push(...this.compileStatement(stmt));
    }
    return instrs;
  }

  private compileStatement(stmt: Statement): number[] {
    switch (stmt.kind) {
      case 'ExpressionStmt':
        return this.compileExprStmt(stmt as ExpressionStmt);
      case 'BlockStmt':
        return this.compileStatements((stmt as BlockStmt).statements);
      case 'IfStmt':
        return this.compileIf(stmt as IfStmt);
      case 'WhileStmt':
        return this.compileWhile(stmt as WhileStmt);
      case 'ForStmt':
        return this.compileFor(stmt as ForStmt);
      case 'ReturnStmt':
        return this.compileReturn(stmt as ReturnStmt);
      case 'LocalDecl':
        return []; // Locals are allocated at function start
      default:
        return [];
    }
  }

  private compileExprStmt(stmt: ExpressionStmt): number[] {
    const instrs = this.compileExpr(stmt.expression);
    // Pop result if not assignment
    if (stmt.expression.kind !== 'AssignExpr') {
      // instrs.push(this.makeInstr(Opcode.POP, 0, 1));
    }
    return instrs;
  }

  private compileIf(stmt: IfStmt): number[] {
    const instrs: number[] = [];
    
    // Condition
    instrs.push(...this.compileExpr(stmt.condition));
    
    // Compile then branch
    const thenInstrs = this.compileStatement(stmt.thenBranch);
    
    if (stmt.elseBranch) {
      const elseInstrs = this.compileStatement(stmt.elseBranch);
      
      // Jump if false over then + jump
      instrs.push(this.makeInstr(Opcode.JMPNZ, 0, instrs.length + thenInstrs.length + 2));
      instrs.push(...thenInstrs);
      // Jump over else
      instrs.push(this.makeInstr(Opcode.JMP, 0, instrs.length + elseInstrs.length + 1));
      instrs.push(...elseInstrs);
    } else {
      // Jump if false over then
      instrs.push(this.makeInstr(Opcode.JMPNZ, 0, instrs.length + thenInstrs.length + 1));
      instrs.push(...thenInstrs);
    }
    
    return instrs;
  }

  private compileWhile(stmt: WhileStmt): number[] {
    const instrs: number[] = [];
    
    const condStart = instrs.length;
    
    // Condition
    instrs.push(...this.compileExpr(stmt.condition));
    
    // Compile body
    const bodyInstrs = this.compileStatement(stmt.body);
    
    // Jump if false past body + back jump
    instrs.push(this.makeInstr(Opcode.JMPNZ, 0, instrs.length + bodyInstrs.length + 2));
    instrs.push(...bodyInstrs);
    // Jump back to condition
    instrs.push(this.makeInstr(Opcode.JMP, 0, condStart));
    
    return instrs;
  }

  private compileFor(stmt: ForStmt): number[] {
    const instrs: number[] = [];
    
    // Init
    if (stmt.init) {
      if ('kind' in stmt.init && stmt.init.kind === 'LocalDecl') {
        // Skip, handled by local allocation
      } else {
        instrs.push(...this.compileExpr(stmt.init as Expression));
      }
    }
    
    const condStart = instrs.length;
    
    // Condition
    if (stmt.condition) {
      instrs.push(...this.compileExpr(stmt.condition));
    } else {
      // Always true
      instrs.push(...this.compileLiteral({ kind: 'LiteralExpr', line: 0, column: 0, type: 'bool', value: true }));
    }
    
    // Compile body and update
    const bodyInstrs = this.compileStatement(stmt.body);
    const updateInstrs = stmt.update ? this.compileExpr(stmt.update) : [];
    
    // Jump if false past body + update + back jump
    instrs.push(this.makeInstr(Opcode.JMPNZ, 0, instrs.length + bodyInstrs.length + updateInstrs.length + 2));
    instrs.push(...bodyInstrs);
    instrs.push(...updateInstrs);
    // Jump back to condition
    instrs.push(this.makeInstr(Opcode.JMP, 0, condStart));
    
    return instrs;
  }

  private compileReturn(stmt: ReturnStmt): number[] {
    const instrs: number[] = [];
    if (stmt.value) {
      instrs.push(...this.compileExpr(stmt.value));
    }
    instrs.push(this.makeInstr(Opcode.RET, 0, 0));
    return instrs;
  }

  private compileExpr(expr: Expression): number[] {
    switch (expr.kind) {
      case 'LiteralExpr':
        return this.compileLiteral(expr as LiteralExpr);
      case 'IdentifierExpr':
        return this.compileIdentifier(expr as IdentifierExpr);
      case 'BinaryExpr':
        return this.compileBinary(expr as BinaryExpr);
      case 'UnaryExpr':
        return this.compileUnary(expr as UnaryExpr);
      case 'CallExpr':
        return this.compileCall(expr as CallExpr);
      case 'AssignExpr':
        return this.compileAssign(expr as AssignExpr);
      case 'IndexExpr':
        return this.compileIndex(expr as IndexExpr);
      default:
        return [];
    }
  }

  private compileLiteral(expr: LiteralExpr): number[] {
    // Add to constants and push
    const index = this.constants.length;
    const type = expr.type === 'bool' ? TypeId.Bool :
                 expr.type === 'int' ? TypeId.Int :
                 expr.type === 'real' ? TypeId.Real : TypeId.String;
    this.constants.push({ type, value: expr.value });
    return [this.makeInstr(Opcode.PUSHIMM, 0, index)];
  }

  private compileIdentifier(expr: IdentifierExpr): number[] {
    const { scope, index } = this.resolveVariable(expr.name);
    return [this.makeInstr(Opcode.LOAD, scope, index)];
  }

  private compileBinary(expr: BinaryExpr): number[] {
    const instrs: number[] = [];
    instrs.push(...this.compileExpr(expr.left));
    instrs.push(...this.compileExpr(expr.right));
    
    const op = this.getAluOp(expr.operator);
    instrs.push(this.makeInstr(Opcode.ALU, op, 0));
    
    return instrs;
  }

  private compileUnary(expr: UnaryExpr): number[] {
    const instrs: number[] = [];
    instrs.push(...this.compileExpr(expr.operand));
    
    if (expr.operator === '-') {
      instrs.push(this.makeInstr(Opcode.ALU, AluOp.NEG, 0));
    } else if (expr.operator === '!' || expr.operator === 'not') {
      instrs.push(this.makeInstr(Opcode.ALU, AluOp.NOT, 0));
    }
    
    return instrs;
  }

  private compileCall(expr: CallExpr): number[] {
    const instrs: number[] = [];
    
    // Push frame
    instrs.push(this.makeInstr(Opcode.FRAME, 0, 0));
    
    // Push arguments
    for (const arg of expr.args) {
      instrs.push(...this.compileExpr(arg));
    }
    
    // Call
    const funcId = this.functionIds.get(expr.name);
    if (funcId !== undefined) {
      instrs.push(this.makeInstr(Opcode.CALL, 0x80, funcId)); // User function
    } else {
      // System function - lookup by name
      const sysId = this.getSystemFunctionId(expr.name);
      instrs.push(this.makeInstr(Opcode.CALL, 0x81, sysId));
    }
    
    // Pop arguments
    // TODO: Check if VM automatically cleans up after CALL
    // if (expr.args.length > 0) {
    //   instrs.push(this.makeInstr(Opcode.POP, 0, expr.args.length));
    // }
    
    return instrs;
  }

  private compileAssign(expr: AssignExpr): number[] {
    const instrs: number[] = [];
    
    // Push target reference
    if (expr.target.kind === 'IdentifierExpr') {
      const name = (expr.target as IdentifierExpr).name;
      const { scope, index } = this.resolveVariable(name);
      instrs.push(this.makeInstr(Opcode.PUSHREF, scope, index));
    }
    
    // Push value
    instrs.push(...this.compileExpr(expr.value));
    
    // Move
    instrs.push(this.makeInstr(Opcode.MOVE, 0, 0));
    
    return instrs;
  }

  private compileIndex(expr: IndexExpr): number[] {
    // TODO: Array indexing
    return [];
  }

  // ============ Helpers ============

  private resolveVariable(name: string): { scope: number; index: number } {
    const local = this.locals.get(name);
    if (local) return { scope: Scope.Local, index: local.index };
    
    const global = this.globals.get(name);
    if (global) return { scope: Scope.Global, index: global.index };
    
    const constIdx = this.constantMap.get(name);
    if (constIdx !== undefined) return { scope: Scope.Const, index: constIdx };
    
    throw new Error(`Unknown variable: ${name}`);
  }

  private typeToId(type: ValueType): TypeId {
    switch (type) {
      case 'bool': return TypeId.Bool;
      case 'byte': return TypeId.Byte;
      case 'int': return TypeId.Int;
      case 'long': return TypeId.Long;
      case 'real': return TypeId.Real;
      case 'string': return TypeId.String;
    }
  }

  private getAluOp(op: string): AluOp {
    switch (op) {
      case '+': return AluOp.ADD;
      case '-': return AluOp.SUB;
      case '*': return AluOp.MUL;
      case '/': return AluOp.DIV;
      case '%': return AluOp.MOD;
      case '<': return AluOp.LT;
      case '<=': return AluOp.LE;
      case '>': return AluOp.GT;
      case '>=': return AluOp.GE;
      case '==': return AluOp.EQ;
      case '!=': return AluOp.NE;
      case '&&': case 'and': return AluOp.AND;
      case '||': case 'or': return AluOp.OR;
      default: return AluOp.ADD;
    }
  }

  private getSystemFunctionId(name: string): number {
    const map: Record<string, number> = {
      'settitle': 0x03,
      'setscreen': 0x04,
      'setmenu': 0x01,
      'settimer': 0x09,
      'delay': 0x1b,
      'exit': 0x0c,
      'text': 0x14,
      'textout': 0x15,
      'messagebox': 0x10,
    };
    return map[name.toLowerCase()] ?? 0;
  }

  private makeInstr(opcode: number, op1: number, op2: number): number {
    return (opcode & 0xff) | ((op1 & 0xff) << 8) | ((op2 & 0xffff) << 16);
  }

  private writeString(s: string): void {
    for (let i = 0; i < s.length; i++) {
      this.buffer.push(s.charCodeAt(i));
    }
  }

  private writeU16(v: number): void {
    this.buffer.push(v & 0xff);
    this.buffer.push((v >> 8) & 0xff);
  }

  private writeS16(v: number): void {
    this.writeU16(v & 0xffff);
  }

  private writeU32(v: number): void {
    this.buffer.push(v & 0xff);
    this.buffer.push((v >> 8) & 0xff);
    this.buffer.push((v >> 16) & 0xff);
    this.buffer.push((v >> 24) & 0xff);
  }

  private writeS32(v: number): void {
    this.writeU32(v >>> 0);
  }

  private writeF64(v: number): void {
    const buf = Buffer.alloc(8);
    buf.writeDoubleLE(v);
    for (let i = 0; i < 8; i++) {
      this.buffer.push(buf[i]);
    }
  }
}

export function generate(program: Program): Buffer {
  return new CodeGenerator().generate(program);
}
