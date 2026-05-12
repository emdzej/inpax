import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScreenExecutor } from './screen-executor.js';
import type { ScreenBlock, LineBlock, FunctionBlock } from '@emdzej/inpax-core';
import type { IInpaRuntime } from '@emdzej/inpax-interfaces';
import type { VM } from './interpreter.js';

// Mock VM. The real `ScreenExecutor.executeBlock` calls
// `vm.execute(block, ctx)` (NOT `vm.executeBlock`) — `executeBlock`
// on the VM is the entry point for menu/state-machine dispatch,
// which is unrelated to screen ticks. Mocking `execute` makes the
// executor's tick succeed; the asserts read it back as the spy.
// `createExecutionContext` on the executor pulls `getGlobals()` /
// `getConstants()` so we hand back empty arrays for those.
// `getRuntime` is needed for `executeInitPhase` → `ui.blankScreen()`.
const createMockVM = (runtime: IInpaRuntime) => ({
  execute: vi.fn().mockResolvedValue(undefined),
  executeBlock: vi.fn().mockResolvedValue(undefined),
  getScreenExecutor: vi.fn().mockReturnValue(null),
  getGlobals: vi.fn().mockReturnValue([]),
  getConstants: vi.fn().mockReturnValue([]),
  getRuntime: vi.fn().mockReturnValue(runtime),
} as unknown as VM);

// Mock runtime with UI provider
const createMockRuntime = (): IInpaRuntime => ({
  ui: {
    setScreen: vi.fn(),
    blankScreen: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  },
} as unknown as IInpaRuntime);

// Helper to create mock screen
const createMockScreen = (lineCount: number = 2): ScreenBlock => ({
  header: {
    type: 0x40,
    name: 'test_screen',
    blockId: 1,
    flags: 0,
    arg1: '',
    arg2: '',
    marker: 0,
    size: 0,
  },
  allocFunc: {
    header: { type: 0x10, name: 'alloc', blockId: 100, flags: 0, arg1: '', arg2: '', marker: 0, size: 0 },
    instructions: [],
  } as FunctionBlock,
  initFunc: {
    header: { type: 0x10, name: 'init', blockId: 101, flags: 0, arg1: '', arg2: '', marker: 0, size: 0 },
    instructions: [],
  } as FunctionBlock,
  lines: Array.from({ length: lineCount }, (_, i) => ({
    header: { type: 0x41, name: `line_${i}`, blockId: 200 + i, flags: 0, arg1: '', arg2: '', marker: 0, size: 0 },
    controls: [],
    func: {
      header: { type: 0x10, name: `line_${i}_func`, blockId: 300 + i, flags: 0, arg1: '', arg2: '', marker: 0, size: 0 },
      instructions: [],
    } as FunctionBlock,
  } as LineBlock)),
});

