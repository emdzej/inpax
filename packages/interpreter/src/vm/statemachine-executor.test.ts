import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StateMachineExecutor } from './statemachine-executor.js';
import type { StateMachineBlock, StateBlock, FunctionBlock, BlockHeader } from '@inpax/core';
import { BlockType } from '@inpax/core';
import type { IInpaRuntime } from '@inpax/interfaces';
import type { VM } from './interpreter.js';

// Mock VM
const createMockVM = () => ({
  executeBlock: vi.fn().mockResolvedValue(undefined),
  getStateMachineExecutor: vi.fn().mockReturnValue(null),
} as unknown as VM);

// Mock runtime
const createMockRuntime = () => ({
  ui: {
    setScreen: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  },
} as unknown as IInpaRuntime);

// Helper to create mock function block
const createFuncBlock = (name: string, id: number): FunctionBlock => ({
  header: {
    type: BlockType.Function,
    name,
    blockId: id,
    flags: 0,
    arg1: '',
    arg2: '',
    marker: 0,
    size: 0,
  } as BlockHeader,
  instructions: [],
});

// Helper to create mock state block
const createStateBlock = (name: string, id: number): StateBlock => ({
  header: {
    type: BlockType.StateFunc,
    name,
    blockId: id,
    flags: 0,
    arg1: '',
    arg2: '',
    marker: 0,
    size: 0,
  } as BlockHeader,
  func: createFuncBlock(`${name}_func`, id + 100),
});

// Helper to create mock state machine
const createMockStateMachine = (name: string, stateNames: string[]): StateMachineBlock => ({
  header: {
    type: BlockType.StateMachine,
    name,
    blockId: 1,
    flags: 0,
    arg1: '',
    arg2: '',
    marker: 0,
    size: 0,
  } as BlockHeader,
  func: createFuncBlock(`${name}_init`, 10), // INIT function
  states: stateNames.map((sn, i) => createStateBlock(sn, 20 + i)),
});

