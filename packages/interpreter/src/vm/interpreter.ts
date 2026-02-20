import {
  IpoFile,
  FunctionBlock,
  Instruction,
  StackEntry,
  ValueType,
  Opcode,
  AluOp,
  Scope,
  CallTarget,
  TypeMarker,
  Value,
} from '@inpax/core';
import { Stack } from './stack.js';
import { SystemFunctions, SystemFunctionHandler } from '../runtime/system-functions.js';

/**
 * VM State
 */
export interface VMState {
  ip: number; // Instruction pointer
  currentBlock: FunctionBlock | null;
  condition: number; // Last comparison result
  running: boolean;
}

/**
 * INPA Virtual Machine
 */
export class VM {
  private ipo: IpoFile;
  private stack: Stack;
  private globals: StackEntry[];
  private state: VMState;
  private systemFunctions: SystemFunctions;

  constructor(ipo: IpoFile) {
    this.ipo = ipo;
    this.stack = new Stack();
    this.globals = this.initGlobals();
    this.state = {
      ip: 0,
      currentBlock: null,
      condition: 0,
      running: false,
    };
    this.systemFunctions = new SystemFunctions(this);
  }

  /**
   * Initialize global variables from IPO
   */
  private initGlobals(): StackEntry[] {
    return this.ipo.globals.types.map((type) => ({
      type,
      flags: 1,
      value: this.getDefaultValue(type),
    }));
  }

  /**
   * Get default value for type
   */
  private getDefaultValue(type: ValueType): Value {
    switch (type) {
      case ValueType.Bool:
        return false;
      case ValueType.Byte:
      case ValueType.Int:
      case ValueType.Long:
      case ValueType.Handle1:
      case ValueType.Handle2:
      case ValueType.Handle3:
        return 0;
      case ValueType.Real:
        return 0.0;
      case ValueType.String:
        return '';
      default:
        return null;
    }
  }

  /**
   * Run interpreter starting from inpainit
   */
  run(): void {
    // Start with __inpa_startup__ (function ID 0x00)
    const initFunc = this.ipo.functions.get(0x00);
    if (!initFunc) {
      throw new Error('__inpa_startup__ function not found');
    }

    this.callFunction(initFunc);
    this.execute();
  }

  /**
   * Call a user function
   */
  callFunction(func: FunctionBlock): void {
    console.log(`Calling function: ${func.header.name} (ID: ${func.header.blockId})`);
    this.state.currentBlock = func;
    this.state.ip = 0;
  }

  /**
   * Main execution loop
   */
  private execute(): void {
    this.state.running = true;

    while (this.state.running && this.state.currentBlock) {
      const block = this.state.currentBlock;

      if (this.state.ip >= block.instructions.length) {
        // End of function - implicit return
        this.doReturn();
        continue;
      }

      const instr = block.instructions[this.state.ip];
      this.executeInstruction(instr);
    }
  }

  /**
   * Execute single instruction
   */
  private executeInstruction(instr: Instruction): void {
    const { opcode, operand1, operand2 } = instr;
    console.log(`IP: ${this.state.ip} Opcode: 0x${opcode.toString(16)} Operands: ${operand1}, ${operand2}`);
    switch (opcode) {
      case Opcode.LOAD:
        this.opLoad(operand1, operand2);
        break;

      case Opcode.PUSHREF:
        this.opPushRef(operand1, operand2);
        break;

      case Opcode.LOADINOUTREF:
        this.opLoadInOutRef(operand1, operand2);
        break;

      case Opcode.NOP:
        // No operation
        break;

      case Opcode.MOVE:
        this.opMove();
        break;

      case Opcode.PUSHR:
        this.opPushR(operand1, operand2);
        break;

      case Opcode.PUSHREFSTORE:
        this.opPushRefStore(operand1, operand2);
        break;

      case Opcode.ALLOC:
        this.opAlloc(operand1);  // operand1 = type marker (0x50-0x57)
        break;

      case Opcode.ALU:
        this.opAlu(operand1 as AluOp);
        break;

      case Opcode.JMP:
        this.opJmp(operand2);
        return; // Don't increment IP

      case Opcode.JMPNZ:
        if (this.opJmpNZ(operand2)) return;
        break;

      case Opcode.CALL:
        this.opCall(operand1 as CallTarget, operand2);
        return; // IP handled by call

      case Opcode.CALLE:
        this.opCallE(operand2);
        break;

      case Opcode.RET:
        this.doReturn();
        return; // IP handled by return

      case Opcode.FRAME:
        this.opFrame();
        break;

      case Opcode.LOGTABLE:
        this.opLogTable(operand2);
        break;

      case Opcode.PUSHIMM:
        this.opPushImm(operand2);
        break;

      default:
        throw new Error(`Unknown opcode: 0x${opcode.toString(16)}`);
    }

    this.state.ip++;
  }

