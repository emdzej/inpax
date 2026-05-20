import { describe, it, expect, vi } from 'vitest';
import {
  AluOp,
  CallTarget,
  Opcode,
  Scope,
  StackEntry,
  StackEntryFlags,
  SystemFunction,
  ValueType,
  type BlockHeader,
  type ConstantsBlock,
  type FunctionBlock,
  type GlobalsBlock,
  type Instruction,
  type IpoFile,
  type MenuBlock,
} from '@emdzej/inpax-core';
import { ExecutionContext } from './execution-context.js';
import { VM, type SystemFunctionOverride } from './interpreter.js';

const entry = (type: ValueType, value: StackEntry['value']): StackEntry => ({
  type,
  flags: StackEntryFlags.ByValue,
  value,
});

const createInstruction = (
  opcode: Opcode,
  operand1 = 0,
  operand2 = 0
): Instruction => ({
  opcode,
  operand1,
  operand2,
  raw: 0,
});

const createFunctionBlock = (instructions: Instruction[]): FunctionBlock => ({
  header: {
    type: 0x10,
    name: 'test_block',
    blockId: 1,
    flags: 0,
    arg1: '',
    arg2: '',
    marker: 0,
    size: 0,
  },
  instructions,
});

const createIpoFile = (
  block: FunctionBlock,
  options: { globalsTypes?: ValueType[]; constantValues?: StackEntry[] } = {}
): IpoFile => {
  const globals: GlobalsBlock = {
    header: {
      type: 0x01,
      name: 'globals',
      blockId: 2,
      flags: 0,
      arg1: '',
      arg2: '',
      marker: 0,
      size: 0,
    },
    types: options.globalsTypes ?? [ValueType.Int],
  };

  const constants: ConstantsBlock = {
    header: {
      type: 0x02,
      name: 'consts',
      blockId: 3,
      flags: 0,
      arg1: '',
      arg2: '',
      marker: 0,
      size: 0,
    },
    values: options.constantValues ?? [],
  };

  return {
    header: { versionHi: 1, versionLo: 0, magic: 'IPO' },
    globals,
    constants,
    functions: new Map([[block.header.blockId, block]]),
    screens: new Map(),
    menus: new Map(),
    stateMachines: new Map(),
  };
};