describe('StateMachineExecutor', () => {
  let vm: VM;
  let runtime: IInpaRuntime;
  let executor: StateMachineExecutor;

  beforeEach(() => {
    vm = createMockVM();
    runtime = createMockRuntime();
    executor = new StateMachineExecutor(vm, runtime);
  });

  describe('registration', () => {
    it('should register a state machine', () => {
      const sm = createMockStateMachine('sm_main', ['Z_WORK', 'Z_DONE']);
      executor.registerStateMachine(sm);
      
      // Should be able to start it
      expect(async () => await executor.start('sm_main')).not.toThrow();
    });

    it('should register multiple state machines', () => {
      const sm1 = createMockStateMachine('sm_main', ['Z_WORK']);
      const sm2 = createMockStateMachine('sm_sub', ['Z_SUB']);
      
      executor.registerStateMachines([sm1, sm2]);
      
      expect(async () => await executor.start('sm_main')).not.toThrow();
      expect(async () => await executor.start('sm_sub')).not.toThrow();
    });

    it('should throw for unregistered state machine', async () => {
      await expect(executor.start('sm_unknown')).rejects.toThrow('State machine not found');
    });
  });

  describe('lifecycle', () => {
    it('should start in INIT state', async () => {
      const sm = createMockStateMachine('sm_main', ['Z_WORK']);
      executor.registerStateMachine(sm);
      
      await executor.start('sm_main');
      
      expect(executor.isRunning()).toBe(true);
      expect(executor.getCurrentStateMachine()).toBe('sm_main');
      expect(executor.getCurrentState()).toBe('INIT');
    });

    it('should emit statemachine:entered on start', async () => {
      const sm = createMockStateMachine('sm_main', ['Z_WORK']);
      executor.registerStateMachine(sm);
      
      const enteredHandler = vi.fn();
      executor.on('statemachine:entered', enteredHandler);
      
      await executor.start('sm_main');
      
      expect(enteredHandler).toHaveBeenCalledWith('sm_main');
    });

    it('should stop cleanly', async () => {
      const sm = createMockStateMachine('sm_main', ['Z_WORK']);
      executor.registerStateMachine(sm);
      
      const stoppedHandler = vi.fn();
      executor.on('stopped', stoppedHandler);
      
      await executor.start('sm_main');
      executor.stop();
      
      expect(executor.isRunning()).toBe(false);
      expect(stoppedHandler).toHaveBeenCalled();
    });

    it('should pause and resume', async () => {
      const sm = createMockStateMachine('sm_main', ['Z_WORK']);
      executor.registerStateMachine(sm);
      
      await executor.start('sm_main');
      executor.pause();
      
      expect(executor.isPaused()).toBe(true);
      expect(executor.isRunning()).toBe(true);
      
      executor.resume();
      
      expect(executor.isPaused()).toBe(false);
    });
  });

  describe('state transitions', () => {
    it('should execute INIT state on first tick', async () => {
      const sm = createMockStateMachine('sm_main', ['Z_WORK']);
      executor.registerStateMachine(sm);
      
      await executor.start('sm_main');
      await executor.tick();
      
      // INIT function should have been executed
      expect(vm.executeBlock).toHaveBeenCalledWith(sm.func);
    });

    it('should transition to new state with setState', async () => {
      const sm = createMockStateMachine('sm_main', ['Z_WORK', 'Z_DONE']);
      executor.registerStateMachine(sm);
      
      const stateChangedHandler = vi.fn();
      executor.on('state:changed', stateChangedHandler);
      
      await executor.start('sm_main');
      
      // Execute INIT
      await executor.tick();
      
      // Schedule transition
      executor.setState('Z_WORK');
      
      // Process transition
      await executor.tick();
      
      expect(executor.getCurrentState()).toBe('Z_WORK');
      expect(stateChangedHandler).toHaveBeenCalledWith('INIT', 'Z_WORK');
    });

    it('should stay in same state if no setstate called', async () => {
      const sm = createMockStateMachine('sm_main', ['Z_WORK']);
      executor.registerStateMachine(sm);
      
      await executor.start('sm_main');
      await executor.tick(); // INIT
      
      executor.setState('Z_WORK');
      await executor.tick(); // transition to Z_WORK
      
      // No setstate - should stay in Z_WORK
      await executor.tick();
      await executor.tick();
      
      expect(executor.getCurrentState()).toBe('Z_WORK');
    });

    it('should throw for invalid state name', async () => {
      const sm = createMockStateMachine('sm_main', ['Z_WORK']);
      executor.registerStateMachine(sm);
      
      await executor.start('sm_main');
      await executor.tick();
      
      executor.setState('Z_INVALID');
      
      await expect(executor.tick()).rejects.toThrow("State 'Z_INVALID' not found");
    });
  });

  describe('nested state machines', () => {
    it('should call sub-state machine', async () => {
      const smMain = createMockStateMachine('sm_main', ['Z_WORK']);
      const smSub = createMockStateMachine('sm_sub', ['Z_SUB']);
      executor.registerStateMachines([smMain, smSub]);
      
      const enteredHandler = vi.fn();
      executor.on('statemachine:entered', enteredHandler);
      
      await executor.start('sm_main');
      await executor.tick(); // INIT of sm_main
      
      // Call sub-state machine
      executor.callStateMachine('sm_sub');
      await executor.tick(); // Process call
      
      expect(executor.getCurrentStateMachine()).toBe('sm_sub');
      expect(executor.getCurrentState()).toBe('INIT');
      expect(executor.getCallDepth()).toBe(2);
      expect(enteredHandler).toHaveBeenCalledWith('sm_sub', 'sm_main');
    });

    it('should return from sub-state machine', async () => {
      const smMain = createMockStateMachine('sm_main', ['Z_WORK']);
      const smSub = createMockStateMachine('sm_sub', ['Z_SUB']);
      executor.registerStateMachines([smMain, smSub]);
      
      const returnedHandler = vi.fn();
      executor.on('statemachine:returned', returnedHandler);
      
      await executor.start('sm_main');
      await executor.tick(); // INIT of sm_main
      
      executor.callStateMachine('sm_sub');
      await executor.tick(); // Process call, now in sm_sub INIT
      
      executor.returnStateMachine();
      await executor.tick(); // Process return
      
      expect(executor.getCurrentStateMachine()).toBe('sm_main');
      expect(executor.getCallDepth()).toBe(1);
      expect(returnedHandler).toHaveBeenCalledWith('sm_sub', 'sm_main');
    });

    it('should stop when returning from top-level state machine', async () => {
      const sm = createMockStateMachine('sm_main', ['Z_WORK']);
      executor.registerStateMachine(sm);
      
      const stoppedHandler = vi.fn();
      executor.on('stopped', stoppedHandler);
      
      await executor.start('sm_main');
      await executor.tick();
      
      executor.returnStateMachine();
      await executor.tick();
      
      expect(executor.isRunning()).toBe(false);
      expect(stoppedHandler).toHaveBeenCalled();
    });

    it('should support deep nesting', async () => {
      const sm1 = createMockStateMachine('sm_1', ['Z_1']);
      const sm2 = createMockStateMachine('sm_2', ['Z_2']);
      const sm3 = createMockStateMachine('sm_3', ['Z_3']);
      executor.registerStateMachines([sm1, sm2, sm3]);
      
      await executor.start('sm_1');
      await executor.tick();
      
      executor.callStateMachine('sm_2');
      await executor.tick();
      
      executor.callStateMachine('sm_3');
      await executor.tick();
      
      expect(executor.getCallDepth()).toBe(3);
      expect(executor.getCurrentStateMachine()).toBe('sm_3');
      
      // Return all the way back
      executor.returnStateMachine();
      await executor.tick();
      expect(executor.getCurrentStateMachine()).toBe('sm_2');
      
      executor.returnStateMachine();
      await executor.tick();
      expect(executor.getCurrentStateMachine()).toBe('sm_1');
    });
  });

  describe('error handling', () => {
    it('should throw when setState called without active state machine', () => {
      expect(() => executor.setState('Z_WORK')).toThrow('No active state machine');
    });

    it('should throw when callStateMachine with unknown name', async () => {
      const sm = createMockStateMachine('sm_main', ['Z_WORK']);
      executor.registerStateMachine(sm);
      
      await executor.start('sm_main');
      
      expect(() => executor.callStateMachine('sm_unknown')).toThrow('State machine not found');
    });
  });

  describe('cycle events', () => {
    it('should emit cycle:complete after each tick', async () => {
      const sm = createMockStateMachine('sm_main', ['Z_WORK']);
      executor.registerStateMachine(sm);
      
      const cycleHandler = vi.fn();
      executor.on('cycle:complete', cycleHandler);
      
      await executor.start('sm_main');
      await executor.tick();
      await executor.tick();
      await executor.tick();
      
      expect(cycleHandler).toHaveBeenCalledTimes(3);
    });
  });
});
