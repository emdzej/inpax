import { describe, it, expect } from 'vitest';
import { ExecutionContext } from '../vm/execution-context.js';
import { StackEntry, StackEntryFlags, Scope, ValueType } from '@emdzej/inpax-core';

const entry = (type: ValueType, value: StackEntry['value']): StackEntry => ({
  type,
  flags: StackEntryFlags.ByValue,
  value,
});

describe('ExecutionContext', () => {
  it('accesses variables by scope (global, const, local)', () => {
    const globals: StackEntry[] = [entry(ValueType.Int, 10)];
    const consts: StackEntry[] = [entry(ValueType.String, 'CONST')];
    const ctx = new ExecutionContext(globals, consts);

    // Global
    expect(ctx.getVariable(Scope.Global, 0).value).toBe(10);
    ctx.setVariable(Scope.Global, 0, entry(ValueType.Int, 42));
    expect(globals[0].value).toBe(42);

    // Const
    expect(ctx.getVariable(Scope.Const, 0).value).toBe('CONST');
    expect(() => ctx.setVariable(Scope.Const, 0, entry(ValueType.String, 'X'))).toThrow(
      'Cannot assign to constant'
    );

    // Local
    ctx.pushFrame();
    ctx.stack.push(entry(ValueType.Bool, false));
    ctx.setVariable(Scope.Local, 0, entry(ValueType.Bool, true));
    expect(ctx.getVariable(Scope.Local, 0).value).toBe(true);
  });

  it('manages frames via stack and keeps frameOffset in sync', () => {
    const ctx = new ExecutionContext([], []);

    ctx.stack.push(entry(ValueType.Int, 1));
    ctx.stack.push(entry(ValueType.Int, 2));

    ctx.pushFrame();
    expect(ctx.frameOffset).toBe(2);

    ctx.stack.push(entry(ValueType.Int, 3));
    expect(ctx.stack.size).toBe(3);

    ctx.popFrame();
    expect(ctx.frameOffset).toBe(0);
    expect(ctx.stack.size).toBe(2);
  });
});