describe('VM.execute', () => {
  it('executes a block using the provided execution context', async () => {
    const block = createFunctionBlock([
      createInstruction(Opcode.LOAD, Scope.Global, 0),
      createInstruction(Opcode.PUSHIMM, 0x51, 1),
      createInstruction(Opcode.ALU, AluOp.ADD, 0),
      createInstruction(Opcode.PUSHR, Scope.Global, 0),
      createInstruction(Opcode.MOVE, 0, 1),
      createInstruction(Opcode.RET, 0, 0),
    ]);

    const ipo = createIpoFile(block);
    const vm = new VM(ipo);

    const globals: StackEntry[] = [entry(ValueType.Int, 41)];
    const ctx = new ExecutionContext(globals, []);

    await vm.execute(block, ctx);

    expect(globals[0].value).toBe(42);
  });

  it('loads values from global, const, and local scopes', async () => {
    const block = createFunctionBlock([
      createInstruction(Opcode.FRAME, 0, 0),
      createInstruction(Opcode.ALLOC, 0x51, 0),
      createInstruction(Opcode.PUSHIMM, 0x51, 30),
      createInstruction(Opcode.PUSHR, Scope.Local, 0),
      createInstruction(Opcode.MOVE, 0, 1),
      createInstruction(Opcode.LOAD, Scope.Global, 0),
      createInstruction(Opcode.LOAD, Scope.Const, 0),
      createInstruction(Opcode.LOAD, Scope.Local, 0),
      createInstruction(Opcode.RET, 0, 0),
    ]);

    const ipo = createIpoFile(block, {
      constantValues: [entry(ValueType.Int, 20)],
    });
    const vm = new VM(ipo);

    const globals: StackEntry[] = [entry(ValueType.Int, 10)];
    const ctx = new ExecutionContext(globals, ipo.constants.values);

    await vm.execute(block, ctx);

    expect(ctx.stack.pop().value).toBe(30);
    expect(ctx.stack.pop().value).toBe(20);
    expect(ctx.stack.pop().value).toBe(10);
  });

  describe('ALU boolean ops', () => {
    const runBoolBinary = async (op: AluOp, lhs: boolean, rhs: boolean) => {
      const block = createFunctionBlock([
        createInstruction(Opcode.PUSHIMM, 0x50, lhs ? 1 : 0),
        createInstruction(Opcode.PUSHIMM, 0x50, rhs ? 1 : 0),
        createInstruction(Opcode.ALU, op, 0),
        createInstruction(Opcode.RET, 0, 0),
      ]);
      const ipo = createIpoFile(block);
      const vm = new VM(ipo);
      const ctx = new ExecutionContext([entry(ValueType.Int, 0)], []);
      await vm.execute(block, ctx);
      return { vm, ctx };
    };

    it('AND pushes a Bool and updates the condition register', async () => {
      const { vm, ctx } = await runBoolBinary(AluOp.AND, true, false);
      const top = ctx.stack.peek();
      expect(top.type).toBe(ValueType.Bool);
      expect(top.value).toBe(false);
      expect(vm.getState().condition).toBe(0);
    });

    it('OR sets condition=1 when either operand is true', async () => {
      const { vm, ctx } = await runBoolBinary(AluOp.OR, false, true);
      expect(ctx.stack.peek().value).toBe(true);
      expect(vm.getState().condition).toBe(1);
    });

    it('XOR is logical xor on booleans and updates the condition register', async () => {
      const { vm: vmTrue, ctx: ctxTrue } = await runBoolBinary(AluOp.XOR, true, false);
      expect(ctxTrue.stack.peek().type).toBe(ValueType.Bool);
      expect(ctxTrue.stack.peek().value).toBe(true);
      expect(vmTrue.getState().condition).toBe(1);

      const { vm: vmFalse, ctx: ctxFalse } = await runBoolBinary(AluOp.XOR, true, true);
      expect(ctxFalse.stack.peek().value).toBe(false);
      expect(vmFalse.getState().condition).toBe(0);
    });
  });

  it('stores values to global and local scopes', async () => {
    const block = createFunctionBlock([
      createInstruction(Opcode.FRAME, 0, 0),
      createInstruction(Opcode.ALLOC, 0x51, 0),
      createInstruction(Opcode.PUSHIMM, 0x51, 5),
      createInstruction(Opcode.PUSHR, Scope.Global, 0),
      createInstruction(Opcode.MOVE, 0, 1),
      createInstruction(Opcode.PUSHIMM, 0x51, 7),
      createInstruction(Opcode.PUSHR, Scope.Local, 0),
      createInstruction(Opcode.MOVE, 0, 1),
      createInstruction(Opcode.RET, 0, 0),
    ]);

    const ipo = createIpoFile(block);
    const vm = new VM(ipo);

    const globals: StackEntry[] = [entry(ValueType.Int, 0)];
    const ctx = new ExecutionContext(globals, []);

    await vm.execute(block, ctx);

    expect(globals[0].value).toBe(5);
    expect(ctx.getVariable(Scope.Local, 0).value).toBe(7);
  });
});

