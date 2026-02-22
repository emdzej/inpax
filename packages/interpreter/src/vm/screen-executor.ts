import { EventEmitter } from 'eventemitter3';
import type { ScreenBlock, LineBlock } from '@inpax/core';
import type { IInpaRuntime } from '@inpax/interfaces';
import type { VM } from './interpreter.js';

/**
 * Screen execution phase
 */
export type ScreenPhase = 'init' | 'line' | 'idle';

/**
 * Screen executor events
 */
export interface ScreenExecutorEvents {
  'phase:changed': (phase: ScreenPhase) => void;
  'line:start': (lineIndex: number, line: LineBlock) => void;
  'line:complete': (lineIndex: number) => void;
  'cycle:complete': () => void;
  'stopped': () => void;
}

/**
 * Screen executor configuration
 */
export interface ScreenExecutorConfig {
  /** Tick interval in milliseconds (default: 16ms ~60fps) */
  tickInterval?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Timer entry
 */
interface TimerEntry {
  expiresAt: number;
}

/**
 * Screen Executor
 * 
 * Implements the INPA screen execution model with 3-phase cycle:
 * - INIT: Runs once on screen activation
 * - LINE: Runs each LINE block, loops when frequentFlag=true
 * - IDLE: Waiting state between cycles (only when frequentFlag=false)
 * 
 * Based on reverse engineering of INPA.exe - uses polling model
 * similar to MFC's OnIdle handler.
 */
export class ScreenExecutor extends EventEmitter<ScreenExecutorEvents> {
  private screen: ScreenBlock;
  private frequentFlag: boolean;
  private vm: VM;
  private runtime: IInpaRuntime;
  
  // Execution state
  private phase: ScreenPhase = 'init';
  private lineIndex: number = 0;
  private running: boolean = false;
  private paused: boolean = false;
  
  // Timer system (8 slots like original INPA)
  private timers: Map<number, TimerEntry> = new Map();
  private static readonly MAX_TIMERS = 8;
  
  // Configuration
  private tickInterval: number;
  private debug: boolean;
  
  // Internal scheduling
  private tickTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastTickTime: number = 0;

  constructor(
    screen: ScreenBlock,
    frequentFlag: boolean,
    vm: VM,
    runtime: IInpaRuntime,
    config: ScreenExecutorConfig = {}
  ) {
    super();
    this.screen = screen;
    this.frequentFlag = frequentFlag;
    this.vm = vm;
    this.runtime = runtime;
    this.tickInterval = config.tickInterval ?? 16;
    this.debug = config.debug ?? false;
  }

  /**
   * Start screen execution
   */
  async start(): Promise<void> {
    if (this.running) {
      this.log('Already running');
      return;
    }
    
    this.running = true;
    this.paused = false;
    this.phase = 'init';
    this.lineIndex = 0;
    this.lastTickTime = Date.now();
    
    this.log(`Starting screen execution (frequent=${this.frequentFlag})`);
    
    // Notify UI
    this.runtime.ui.setScreen(this.screen.header.blockId, this.frequentFlag);
    
    // Start the execution loop
    this.scheduleNextTick();
  }

  /**
   * Stop screen execution
   */
  stop(): void {
    this.running = false;
    this.paused = false;
    
    if (this.tickTimeout) {
      clearTimeout(this.tickTimeout);
      this.tickTimeout = null;
    }
    
    this.log('Screen execution stopped');
    this.emit('stopped');
  }

  /**
   * Pause execution (can be resumed)
   */
  pause(): void {
    this.paused = true;
    this.log('Screen execution paused');
  }

  /**
   * Resume paused execution
   */
  resume(): void {
    if (this.paused && this.running) {
      this.paused = false;
      this.log('Screen execution resumed');
      this.scheduleNextTick();
    }
  }

  /**
   * Check if executor is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Check if executor is paused
   */
  isPaused(): boolean {
    return this.paused;
  }

  /**
   * Get current execution phase
   */
  getPhase(): ScreenPhase {
    return this.phase;
  }

  /**
   * Get current line index
   */
  getLineIndex(): number {
    return this.lineIndex;
  }

  // === Timer API ===

