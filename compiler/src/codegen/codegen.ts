import {
  Program, FunctionDecl, VariableDecl, ConstantDecl,
  Statement, Expression, ValueType,
  AssignmentStmt, CallStmt, IfStmt, WhileStmt, ForStmt, ReturnStmt,
  LiteralExpr, IdentifierExpr, BinaryExpr, UnaryExpr, CallExpr,
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

/** Opcodes */
enum Opcode {
  LOAD = 0x01,
  PUSHREF = 0x02,
  CAST = 0x04,
  MOVE = 0x05,
  JMP = 0x08,
  JMPZ = 0x09,
  JMPNZ = 0x0a,
  ALU = 0x0b,
  CALL = 0x0c,
  RET = 0x0e,
  FRAME = 0x0f,
  POP = 0x10,
  PUSHCONST = 0x11,
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
  private constants: Map<string, number> = new Map();
  private constantValues: { type: TypeId; value: any }[] = [];
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
    
    // Write screens, menus, state machines
    for (const screen of program.screens) {
      this.writeScreen(screen);
    }
    
    for (const menu of program.menus) {
      this.writeMenu(menu);
    }
    
    for (const sm of program.stateMachines) {
      this.writeStateMachine(sm);
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
    
    // Constants
    let constIndex = 0;
    for (const c of program.constants) {
      const type = this.typeToId(c.type);
      const value = this.evaluateConstant(c.value);
      this.constants.set(c.name, constIndex);
      this.constantValues.push({ type, value });
      constIndex++;
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
    this.writeString('TEST-Infotext');
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
    this.writeBlockHeader(BlockType.ConstantData, 'Constant Data', 0, 0, '', '', 0, this.constantValues.length);
    
    for (const c of this.constantValues) {
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
    // TODO: write screen init func and lines
  }

  /**
   * Write menu
   */
  private writeMenu(menu: any): void {
    this.writeBlockHeader(BlockType.Menu, menu.name, 0, 0, menu.title, '', 0, 0);
    // TODO: write menu items
  }

  /**
   * Write state machine
   */
  private writeStateMachine(sm: any): void {
    this.writeBlockHeader(BlockType.StateMachine, sm.name, 0, 0, '', '', 0, 0);
    // TODO: write states
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
      case 'AssignmentStmt':
        return this.compileAssignment(stmt as AssignmentStmt);
      case 'CallStmt':
        return this.compileCallStmt(stmt as CallStmt);
      case 'IfStmt':
        return this.compileIf(stmt as IfStmt);
      case 'WhileStmt':
        return this.compileWhile(stmt as WhileStmt);
      case 'ForStmt':
        return this.compileFor(stmt as ForStmt);
      case 'ReturnStmt':
        return this.compileReturn(stmt as ReturnStmt);
      default:
        return [];
    }
  }

  private compileAssignment(stmt: AssignmentStmt): number[] {
    const instrs: number[] = [];
    
    // Push target reference
    if (stmt.target.kind === 'IdentifierExpr') {
      const name = (stmt.target as IdentifierExpr).name;
      const { scope, index } = this.resolveVariable(name);
      instrs.push(this.makeInstr(Opcode.PUSHREF, scope, index));
    }
    
    // Push value
    instrs.push(...this.compileExpr(stmt.value));
    
    // Move
    instrs.push(this.makeInstr(Opcode.MOVE, 0, 0));
    
    return instrs;
  }

  private compileCallStmt(stmt: CallStmt): number[] {
    const instrs: number[] = [];
    
    // Push frame
    instrs.push(this.makeInstr(Opcode.FRAME, 0, 0));
    
    // Push arguments
    for (const arg of stmt.args) {
      instrs.push(...this.compileExpr(arg));
    }
    
    // Call
    const funcId = this.functionIds.get(stmt.name);
    if (funcId !== undefined) {
      instrs.push(this.makeInstr(Opcode.CALL, 0x80, funcId)); // User function
    } else {
      // System function - lookup by name
      const sysId = this.getSystemFunctionId(stmt.name);
      instrs.push(this.makeInstr(Opcode.CALL, 0x81, sysId));
    }
    
    // Pop arguments
    if (stmt.args.length > 0) {
      instrs.push(this.makeInstr(Opcode.POP, 0, stmt.args.length));
    }
    
    return instrs;
  }

  private compileIf(stmt: IfStmt): number[] {
    const instrs: number[] = [];
    
    // Condition
    instrs.push(...this.compileExpr(stmt.condition));
    
    // Jump if false
    const jumpFalseIdx = instrs.length;
    instrs.push(0); // Placeholder
    
    // Then branch
    instrs.push(...this.compileStatements(stmt.thenBranch));
    
    if (stmt.elseBranch) {
      // Jump over else
      const jumpEndIdx = instrs.length;
      instrs.push(0); // Placeholder
      
      // Patch jump-false to here
      instrs[jumpFalseIdx] = this.makeInstr(Opcode.JMPZ, 0, instrs.length);
      
      // Else branch
      instrs.push(...this.compileStatements(stmt.elseBranch));
      
      // Patch jump-end
      instrs[jumpEndIdx] = this.makeInstr(Opcode.JMP, 0, instrs.length);
    } else {
      // Patch jump-false to here
      instrs[jumpFalseIdx] = this.makeInstr(Opcode.JMPZ, 0, instrs.length);
    }
    
    return instrs;
  }

  private compileWhile(stmt: WhileStmt): number[] {
    const instrs: number[] = [];
    
    const loopStart = instrs.length;
    
    // Condition
    instrs.push(...this.compileExpr(stmt.condition));
    
    // Jump if false
    const jumpFalseIdx = instrs.length;
    instrs.push(0); // Placeholder
    
    // Body
    instrs.push(...this.compileStatements(stmt.body));
    
    // Jump back to start
    instrs.push(this.makeInstr(Opcode.JMP, 0, loopStart));
    
    // Patch jump-false
    instrs[jumpFalseIdx] = this.makeInstr(Opcode.JMPZ, 0, instrs.length);
    
    return instrs;
  }

  private compileFor(stmt: ForStmt): number[] {
    // TODO: Implement for loop
    return [];
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
      default:
        return [];
    }
  }

  private compileLiteral(expr: LiteralExpr): number[] {
    // Add to constants and push
    const index = this.constantValues.length;
    const type = expr.type === 'bool' ? TypeId.Bool :
                 expr.type === 'int' ? TypeId.Int :
                 expr.type === 'real' ? TypeId.Real : TypeId.String;
    this.constantValues.push({ type, value: expr.value });
    return [this.makeInstr(Opcode.PUSHCONST, 0, index)];
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
    } else if (expr.operator === 'not') {
      instrs.push(this.makeInstr(Opcode.ALU, AluOp.NOT, 0));
    }
    
    return instrs;
  }

  private compileCall(expr: CallExpr): number[] {
    return this.compileCallStmt({
      kind: 'CallStmt',
      line: expr.line,
      column: expr.column,
      name: expr.name,
      args: expr.args,
    });
  }

  // ============ Helpers ============

  private resolveVariable(name: string): { scope: number; index: number } {
    const local = this.locals.get(name);
    if (local) return { scope: Scope.Local, index: local.index };
    
    const global = this.globals.get(name);
    if (global) return { scope: Scope.Global, index: global.index };
    
    const constIdx = this.constants.get(name);
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
      case '!=': case '<>': return AluOp.NE;
      case 'and': return AluOp.AND;
      case 'or': return AluOp.OR;
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
      // Add more as needed
    };
    return map[name.toLowerCase()] ?? 0;
  }

  private evaluateConstant(expr: Expression): any {
    if (expr.kind === 'LiteralExpr') {
      return (expr as LiteralExpr).value;
    }
    return 0;
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