  // ============ Opcode implementations ============

  private opLoad(scope: Scope, index: number): void {
    const entry = this.resolveVariable(scope, index);
    // Push copy
    this.stack.push({ ...entry, flags: 1 });
  }

  private opPushRef(scope: Scope, index: number): void {
    let actualIndex = index;
    if (scope === Scope.Local) {
      actualIndex = this.stack.getFrameOffset() + index;
    }
    this.stack.push(Stack.createRef(scope, actualIndex));
  }

  private opLoadInOutRef(scope: Scope, index: number): void {
    // Load bidirectional reference
    this.opPushRef(scope, index);
  }

  private opMove(): void {
    const value = this.stack.pop();
    const target = this.stack.pop();

    if (target.refInfo) {
      // Store to reference target
      const dest = this.resolveVariable(target.refInfo.scope, target.refInfo.index);
      dest.value = value.value;
      dest.type = value.type;
    }
  }

  private opPushR(scope: Scope, index: number): void {
    // Push store target reference
    this.opPushRef(scope, index);
  }

  private opPushRefStore(scope: Scope, index: number): void {
    // Push reference for out parameter
    this.opPushRef(scope, index);
  }

  private opAlloc(typeMarker: number): void {
    // Allocate local variable of specified type with default value
    // Type markers: 0x50=bool, 0x51=int, 0x52=byte, 0x53=long, 0x54=real, 0x55=string, 0x56/0x57=handle
    let type: ValueType;
    let value: Value;

    switch (typeMarker) {
      case 0x50: // bool
        type = ValueType.Bool;
        value = false;
        break;
      case 0x51: // int (s16)
        type = ValueType.Int;
        value = 0;
        break;
      case 0x52: // byte (u8)
        type = ValueType.Byte;
        value = 0;
        break;
      case 0x53: // long (s32)
        type = ValueType.Long;
        value = 0;
        break;
      case 0x54: // real (f64)
        type = ValueType.Real;
        value = 0.0;
        break;
      case 0x55: // string
        type = ValueType.String;
        value = '';
        break;
      case 0x56: // handle1
        type = ValueType.Handle1;
        value = null;
        break;
      case 0x57: // handle2/array
        type = ValueType.Handle2;
        value = null;
        break;
      default:
        type = ValueType.Void;
        value = null;
    }

    this.stack.push({
      type,
      flags: 1,
      value,
    });
  }

  private opJmp(offset: number): void {
    this.state.ip = offset;
  }

  private opJmpNZ(offset: number): boolean {
    const entry = this.stack.pop();
    if (entry.value) {
      this.state.ip = offset;
      return true;
    }
    return false;
  }

  private opAlu(op: AluOp): void {
    if (op === AluOp.NEG || op === AluOp.NOT) {
      // Unary operations
      const entry = this.stack.peek();
      if (op === AluOp.NEG) {
        entry.value = -(entry.value as number);
      } else {
        entry.value = !entry.value;
      }
      return;
    }

    // Binary operations
    const [lhs, rhs] = this.stack.getTwoOperands();
    let result: Value;

    switch (op) {
      case AluOp.ADD:
        if (lhs.type === ValueType.String) {
          result = String(lhs.value) + String(rhs.value);
        } else {
          result = (lhs.value as number) + (rhs.value as number);
        }
        break;
      case AluOp.SUB:
        result = (lhs.value as number) - (rhs.value as number);
        break;
      case AluOp.MUL:
        result = (lhs.value as number) * (rhs.value as number);
        break;
      case AluOp.DIV:
        if (rhs.value === 0) {
          throw new Error('Division by zero');
        }
        result = (lhs.value as number) / (rhs.value as number);
        break;
      case AluOp.MOD:
        result = (lhs.value as number) % (rhs.value as number);
        break;
      case AluOp.LT:
        result = (lhs.value as number) < (rhs.value as number);
        this.state.condition = result ? 1 : 0;
        break;
      case AluOp.LE:
        result = (lhs.value as number) <= (rhs.value as number);
        this.state.condition = result ? 1 : 0;
        break;
      case AluOp.GT:
        result = (lhs.value as number) > (rhs.value as number);
        this.state.condition = result ? 1 : 0;
        break;
      case AluOp.GE:
        result = (lhs.value as number) >= (rhs.value as number);
        this.state.condition = result ? 1 : 0;
        break;
      case AluOp.EQ:
        result = lhs.value === rhs.value;
        this.state.condition = result ? 1 : 0;
        break;
      case AluOp.NE:
        result = lhs.value !== rhs.value;
        this.state.condition = result ? 1 : 0;
        break;
      case AluOp.AND:
        result = Boolean(lhs.value) && Boolean(rhs.value);
        break;
      case AluOp.OR:
        result = Boolean(lhs.value) || Boolean(rhs.value);
        break;
      case AluOp.BAND:
        result = (lhs.value as number) & (rhs.value as number);
        break;
      case AluOp.BOR:
        result = (lhs.value as number) | (rhs.value as number);
        break;
      case AluOp.BXOR:
        result = (lhs.value as number) ^ (rhs.value as number);
        break;
      default:
        throw new Error(`Unknown ALU op: 0x${(op as number).toString(16)}`);
    }

    lhs.value = result;
    this.stack.popN(1); // Pop rhs, keep lhs with result
  }

