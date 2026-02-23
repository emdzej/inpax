import { StackEntry, Scope } from '@emdzej/inpax-core';
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

  pushFrame(): void {
    this.stack.pushFrame();
    this.frameOffset = this.stack.getFrameOffset();
  }

  popFrame(): void {
    this.stack.popFrame();
    this.frameOffset = this.stack.getFrameOffset();
  }
}