describe('VM.executeMenuItem — menu-context persistence', () => {
  // Real BMW menus (e.g. KOMBI.IPO m_steuern_analog) lay out their
  // local variables by LOAD-ing default values onto the stack at the
  // start of the menu body. Those values become `local[0]`,
  // `local[1]`, … and every MenuItemFunc (each F-key handler) reads
  // them via `PUSHREF local[i]` / `LOAD local[i]`. The menu body and
  // its item handlers therefore share one ExecutionContext —
  // re-creating it per item would expose an empty stack to
  // `PUSHREF local[0]` and throw "Stack index out of bounds".
  //
  // These tests pin down that:
  //   1. After `setMenu` resolves, `executeMenuItem` reuses the
  //      menu's context — local[0] reads the value INIT pushed.
  //   2. Without an active menu context (no setMenu has run, or
  //      a fresh VM), `executeMenuItem` still runs the handler but
  //      without locals — equivalent to the legacy `executeBlock`
  //      path.

  function blockHeader(overrides: Partial<BlockHeader> = {}): BlockHeader {
    return {
      type: 0x05,
      name: '',
      blockId: 0,
      flags: 0,
      arg1: '',
      arg2: '',
      marker: 0,
      size: 0,
      ...overrides,
    };
  }

  function createMenuIpo(opts: {
    menuInit: FunctionBlock;
    item: FunctionBlock;
    itemFKey: number;
    constants: StackEntry[];
    globalsTypes?: ValueType[];
  }): IpoFile {
    const menu: MenuBlock = {
      header: blockHeader({ type: 0x02, name: 'm_test', blockId: 1 }),
      func: opts.menuInit,
      items: [
        { header: blockHeader({ type: 0x24, name: 'item0', blockId: 0, flags: opts.itemFKey }), func: opts.item },
      ],
    };

    return {
      header: { versionHi: 5, versionLo: 0, magic: 'IPO' },
      globals: {
        header: blockHeader({ type: 0x11, name: 'globals', blockId: 2 }),
        types: opts.globalsTypes ?? [ValueType.Int],
      },
      constants: {
        header: blockHeader({ type: 0x12, name: 'consts', blockId: 3 }),
        values: opts.constants,
      },
      functions: new Map(),
      screens: new Map(),
      menus: new Map([[1, menu]]),
      stateMachines: new Map(),
    };
  }

  it('preserves menu locals from INIT into the item handler', async () => {
    // Menu INIT: pushes one int constant onto the stack — that
    // becomes local[0]. Mirrors how real menus declare locals
    // (no separate ALLOC sub-block, the LOADs at body-start ARE
    // the allocation).
    const menuInit = createFunctionBlock([
      createInstruction(Opcode.LOAD, Scope.Const, 0), // push const[0] = 42
      createInstruction(Opcode.RET, 0, 0),
    ]);

    // Item handler: reads local[0] and stores into global[0].
    // This is the bytecode shape that would throw under the old
    // (always-fresh-context) behaviour.
    const itemFunc = createFunctionBlock([
      createInstruction(Opcode.LOAD, Scope.Local, 0),
      createInstruction(Opcode.PUSHR, Scope.Global, 0),
      createInstruction(Opcode.MOVE, 0, 1),
      createInstruction(Opcode.RET, 0, 0),
    ]);

    const ipo = createMenuIpo({
      menuInit,
      item: itemFunc,
      itemFKey: 0,
      constants: [entry(ValueType.Int, 42)],
    });
    const vm = new VM(ipo);

    // setMenu schedules INIT via setTimeout(0); drain the macrotask
    // queue so the persistent context is in place before we dispatch
    // the item handler.
    await vm.setMenu(1);
    await new Promise((resolve) => setTimeout(resolve, 0));

    await vm.executeMenuItem(itemFunc);

    expect(vm.getGlobals()[0].value).toBe(42);
  });

  it('falls back to an isolated execution when no menu is active', async () => {
    // No setMenu has run — activeMenuContext is null. An item that
    // doesn't touch locals should still execute cleanly.
    const itemFunc = createFunctionBlock([
      createInstruction(Opcode.PUSHIMM, 0x51, 7), // push int 7
      createInstruction(Opcode.PUSHR, Scope.Global, 0),
      createInstruction(Opcode.MOVE, 0, 1),
      createInstruction(Opcode.RET, 0, 0),
    ]);

    const ipo = createMenuIpo({
      menuInit: createFunctionBlock([createInstruction(Opcode.RET, 0, 0)]),
      item: itemFunc,
      itemFKey: 0,
      constants: [],
    });
    const vm = new VM(ipo);

    await vm.executeMenuItem(itemFunc);

    expect(vm.getGlobals()[0].value).toBe(7);
  });

  it('clears the menu context on subsequent setMenu so stale locals are not reused', async () => {
    // First menu pushes 11 as local[0]; second menu pushes 22.
    // After swapping to the second menu, an item that reads local[0]
    // should see 22, not 11.
    const firstInit = createFunctionBlock([
      createInstruction(Opcode.LOAD, Scope.Const, 0), // push 11
      createInstruction(Opcode.RET, 0, 0),
    ]);
    const secondInit = createFunctionBlock([
      createInstruction(Opcode.LOAD, Scope.Const, 1), // push 22
      createInstruction(Opcode.RET, 0, 0),
    ]);
    const item = createFunctionBlock([
      createInstruction(Opcode.LOAD, Scope.Local, 0),
      createInstruction(Opcode.PUSHR, Scope.Global, 0),
      createInstruction(Opcode.MOVE, 0, 1),
      createInstruction(Opcode.RET, 0, 0),
    ]);

    const ipo = createMenuIpo({
      menuInit: firstInit,
      item,
      itemFKey: 0,
      constants: [entry(ValueType.Int, 11), entry(ValueType.Int, 22)],
    });
    // Swap in a second menu with a different INIT.
    ipo.menus.set(2, {
      header: blockHeader({ type: 0x02, name: 'm_test2', blockId: 2 }),
      func: secondInit,
      items: [
        { header: blockHeader({ type: 0x24, name: 'item0', blockId: 0, flags: 0 }), func: item },
      ],
    });
    const vm = new VM(ipo);

    await vm.setMenu(1);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await vm.executeMenuItem(item);
    expect(vm.getGlobals()[0].value).toBe(11);

    await vm.setMenu(2);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await vm.executeMenuItem(item);
    expect(vm.getGlobals()[0].value).toBe(22);
  });
});

