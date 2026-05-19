import { describe, it, expect } from 'vitest';
import { Scope, StackEntry, StackEntryFlags, ValueType } from '@emdzej/inpax-core';
import { ExecutionContext } from './execution-context.js';

const entry = (type: ValueType, value: StackEntry['value']): StackEntry => ({
  type,
  flags: StackEntryFlags.ByValue,
  value,
});

describe('ExecutionContext UI handle scopes', () => {
  const makeCtx = () =>
    new ExecutionContext(
      [entry(ValueType.Int, 0)],
      [entry(ValueType.Int, 0)]
    );

  describe('getVariable', () => {
    it.each([
      ['Screen', Scope.Screen],
      ['Menu', Scope.Menu],
      ['StateMachine', Scope.StateMachine],
    ])('returns a synthetic Handle entry for scope %s', (_label, scope) => {
      const ctx = makeCtx();
      const result = ctx.getVariable(scope, 3);

      expect(result.type).toBe(ValueType.ULong);
      expect(result.value).toBe(3);
      expect(result.refInfo).toEqual({ scope, index: 3 });
    });

    it('encodes the operand index in both value (for popInt) and refInfo.index (for popRef)', () => {
      const ctx = makeCtx();
      const handle = ctx.getVariable(Scope.Menu, 7);
      expect(handle.value).toBe(7);
      expect(handle.refInfo?.index).toBe(7);
    });

    it('still throws on truly unknown scopes', () => {
      const ctx = makeCtx();
      expect(() => ctx.getVariable(0x7f as Scope, 0)).toThrow(/Unsupported scope/);
    });
  });

  describe('setVariable', () => {
    it.each([
      ['Screen', Scope.Screen],
      ['Menu', Scope.Menu],
      ['StateMachine', Scope.StateMachine],
    ])('rejects writes to UI handle scope %s', (_label, scope) => {
      const ctx = makeCtx();
      expect(() => ctx.setVariable(scope, 0, entry(ValueType.Int, 42))).toThrow(
        /Cannot assign to UI handle/
      );
    });
  });

  describe('createRef', () => {
    it('preserves the synthetic value on the by-reference entry for UI scopes', () => {
      // PUSHREF goes through createRef. setmenu's popInt() reads .value,
      // setscreen's popRef() reads .refInfo.index — both must work.
      const ctx = makeCtx();
      const ref = ctx.createRef(Scope.Screen, 2);

      expect(ref.flags).toBe(StackEntryFlags.ByReference);
      expect(ref.value).toBe(2);
      expect(ref.refInfo).toEqual({ scope: Scope.Screen, index: 2 });
    });

    it('still nulls the value for storage scopes (refs are write targets there)', () => {
      const ctx = makeCtx();
      const ref = ctx.createRef(Scope.Global, 0);
      expect(ref.value).toBeNull();
      expect(ref.refInfo).toEqual({ scope: Scope.Global, index: 0 });
    });
  });
});
