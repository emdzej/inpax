import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MainScheduler } from './main-scheduler.js';
import type { VM } from './interpreter.js';
import type { ScreenExecutor } from './screen-executor.js';
import type { StateMachineExecutor } from './statemachine-executor.js';

// Mock executors
const createMockScreenExecutor = () => ({
  isRunning: vi.fn().mockReturnValue(true),
  isPaused: vi.fn().mockReturnValue(false),
  stop: vi.fn(),
  tick: vi.fn().mockResolvedValue(undefined),
} as unknown as ScreenExecutor);

const createMockStateMachineExecutor = () => ({
  isRunning: vi.fn().mockReturnValue(true),
  isPaused: vi.fn().mockReturnValue(false),
  stop: vi.fn(),
  tick: vi.fn().mockResolvedValue(undefined),
} as unknown as StateMachineExecutor);

// Mock VM
const createMockVM = (
  screenExecutor: ScreenExecutor | null = null,
  smExecutor: StateMachineExecutor | null = null
) => ({
  getScreenExecutor: vi.fn().mockReturnValue(screenExecutor),
  getStateMachineExecutor: vi.fn().mockReturnValue(smExecutor),
} as unknown as VM);

describe('MainScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('lifecycle', () => {
    it('should start and stop', () => {
      const vm = createMockVM();
      const scheduler = new MainScheduler(vm);

      expect(scheduler.isRunning()).toBe(false);

      scheduler.start();
      expect(scheduler.isRunning()).toBe(true);

      scheduler.stop();
      expect(scheduler.isRunning()).toBe(false);
    });

    it('should emit stopped event', () => {
      const vm = createMockVM();
      const scheduler = new MainScheduler(vm);

      const stoppedHandler = vi.fn();
      scheduler.on('stopped', stoppedHandler);

      scheduler.start();
      scheduler.stop();

      expect(stoppedHandler).toHaveBeenCalled();
    });

    it('should pause and resume', () => {
      const vm = createMockVM();
      const scheduler = new MainScheduler(vm);

      scheduler.start();
      scheduler.pause();

      expect(scheduler.isPaused()).toBe(true);
      expect(scheduler.isRunning()).toBe(true);

      scheduler.resume();

      expect(scheduler.isPaused()).toBe(false);
    });

    it('should stop sub-executors on stop', () => {
      const screenExecutor = createMockScreenExecutor();
      const smExecutor = createMockStateMachineExecutor();
      const vm = createMockVM(screenExecutor, smExecutor);
      const scheduler = new MainScheduler(vm);

      scheduler.start();
      scheduler.stop();

      expect(screenExecutor.stop).toHaveBeenCalled();
      expect(smExecutor.stop).toHaveBeenCalled();
    });
  });

  describe('tick execution', () => {
    it('should emit tick events', async () => {
      const smExecutor = createMockStateMachineExecutor();
      const screenExecutor = createMockScreenExecutor();
      const vm = createMockVM(screenExecutor, smExecutor);
      const scheduler = new MainScheduler(vm, { tickInterval: 1 });

      const tickStartHandler = vi.fn();
      const tickCompleteHandler = vi.fn();
      scheduler.on('tick:start', tickStartHandler);
      scheduler.on('tick:complete', tickCompleteHandler);

      scheduler.start();
      await vi.advanceTimersByTimeAsync(50);
      scheduler.stop();

      expect(tickStartHandler.mock.calls.length).toBeGreaterThan(0);
      expect(tickCompleteHandler.mock.calls.length).toBeGreaterThan(0);
    });

    it('should tick state machine executor', async () => {
      const smExecutor = createMockStateMachineExecutor();
      const vm = createMockVM(null, smExecutor);
      const scheduler = new MainScheduler(vm, { tickInterval: 1 });

      scheduler.start();
      await vi.advanceTimersByTimeAsync(50);
      scheduler.stop();

      expect(smExecutor.tick).toHaveBeenCalled();
    });

    it('should not tick paused state machine', async () => {
      const smExecutor = createMockStateMachineExecutor();
      smExecutor.isPaused = vi.fn().mockReturnValue(true);
      const vm = createMockVM(null, smExecutor);
      const scheduler = new MainScheduler(vm, { tickInterval: 1 });

      scheduler.start();
      await vi.advanceTimersByTimeAsync(50);
      scheduler.stop();

      expect(smExecutor.tick).not.toHaveBeenCalled();
    });
  });

  describe('menu actions (F-keys)', () => {
    it('should queue and execute menu action', async () => {
      const vm = createMockVM();
      const scheduler = new MainScheduler(vm, { tickInterval: 1 });

      const handler = vi.fn().mockResolvedValue(undefined);

      scheduler.start();
      scheduler.queueMenuAction(1, handler);

      expect(scheduler.hasPendingMenuAction()).toBe(true);

      await vi.advanceTimersByTimeAsync(50);

      expect(handler).toHaveBeenCalled();
      expect(scheduler.hasPendingMenuAction()).toBe(false);
    });

    it('should execute menu action before state machine', async () => {
      const smExecutor = createMockStateMachineExecutor();
      const vm = createMockVM(null, smExecutor);
      const scheduler = new MainScheduler(vm, { tickInterval: 1 });

      const executionOrder: string[] = [];

      const menuHandler = vi.fn().mockImplementation(async () => {
        executionOrder.push('menu');
      });

      smExecutor.tick = vi.fn().mockImplementation(async () => {
        executionOrder.push('statemachine');
      });

      scheduler.start();
      scheduler.queueMenuAction(1, menuHandler);

      await vi.advanceTimersByTimeAsync(10);
      scheduler.stop();

      // Menu should be first in the execution order
      expect(executionOrder[0]).toBe('menu');
    });

    it('should clear pending action after execution', async () => {
      const vm = createMockVM();
      const scheduler = new MainScheduler(vm, { tickInterval: 1 });

      const handler = vi.fn().mockResolvedValue(undefined);

      scheduler.start();
      scheduler.queueMenuAction(1, handler);
      
      await vi.advanceTimersByTimeAsync(10);

      expect(scheduler.hasPendingMenuAction()).toBe(false);
      
      // Subsequent ticks should not re-execute
      handler.mockClear();
      await vi.advanceTimersByTimeAsync(50);
      
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should emit error event on tick failure', async () => {
      const smExecutor = createMockStateMachineExecutor();
      smExecutor.tick = vi.fn().mockRejectedValue(new Error('Test error'));
      const vm = createMockVM(null, smExecutor);
      const scheduler = new MainScheduler(vm, { tickInterval: 1 });

      const errorHandler = vi.fn();
      scheduler.on('error', errorHandler);

      scheduler.start();
      await vi.advanceTimersByTimeAsync(10);
      scheduler.stop();

      expect(errorHandler).toHaveBeenCalled();
      expect(errorHandler.mock.calls[0][0].message).toBe('Test error');
    });

    it('should continue running after error', async () => {
      const smExecutor = createMockStateMachineExecutor();
      let callCount = 0;
      smExecutor.tick = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('First call error');
        }
      });
      const vm = createMockVM(null, smExecutor);
      const scheduler = new MainScheduler(vm, { tickInterval: 1 });

      scheduler.start();
      await vi.advanceTimersByTimeAsync(50);
      scheduler.stop();

      // Should have continued ticking after error
      expect(smExecutor.tick).toHaveBeenCalledTimes(callCount);
      expect(callCount).toBeGreaterThan(1);
    });
  });

  describe('configuration', () => {
    it('should use custom tick interval', async () => {
      const smExecutor = createMockStateMachineExecutor();
      const vm = createMockVM(null, smExecutor);
      const scheduler = new MainScheduler(vm, { tickInterval: 100 });

      scheduler.start();

      // After 50ms, should not have ticked yet (interval is 100ms)
      await vi.advanceTimersByTimeAsync(50);
      const callsAt50 = smExecutor.tick.mock.calls.length;

      // After another 100ms, should have ticked
      await vi.advanceTimersByTimeAsync(100);
      const callsAt150 = smExecutor.tick.mock.calls.length;

      scheduler.stop();

      expect(callsAt150).toBeGreaterThan(callsAt50);
    });
  });
});
