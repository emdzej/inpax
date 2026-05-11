import { StackEntry, Scope, StackEntryFlags, ValueType } from '@emdzej/inpax-core';
import { Stack } from './stack.js';

/**
 * Execution context for VM - manages stack and variable scopes
 */
export class ExecutionContext {
  readonly stack: Stack;
  readonly globalVars: StackEntry[];
  readonly constPool: StackEntry[];

  constructor(globalVars: StackEntry[], constPool: StackEntry[]) {
    this.stack = new Stack();
    this.globalVars = globalVars;
    this.constPool = constPool;
  }

  // Live view to the stack's frame offset — used to be a cached field
  // but the stack is the source of truth now that FRAME and user CALL
  // update it independently.
  get frameOffset(): number {
    return this.stack.getFrameOffset();
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
      case Scope.Screen:
      case Scope.Menu:
      case Scope.StateMachine:
        // UI handles are not stored variables — they encode (scope, index)
        // as a synthetic handle so PUSHREF/LOAD can push them onto the
        // stack and setscreen()/setmenu()/setstatemachine() can resolve
        // back to the IPO block by index. value mirrors the index so
        // popInt() also works for system functions that read the raw int.
        return {
          type: ValueType.Handle1,
          flags: StackEntryFlags.ByValue,
          value: index,
          refInfo: { scope, index },
        };
      default:
        throw new Error(`Unsupported scope: 0x${(scope as number).toString(16)}`);
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
      case Scope.Screen:
      case Scope.Menu:
      case Scope.StateMachine:
        throw new Error(`Cannot assign to UI handle (scope 0x${scope.toString(16)})`);
      default:
        throw new Error(`Unsupported scope: 0x${(scope as number).toString(16)}`);
    }
  }

  createRef(scope: Scope, index: number): StackEntry {
    const entry = this.getVariable(scope, index);
    // Preserve the synthetic handle value for UI scopes so consumers that
    // read it as an int (popInt) get the index back; for storage scopes
    // the value comes from the actual variable cell and the ref is just
    // a write target, so value is null.
    const isUiHandle =
      scope === Scope.Screen || scope === Scope.Menu || scope === Scope.StateMachine;
    return {
      type: entry.type,
      flags: StackEntryFlags.ByReference,
      value: isUiHandle ? entry.value : null,
      refInfo: { scope, index },
    };
  }

  // ============ Frame Management ============

  pushFrame(): void {
    this.stack.pushFrame();
  }

  popFrame(): void {
    this.stack.popFrame();
  }
}
