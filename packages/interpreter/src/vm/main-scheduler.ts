import { EventEmitter } from 'eventemitter3';
import { getLogger } from '@emdzej/inpax-logger';
import type { VM } from './interpreter.js';

const log = getLogger('main-scheduler');

/**
 * Main scheduler events
 */
export interface MainSchedulerEvents {
  'tick:start': () => void;
  'tick:screen': () => void;
  'tick:statemachine': () => void;
  'tick:complete': () => void;
  'stopped': () => void;
  'error': (error: Error) => void;
}

/**
 * Main scheduler configuration
 */
export interface MainSchedulerConfig {
  /** Tick interval in milliseconds (default: 16ms ~60fps) */
  tickInterval?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Pending menu action (F-key handler)
 */
export interface PendingMenuAction {
  itemNum: number;
  handler: () => Promise<void>;
}

/**
 * Main Scheduler
 * 
 * Coordinates execution of Screen, StateMachine, and F-key handlers
 * in the correct priority order:
 * 
 * 1. F-key handlers (highest priority - interrupts everything)
 * 2. State machine tick (one state per cycle)
 * 3. Screen LINE execution (continuous when frequentFlag=true)
 * 
 * Based on INPA's MFC OnIdle polling model.
 */
export class MainScheduler extends EventEmitter<MainSchedulerEvents> {
  private vm: VM;
  
  // Execution state
  private running: boolean = false;
  private paused: boolean = false;
  
  // Pending F-key action
  private pendingMenuAction: PendingMenuAction | null = null;
  
  // Configuration
  private tickInterval: number;
  private debug: boolean;
  
  // Internal scheduling
  private tickTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastTickTime: number = 0;

  constructor(vm: VM, config: MainSchedulerConfig = {}) {
    super();
    this.vm = vm;
    this.tickInterval = config.tickInterval ?? 16;
    this.debug = config.debug ?? false;
  }

  /**
   * Start the main execution loop
   */
  start(): void {
    if (this.running) {
      this.log('Already running');
      return;
    }
    
    this.running = true;
    this.paused = false;
    this.lastTickTime = Date.now();
    
    this.log('Main scheduler started');
    this.scheduleNextTick();
  }

  /**
   * Stop the main execution loop
   */
  stop(): void {
    this.running = false;
    this.paused = false;
    
    if (this.tickTimeout) {
      clearTimeout(this.tickTimeout);
      this.tickTimeout = null;
    }
    
    // Stop sub-executors
    const screenExecutor = this.vm.getScreenExecutor();
    if (screenExecutor) {
      screenExecutor.stop();
    }
    
    const smExecutor = this.vm.getStateMachineExecutor();
    if (smExecutor) {
      smExecutor.stop();
    }
    
    this.log('Main scheduler stopped');
    this.emit('stopped');
  }

  /**
   * Pause execution
   */
  pause(): void {
    this.paused = true;
    this.log('Main scheduler paused');
  }

  /**
   * Resume execution
   */
  resume(): void {
    if (this.paused && this.running) {
      this.paused = false;
      this.log('Main scheduler resumed');
      this.scheduleNextTick();
    }
  }

  /**
   * Check if running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Check if paused
   */
  isPaused(): boolean {
    return this.paused;
  }

  /**
   * Queue an F-key handler for execution
   * Will be executed on next tick with highest priority
   */
  queueMenuAction(itemNum: number, handler: () => Promise<void>): void {
    this.pendingMenuAction = { itemNum, handler };
    this.log(`Queued menu action: F${itemNum}`);
  }

  /**
   * Check if there's a pending menu action
   */
  hasPendingMenuAction(): boolean {
    return this.pendingMenuAction !== null;
  }

  // === Internal Methods ===

  /**
   * Schedule next tick
   */
  private scheduleNextTick(): void {
    if (!this.running || this.paused) {
      return;
    }

    const now = Date.now();
    const elapsed = now - this.lastTickTime;
    const delay = Math.max(0, this.tickInterval - elapsed);

    this.tickTimeout = setTimeout(async () => {
      this.lastTickTime = Date.now();
      await this.tick();
      this.scheduleNextTick();
    }, delay);
  }

  /**
   * Execute one tick of the main loop
   * 
   * Priority order:
   * 1. F-key handlers (highest)
   * 2. State machine
   * 3. Screen (lowest)
   */
  private async tick(): Promise<void> {
    if (!this.running || this.paused) {
      return;
    }

    this.emit('tick:start');

    try {
      // 1. F-key handlers (highest priority)
      if (this.pendingMenuAction) {
        const action = this.pendingMenuAction;
        this.pendingMenuAction = null;
        
        this.log(`Executing menu action: F${action.itemNum}`);
        await action.handler();
      }

      // 2. State machine tick
      const smExecutor = this.vm.getStateMachineExecutor();
      if (smExecutor?.isRunning() && !smExecutor.isPaused()) {
        this.emit('tick:statemachine');
        await smExecutor.tick();
      }

      // 3. Screen tick (handled internally by ScreenExecutor's own timer)
      // Note: ScreenExecutor runs its own setTimeout loop, so we just
      // emit the event for tracking purposes
      const screenExecutor = this.vm.getScreenExecutor();
      if (screenExecutor?.isRunning() && !screenExecutor.isPaused()) {
        this.emit('tick:screen');
        // ScreenExecutor handles its own timing
      }

      this.emit('tick:complete');
    } catch (error) {
      this.log(`Error in tick: ${error}`);
      this.emit('error', error as Error);
    }
  }

  /**
   * Debug logging
   */
  private log(message: string): void {
    if (this.debug) {
      log.debug({ message }, 'main scheduler');
    }
  }
}