  private opCall(target: CallTarget, funcId: number): void {
    this.state.ip++;

    if (target === CallTarget.UserFunction) {
      // User function call
      const func = this.ipo.functions.get(funcId);
      if (!func) {
        throw new Error(`Function not found: ${funcId}`);
      }

      // Save return address
      this.stack.pushReturnAddress(
        this.state.currentBlock!.header.blockId,
        this.state.ip
      );

      // Jump to function
      this.callFunction(func);
    } else {
      // System function call
      this.systemFunctions.call(funcId);
      this.stack.popFrame();
    }
  }

  private opCallE(index: number): void {
    // External DLL call - not implemented
    throw new Error(`CALLE (external DLL call) not implemented: ${index}`);
  }

  private doReturn(): void {
    const ret = this.stack.popReturnAddress();

    if (ret.blockId === -1) {
      // Return from top-level - stop execution
      this.state.running = false;
      return;
    }

    // Restore caller context
    const callerFunc = this.ipo.functions.get(ret.blockId);
    if (!callerFunc) {
      throw new Error(`Return to unknown function: ${ret.blockId}`);
    }

    this.state.currentBlock = callerFunc;
    this.state.ip = ret.ip;
    this.stack.popFrame();
  }

  private opFrame(): void {
    this.stack.pushFrame();
  }

  private opLogTable(index: number): void {
    // Logic table lookup - not fully implemented
    console.warn(`LOGTABLE lookup at index ${index} - returning 0`);
    this.stack.push({
      type: ValueType.Long,
      flags: 1,
      value: 0,
    });
  }

  private opPushImm(index: number): void {
    const constant = this.ipo.constants.values[index];
    if (!constant) {
      throw new Error(`Constant not found: ${index}`);
    }
    this.stack.push({ ...constant, flags: 1 });
  }

  // ============ Helper methods ============

  private resolveVariable(scope: Scope, index: number): StackEntry {
    switch (scope) {
      case Scope.Global:
        return this.globals[index];
      case Scope.Const:
        return this.ipo.constants.values[index];
      case Scope.Local:
        return this.stack.getLocal(index);
      default:
        // UI handles (0x40+)
        throw new Error(`UI handle scope not implemented: 0x${scope.toString(16)}`);
    }
  }

  private markerToType(marker: number): ValueType {
    switch (marker) {
      case TypeMarker.Bool:
        return ValueType.Bool;
      case TypeMarker.Int:
        return ValueType.Int;
      case TypeMarker.Byte:
        return ValueType.Byte;
      case TypeMarker.Long:
        return ValueType.Long;
      case TypeMarker.Real:
        return ValueType.Real;
      case TypeMarker.String:
        return ValueType.String;
      default:
        return ValueType.Void;
    }
  }

  private convertValue(value: Value, toType: ValueType): Value {
    switch (toType) {
      case ValueType.Bool:
        return Boolean(value);
      case ValueType.Byte:
      case ValueType.Int:
      case ValueType.Long:
        return Math.floor(Number(value));
      case ValueType.Real:
        return Number(value);
      case ValueType.String:
        return String(value);
      default:
        return value;
    }
  }

  // ============ Public API for system functions ============

  getStack(): Stack {
    return this.stack;
  }

  getGlobals(): StackEntry[] {
    return this.globals;
  }

  getConstants(): StackEntry[] {
    return this.ipo.constants.values;
  }

  getState(): VMState {
    return this.state;
  }

  stop(): void {
    this.state.running = false;
  }
}
