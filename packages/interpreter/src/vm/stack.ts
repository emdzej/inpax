import { StackEntry, CallFrame, ReturnAddress, ValueType, Value, FunctionBlock } from '@emdzej/inpax-core';

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
   * Push call frame marker. Does NOT change frameOffset — the caller is
   * still executing and needs its own locals between FRAME and CALL.
   * frameOffset is switched to markerPosition only when a user CALL
   * actually transfers control into the callee (see VM.opCall).
   */
  pushFrame(): void {
    this.callStack.push({
      returnAddress: { block: null, blockId: -1, ip: -1 },
      savedFrameOffset: this.frameOffset,
      markerPosition: this.values.length,
    });
  }

  /**
   * Pop call frame and restore caller's frame state. Truncates the value
   * stack back to where it was at FRAME time (drops anything the callee
   * left behind that wasn't consumed via out-params).
   */
  popFrame(): void {
    const frame = this.callStack.pop();
    if (!frame) {
        return;
      //throw new Error('Call stack underflow');
    }

    this.values.length = frame.markerPosition;
    this.frameOffset = frame.savedFrameOffset;
  }

  /**
   * Get the marker position of the top frame. Used by user CALL to set
   * the callee's frameOffset (so callee local[0] points to the first
   * argument pushed after FRAME).
   */
  getTopFrameMarker(): number {
    if (this.callStack.length === 0) {
      return this.frameOffset;
    }
    return this.callStack[this.callStack.length - 1].markerPosition;
  }

  /**
   * Set frameOffset directly (used when transferring into a callee).
   */
  setFrameOffset(offset: number): void {
    this.frameOffset = offset;
  }

  /**
   * Push return address — pins the FunctionBlock reference (not just an
   * integer ID) so RET resumes in the exact caller block. Storing only
   * `blockId` mis-routes returns from LINE/CONTROL/ITEM blocks (those
   * inhabit a per-screen ID space that overlaps with top-level
   * function IDs).
   */
  pushReturnAddress(block: FunctionBlock, ip: number): void {
    if (this.callStack.length === 0) {
      throw new Error('No call frame for return address');
    }
    this.callStack[this.callStack.length - 1].returnAddress = {
      block,
      blockId: block.header.blockId,
      ip,
    };
  }

  /**
   * Pop return address. Returns the halt sentinel `{block: null}` when
   * the stack is empty — `doReturn` checks for null and stops the VM
   * loop, the same way an integer sentinel used to.
   */
  popReturnAddress(): ReturnAddress {
    if (this.callStack.length === 0) {
         return { block: null, blockId: -1, ip: -1 };
      //throw new Error('Call stack underflow');
    }
    return this.callStack[this.callStack.length - 1].returnAddress;
  }

  /**
   * Get two operands for binary operations
   */
  getTwoOperands(): [StackEntry, StackEntry] {
    // const rhs = this.get(this.topIndex());
    // const lhs = this.get(this.topIndex() - 1);
    const rhs = this.pop();
    const lhs = this.pop();
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