describe('ScreenExecutor', () => {
  let vm: VM;
  let runtime: IInpaRuntime;
  
  beforeEach(() => {
    vi.useFakeTimers();
    runtime = createMockRuntime();
    vm = createMockVM(runtime);
  });
  
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('lifecycle', () => {
    it('should start in init phase', async () => {
      const screen = createMockScreen();
      const executor = new ScreenExecutor(screen, false, vm, runtime);
      
      expect(executor.getPhase()).toBe('init');
      expect(executor.isRunning()).toBe(false);
    });

    it('should notify UI on start', async () => {
      const screen = createMockScreen();
      const executor = new ScreenExecutor(screen, true, vm, runtime);
      
      await executor.start();
      
      expect(runtime.ui.setScreen).toHaveBeenCalledWith(1, true);
    });

    it('should stop cleanly', async () => {
      const screen = createMockScreen();
      const executor = new ScreenExecutor(screen, false, vm, runtime);
      
      const stoppedHandler = vi.fn();
      executor.on('stopped', stoppedHandler);
      
      await executor.start();
      executor.stop();
      
      expect(executor.isRunning()).toBe(false);
      expect(stoppedHandler).toHaveBeenCalled();
    });

    it('should pause and resume', async () => {
      const screen = createMockScreen();
      const executor = new ScreenExecutor(screen, false, vm, runtime);
      
      await executor.start();
      executor.pause();
      
      expect(executor.isPaused()).toBe(true);
      expect(executor.isRunning()).toBe(true);
      
      executor.resume();
      
      expect(executor.isPaused()).toBe(false);
    });
  });

  describe('phase transitions', () => {
    it('should execute init phase and transition to line', async () => {
      const screen = createMockScreen();
      const executor = new ScreenExecutor(screen, false, vm, runtime, { tickInterval: 1 });
      
      const phaseHandler = vi.fn();
      executor.on('phase:changed', phaseHandler);
      
      await executor.start();
      
      // Advance past init phase
      await vi.advanceTimersByTimeAsync(50);

      // The executor dispatches through `vm.execute(block, ctx)` —
      // assert on the block arg, ignore the context.
      expect(vm.execute).toHaveBeenCalledWith(screen.allocFunc, expect.anything());
      expect(vm.execute).toHaveBeenCalledWith(screen.initFunc, expect.anything());
      expect(phaseHandler).toHaveBeenCalledWith('line');
    });

    it('should execute all lines in sequence', async () => {
      const screen = createMockScreen(3);
      const executor = new ScreenExecutor(screen, false, vm, runtime, { tickInterval: 1 });
      
      const lineStartHandler = vi.fn();
      executor.on('line:start', lineStartHandler);
      
      await executor.start();
      
      // Advance through init + 3 lines
      await vi.advanceTimersByTimeAsync(100);
      
      expect(lineStartHandler).toHaveBeenCalledTimes(3);
      expect(lineStartHandler).toHaveBeenNthCalledWith(1, 0, screen.lines[0]);
      expect(lineStartHandler).toHaveBeenNthCalledWith(2, 1, screen.lines[1]);
      expect(lineStartHandler).toHaveBeenNthCalledWith(3, 2, screen.lines[2]);
    });

    it('should go to idle after one-shot (frequentFlag=false)', async () => {
      const screen = createMockScreen(1);
      const executor = new ScreenExecutor(screen, false, vm, runtime, { tickInterval: 1 });
      
      const phaseHandler = vi.fn();
      executor.on('phase:changed', phaseHandler);
      
      await executor.start();
      await vi.advanceTimersByTimeAsync(100);
      
      expect(executor.getPhase()).toBe('idle');
    });

    it('should loop continuously when frequentFlag=true', async () => {
      const screen = createMockScreen(1);
      const executor = new ScreenExecutor(screen, true, vm, runtime, { tickInterval: 1 });
      
      const cycleHandler = vi.fn();
      executor.on('cycle:complete', cycleHandler);
      
      await executor.start();
      await vi.advanceTimersByTimeAsync(200);
      
      // Should complete multiple cycles
      expect(cycleHandler.mock.calls.length).toBeGreaterThan(1);
      expect(executor.getPhase()).toBe('line');
    });
  });

  describe('timers', () => {
    it('should set and test timer', () => {
      const screen = createMockScreen();
      const executor = new ScreenExecutor(screen, false, vm, runtime);
      
      executor.setTimer(0, 100);
      
      // Not expired yet
      expect(executor.testTimer(0)).toBe(false);
      
      // Advance time
      vi.advanceTimersByTime(150);
      
      // Now expired
      expect(executor.testTimer(0)).toBe(true);
    });

    it('should support multiple timers', () => {
      const screen = createMockScreen();
      const executor = new ScreenExecutor(screen, false, vm, runtime);
      
      executor.setTimer(0, 50);
      executor.setTimer(1, 100);
      executor.setTimer(2, 200);
      
      vi.advanceTimersByTime(75);
      
      expect(executor.testTimer(0)).toBe(true);
      expect(executor.testTimer(1)).toBe(false);
      expect(executor.testTimer(2)).toBe(false);
    });

    it('should throw for invalid timer number', () => {
      const screen = createMockScreen();
      const executor = new ScreenExecutor(screen, false, vm, runtime);
      
      expect(() => executor.setTimer(-1, 100)).toThrow('Invalid timer number');
      expect(() => executor.setTimer(8, 100)).toThrow('Invalid timer number');
    });

    it('should return true for non-existent timer', () => {
      const screen = createMockScreen();
      const executor = new ScreenExecutor(screen, false, vm, runtime);
      
      // Timer 5 was never set
      expect(executor.testTimer(5)).toBe(true);
    });

    it('should clear timers', () => {
      const screen = createMockScreen();
      const executor = new ScreenExecutor(screen, false, vm, runtime);
      
      executor.setTimer(0, 1000);
      expect(executor.testTimer(0)).toBe(false);
      
      executor.clearTimer(0);
      expect(executor.testTimer(0)).toBe(true);
    });

    it('should clear all timers', () => {
      const screen = createMockScreen();
      const executor = new ScreenExecutor(screen, false, vm, runtime);
      
      executor.setTimer(0, 1000);
      executor.setTimer(1, 1000);
      
      executor.clearAllTimers();
      
      expect(executor.testTimer(0)).toBe(true);
      expect(executor.testTimer(1)).toBe(true);
    });
  });

  describe('configuration', () => {
    it('should use custom tick interval', async () => {
      const screen = createMockScreen(1);
      const executor = new ScreenExecutor(screen, false, vm, runtime, { tickInterval: 50 });
      
      const cycleHandler = vi.fn();
      executor.on('cycle:complete', cycleHandler);
      
      await executor.start();
      
      // With 50ms tick: init (1 tick) + line (1 tick) = 2 ticks = 100ms minimum
      // Give it some extra time
      await vi.advanceTimersByTimeAsync(200);
      
      expect(cycleHandler).toHaveBeenCalled();
    });
  });
});