  /**
   * Set a countdown timer
   * @param timerNum Timer slot (0-7)
   * @param ms Milliseconds until expiration
   */
  setTimer(timerNum: number, ms: number): void {
    if (timerNum < 0 || timerNum >= ScreenExecutor.MAX_TIMERS) {
      throw new Error(`Invalid timer number: ${timerNum} (must be 0-${ScreenExecutor.MAX_TIMERS - 1})`);
    }
    
    this.timers.set(timerNum, {
      expiresAt: Date.now() + ms,
    });
    
    this.log(`Timer ${timerNum} set for ${ms}ms`);
  }

  /**
   * Test if a timer has expired
   * @param timerNum Timer slot (0-7)
   * @returns true if timer has expired
   */
  testTimer(timerNum: number): boolean {
    const timer = this.timers.get(timerNum);
    if (!timer) {
      return true; // Non-existent timer is considered expired
    }
    
    const expired = Date.now() >= timer.expiresAt;
    if (expired) {
      this.log(`Timer ${timerNum} expired`);
    }
    return expired;
  }

  /**
   * Clear a timer
   * @param timerNum Timer slot (0-7)
   */
  clearTimer(timerNum: number): void {
    this.timers.delete(timerNum);
  }

  /**
   * Clear all timers
   */
  clearAllTimers(): void {
    this.timers.clear();
  }

  // === Internal Methods ===

  /**
   * Schedule next tick with configured interval
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
   * Execute one tick of the screen loop
   * This is the core execution method called on each iteration
   */
  private async tick(): Promise<void> {
    if (!this.running || this.paused) {
      return;
    }

    try {
      switch (this.phase) {
        case 'init':
          await this.executeInitPhase();
          break;
          
        case 'line':
          await this.executeLinePhase();
          break;
          
        case 'idle':
          // In idle phase, just wait
          // This state is only reached when frequentFlag=false
          break;
      }
    } catch (error) {
      this.log(`Error in tick: ${error}`);
      // Continue execution despite errors (like original INPA)
    }
  }

  /**
   * Execute INIT phase
   */
  private async executeInitPhase(): Promise<void> {
    this.log('Executing INIT phase');
    
    // Execute alloc function if present
    if (this.screen.allocFunc) {
      await this.vm.executeBlock(this.screen.allocFunc);
    }
    
    // Execute init function if present
    if (this.screen.initFunc) {
      await this.vm.executeBlock(this.screen.initFunc);
    }
    
    // Transition to LINE phase
    this.setPhase('line');
    this.lineIndex = 0;
  }

  /**
   * Execute LINE phase (one line per tick)
   */
  private async executeLinePhase(): Promise<void> {
    const lines = this.screen.lines;
    
    if (lines.length === 0) {
      // No lines - go to idle or restart
      this.handleCycleComplete();
      return;
    }
    
    if (this.lineIndex >= lines.length) {
      // All lines executed - cycle complete
      this.handleCycleComplete();
      return;
    }
    
    // Execute current line
    const line = lines[this.lineIndex];
    this.log(`Executing LINE ${this.lineIndex} (${line.header.name})`);
    this.emit('line:start', this.lineIndex, line);
    
    // Execute line's function block
    if (line.func) {
      await this.vm.executeBlock(line.func);
    }
    
    // Execute control blocks within line
    for (const control of line.controls) {
      if (control.func) {
        await this.vm.executeBlock(control.func);
      }
    }
    
    this.emit('line:complete', this.lineIndex);
    this.lineIndex++;
  }

  /**
   * Handle completion of one LINE cycle
   */
  private handleCycleComplete(): void {
    this.log('Cycle complete');
    this.emit('cycle:complete');
    
    if (this.frequentFlag) {
      // Continuous mode - restart LINE phase
      this.lineIndex = 0;
      // Stay in 'line' phase
    } else {
      // One-shot mode - go to idle
      this.setPhase('idle');
    }
  }

  /**
   * Change execution phase
   */
  private setPhase(phase: ScreenPhase): void {
    const prevPhase = this.phase;
    this.phase = phase;
    
    if (prevPhase !== phase) {
      this.log(`Phase changed: ${prevPhase} → ${phase}`);
      this.emit('phase:changed', phase);
    }
  }

  /**
   * Debug logging
   */
  private log(message: string): void {
    if (this.debug) {
      console.log(`[ScreenExecutor] ${message}`);
    }
  }
}
