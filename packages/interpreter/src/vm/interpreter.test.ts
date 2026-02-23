import { describe, it, expect } from 'vitest';
import {
  AluOp,
  Opcode,
  Scope,
  StackEntry,
  StackEntryFlags,
  ValueType,
  type ConstantsBlock,
  type FunctionBlock,
  type GlobalsBlock,
  type Instruction,
  type IpoFile,
} from '@emdzej/inpax-core';
import { ExecutionContext } from './execution-context.js';
import { VM } from './interpreter.js';

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
      createInstruction(Opcode.PUSHREFSTORE, Scope.Global, 0),
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
      createInstruction(Opcode.PUSHREFSTORE, Scope.Local, 0),
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

  it('stores values to global and local scopes', async () => {
    const block = createFunctionBlock([
      createInstruction(Opcode.FRAME, 0, 0),
      createInstruction(Opcode.ALLOC, 0x51, 0),
      createInstruction(Opcode.PUSHIMM, 0x51, 5),
      createInstruction(Opcode.PUSHREFSTORE, Scope.Global, 0),
      createInstruction(Opcode.MOVE, 0, 1),
      createInstruction(Opcode.PUSHIMM, 0x51, 7),
      createInstruction(Opcode.PUSHREFSTORE, Scope.Local, 0),
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
