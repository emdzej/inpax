import { StackEntry, Scope, StackEntryFlags, ValueType } from '@emdzej/inpax-core';
import { Stack } from './stack.js';

/**
 * Execution context for VM - manages stack and variable scopes
 */
export class ExecutionContext {
  readonly stack: Stack;
  readonly globalVars: StackEntry[];
  readonly constPool: StackEntry[];
  frameOffset: number;

  constructor(globalVars: StackEntry[], constPool: StackEntry[]) {
    this.stack = new Stack();
    this.globalVars = globalVars;
    this.constPool = constPool;
    this.frameOffset = this.stack.getFrameOffset();
  }

  // ============ Stack Helpers ============

  popString(): string {
    return String(this.stack.pop().value);
  }

  popInt(): number {
    return Math.floor(Number(this.stack.pop().value));
  }

  popReal(): number {
    return Number(this.stack.pop().value);
  }

  popBool(): boolean {
    return Boolean(this.stack.pop().value);
  }

  popRef(): StackEntry {
    return this.stack.pop();
  }

  pushString(value: string): void {
    this.stack.push(Stack.createEntry(ValueType.String, value));
  }

  pushInt(value: number): void {
    this.stack.push(Stack.createEntry(ValueType.Int, value));
  }

  pushReal(value: number): void {
    this.stack.push(Stack.createEntry(ValueType.Real, value));
  }

  pushBool(value: boolean): void {
    this.stack.push(Stack.createEntry(ValueType.Bool, value));
  }

  /**
   * Set out parameter by reference
   */
  setOutParam(ref: StackEntry, value: StackEntry): void {
    if (!ref.refInfo) throw new Error('Expected reference for out parameter');
    const { scope, index } = ref.refInfo;
    this.setVariable(scope as Scope, index, value);
  }

  // ============ Variable Access ============

  getVariable(scope: Scope, index: number): StackEntry {
    switch (scope) {
      case Scope.Global:
        return this.globalVars[index];
      case Scope.Const:
        return this.constPool[index];
      case Scope.Local:
        return this.stack.get(this.frameOffset + index);
      default:
        throw new Error(`Unsupported scope: 0x${scope.toString(16)}`);
    }
  }

  setVariable(scope: Scope, index: number, value: StackEntry): void {
    switch (scope) {
      case Scope.Global:
        this.globalVars[index] = { ...value };
        break;
      case Scope.Local:
        this.stack.set(this.frameOffset + index, { ...value });
        break;
      case Scope.Const:
        throw new Error('Cannot assign to constant');
      default:
        throw new Error(`Unsupported scope: 0x${scope.toString(16)}`);
    }
  }

  createRef(scope: Scope, index: number): StackEntry {
    const entry = this.getVariable(scope, index);
    return {
      type: entry.type,
      flags: StackEntryFlags.ByReference,
      value: null,
      refInfo: { scope, index },
    };
  }

  // ============ Frame Management ============

  pushFrame(): void {
    this.stack.pushFrame();
    this.frameOffset = this.stack.getFrameOffset();
  }

  popFrame(): void {
    this.stack.popFrame();
    this.frameOffset = this.stack.getFrameOffset();
  }
}