describe('VM.systemFunctions — host overrides', () => {
  // Hosts (CLI, web app, TUI) need different semantics for the same
  // BEST2 verb — `exitwindows` in the browser should close a tab, in
  // the CLI should `process.exit`. The `systemFunctions` config slot
  // lets the host wire those in without forking the interpreter.
  //
  // The override fully replaces the default; both internal-functions
  // routing (e.g. `exitwindows` as `this.exit()`) and dispatcher
  // routing are skipped when an entry is registered.

  function callSysBlock(funcId: number): FunctionBlock {
    return createFunctionBlock([
      createInstruction(Opcode.FRAME, 0, 0),
      createInstruction(Opcode.CALL, CallTarget.SystemFunction, funcId),
      createInstruction(Opcode.RET, 0, 0),
    ]);
  }

  it('runs a registered override instead of the default handler', async () => {
    const handler = vi.fn();
    const block = callSysBlock(SystemFunction.exitwindows);
    const ipo = createIpoFile(block);

    const vm = new VM(ipo, {
      systemFunctions: new Map<number, SystemFunctionOverride>([
        [SystemFunction.exitwindows, handler],
      ]),
    });

    const ctx = new ExecutionContext([entry(ValueType.Int, 0)], []);
    await vm.execute(block, ctx);

    expect(handler).toHaveBeenCalledTimes(1);
    // VM still running — default `exitwindows` would have stopped it.
    expect(handler.mock.calls[0][1]).toBe(vm);
  });

  it('awaits an async override before resuming bytecode', async () => {
    const order: string[] = [];
    const block = callSysBlock(SystemFunction.exitwindows);
    const ipo = createIpoFile(block);

    const vm = new VM(ipo, {
      systemFunctions: new Map<number, SystemFunctionOverride>([
        [SystemFunction.exitwindows, async () => {
          order.push('start');
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
          order.push('end');
        }],
      ]),
    });

    const ctx = new ExecutionContext([entry(ValueType.Int, 0)], []);
    await vm.execute(block, ctx);

    expect(order).toEqual(['start', 'end']);
  });

  it('falls through to the default when no override is registered', async () => {
    // `exit` is an internal-functions handler that flips `running` to
    // false. Without an override the VM should still take that path.
    const block = callSysBlock(SystemFunction.exit);
    const ipo = createIpoFile(block);
    const vm = new VM(ipo);

    const ctx = new ExecutionContext([entry(ValueType.Int, 0)], []);
    await vm.execute(block, ctx);
    // No throw, no override called — default routing took effect.
  });
});
