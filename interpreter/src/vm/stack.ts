import { StackEntry, CallFrame, ReturnAddress, ValueType, Value } from '@inpax/core';

/**
 * VM Stack - manages value stack and call frames
 */
export class Stack {
  private values: StackEntry[] = [];
  private callStack: CallFrame[] = [];
  private frameOffset: number = 0;

  /**
   * Push value onto stack
   */
  push(entry: StackEntry): void {
    this.values.push(entry);
  }

  /**
   * Pop value from stack
   */
  pop(): StackEntry {
    const entry = this.values.pop();
    if (!entry) {
      throw new Error('Stack underflow');
    }
    return entry;
  }

  /**
   * Peek at top of stack without removing
   */
  peek(): StackEntry {
    if (this.values.length === 0) {
      throw new Error('Stack is empty');
    }
    return this.values[this.values.length - 1];
  }

  /**
   * Get stack entry by absolute index
   */
  get(index: number): StackEntry {
    if (index < 0 || index >= this.values.length) {
      throw new Error(`Stack index out of bounds: ${index}`);
    }
    return this.values[index];
  }

  /**
   * Set stack entry by absolute index
   */
  set(index: number, entry: StackEntry): void {
    if (index < 0 || index >= this.values.length) {
      throw new Error(`Stack index out of bounds: ${index}`);
    }
    this.values[index] = entry;
  }

  /**
   * Get top index (count - 1)
   */
  topIndex(): number {
    return this.values.length - 1;
  }

  /**
   * Get current frame offset
   */
  getFrameOffset(): number {
    return this.frameOffset;
  }

  /**
   * Get local variable (relative to frame)
   */
  getLocal(index: number): StackEntry {
    return this.get(this.frameOffset + index);
  }

  /**
   * Set local variable (relative to frame)
   */
  setLocal(index: number, entry: StackEntry): void {
    this.set(this.frameOffset + index, entry);
  }

  /**
   * Push call frame marker
   */
  pushFrame(): void {
    this.callStack.push({
      returnAddress: { blockId: -1, ip: -1 },
      frameOffset: this.frameOffset,
    });
    this.frameOffset = this.values.length;
  }

  /**
   * Pop call frame and restore previous
   */
  popFrame(): void {
    const frame = this.callStack.pop();
    if (!frame) {
      throw new Error('Call stack underflow');
    }

    // Truncate value stack to frame boundary
    this.values.length = this.frameOffset;
    this.frameOffset = frame.frameOffset;
  }

  /**
   * Push return address
   */
  pushReturnAddress(blockId: number, ip: number): void {
    if (this.callStack.length === 0) {
      throw new Error('No call frame for return address');
    }
    this.callStack[this.callStack.length - 1].returnAddress = { blockId, ip };
  }

  /**
   * Pop return address
   */
  popReturnAddress(): ReturnAddress {
    if (this.callStack.length === 0) {
      throw new Error('Call stack underflow');
    }
    return this.callStack[this.callStack.length - 1].returnAddress;
  }

  /**
   * Get two operands for binary operations
   */
  getTwoOperands(): [StackEntry, StackEntry] {
    const rhs = this.get(this.topIndex());
    const lhs = this.get(this.topIndex() - 1);
    return [lhs, rhs];
  }

  /**
   * Pop N elements from stack
   */
  popN(count: number): void {
    for (let i = 0; i < count; i++) {
      this.pop();
    }
  }

  /**
   * Create a new value entry
   */
  static createEntry(type: ValueType, value: Value): StackEntry {
    return { type, flags: 1, value };
  }

  /**
   * Create a reference entry
   */
  static createRef(scope: number, index: number): StackEntry {
    return {
      type: ValueType.Void,
      flags: 2,
      value: null,
      refInfo: { scope, index },
    };
  }

  /**
   * Get stack size
   */
  get size(): number {
    return this.values.length;
  }

  /**
   * Clear stack
   */
  clear(): void {
    this.values = [];
    this.callStack = [];
    this.frameOffset = 0;
  }
}
