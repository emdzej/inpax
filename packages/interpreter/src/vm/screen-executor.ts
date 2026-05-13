import { EventEmitter } from 'eventemitter3';
import { getLogger } from '@emdzej/inpax-logger';
import type { ScreenBlock, LineBlock, FunctionBlock, Value } from '@emdzej/inpax-core';
import { ValueType } from '@emdzej/inpax-core';
import type { IInpaRuntime } from '@emdzej/inpax-interfaces';
import type { VM } from './interpreter.js';
import { ExecutionContext } from './execution-context.js';

const log = getLogger('screen-executor');

/**
 * Vertical stride between SCREEN LINE blocks, in screen rows. LINE N
 * starts at row `N * LINE_HEIGHT` and its bytecode addresses cells
 * inside that block via small relative `row` values (typically 1 for
 * the label and 3 for the indicator). The provider applies the
 * stride as a base offset; see `IUIProvider.setLineBaseRow`.
 *
 * 4 matches the canonical INPA layout (label / spacer / value /
 * spacer between consecutive LINE blocks). Some scripts may use
 * different strides — make this configurable per-screen if real
 * scripts turn out to need it.
 */
const LINE_HEIGHT = 4;

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
  private executionContext: ExecutionContext | null = null;

  // Execution state
  private phase: ScreenPhase = 'init';
  private lineIndex: number = 0;
  private running: boolean = false;
  private paused: boolean = false;
  /**
   * Snapshot of `ui.state.firstVisibleLine` at the start of the
   * current LINE-phase pass. We freeze it so user scrolling mid-cycle
   * doesn't cause one LINE to paint with one offset and the next with
   * another — the cycle stays internally consistent and the new
   * window only takes effect on the next pass. See
   * `docs/research/screen-line-pagination.md`.
   */
  private cycleFirstVisibleLine = 0;
  /** Previous pass's snapshot, kept so the next pass can detect a
   *  scroll and wipe the LINE content area exactly once (to drop any
   *  stale slots from the old page). */
  private prevFirstVisibleLine = 0;

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
    this.cycleFirstVisibleLine = 0;
    this.prevFirstVisibleLine = 0;
    this.executionContext = this.createExecutionContext();

    this.log(`Starting screen execution (frequent=${this.frequentFlag})`);

    // Notify UI
    this.runtime.ui.setScreen(this.screen.header.blockId, this.frequentFlag);
    // Pagination: report how many LINE blocks this screen has so the
    // host can decide whether to show scroll affordances. INPA itself
    // paginates when LINE blocks overflow the viewport — see
    // `docs/research/screen-line-pagination.md`. `firstVisibleLine`
    // is reset by `setScreen` above; `visibleLineCount` is owned by
    // the host (it knows its own viewport) — `0` from the host means
    // "no fixed viewport" and the executor below runs every block.
    this.runtime.ui.setTotalLines(this.screen.lines.length);

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

  private createExecutionContext(): ExecutionContext {
    // Reuse the VM's globals array — `__inpa_startup__` / `inpainit`
    // wrote into it during `vm.run()`, and the script's screen / line
    // / menu blocks need to *see* those writes (F-key bindings,
    // configured title, the SGBD/install paths the user picked, …).
    //
    // The old behaviour here built a fresh defaults-only globals array
    // every time the screen executor (re)started, which silently
    // discarded all of `inpainit`'s setup. F2-F9 ftextouts skipped
    // themselves because the bindings looked empty, the menu bar
    // showed no items, etc.
    return new ExecutionContext(this.vm.getGlobals(), this.vm.getConstants());
  }

  private getDefaultValue(type: ValueType): Value {
    switch (type) {
      case ValueType.Bool:
        return false;
      case ValueType.Byte:
      case ValueType.Int:
      case ValueType.Long:
      case ValueType.Handle1:
      case ValueType.Handle2:
      case ValueType.Handle3:
        return 0;
      case ValueType.Real:
        return 0.0;
      case ValueType.String:
        return '';
      default:
        return null;
    }
  }

  private async executeBlock(block: FunctionBlock): Promise<void> {
    if (!this.executionContext) {
      this.executionContext = this.createExecutionContext();
    }

    await this.vm.execute(block, this.executionContext);
  }

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
   *
   * INPA semantics split the screen-start work into two pieces:
   *
   *   - ALLOC: one-time setup (variable allocation, constants).
   *     Runs once when the screen is first mounted.
   *   - INIT:  per-cycle setup. Typically calls `INPAapiJob` to
   *     refetch the ECU data the LINE blocks then render. Must
   *     re-run every cycle on cyclic (`frequentFlag=true`) screens,
   *     otherwise LINE blocks display the same stale values forever.
   *
   * `allocDone` is the only state that distinguishes a first-mount
   * INIT from a cycle-restart INIT — we keep the buffer-clear on the
   * first pass so the screen starts clean, but skip it on subsequent
   * passes so the previous cycle's content doesn't flash blank.
   */
  private allocDone = false;

  private async executeInitPhase(): Promise<void> {
    this.log(`Executing INIT phase (allocDone=${this.allocDone})`);

    const ui = this.vm.getRuntime().ui;

    if (!this.allocDone) {
      // First mount — clear the buffer (any leftover state from a
      // previous screen) and run ALLOC.
      ui.blankScreen();
      if (this.screen.allocFunc) {
        await this.executeBlock(this.screen.allocFunc);
      }
      this.allocDone = true;
    }

    // INIT paints absolute coords (screen title at row 1, etc.) so
    // the LINE-base-row offset must be 0 here. Reset before running
    // INIT — both on first pass and every cycle restart.
    ui.setLineBaseRow(0);
    if (this.screen.initFunc) {
      await this.executeBlock(this.screen.initFunc);
    }

    // Transition to LINE phase
    this.setPhase('line');
    this.lineIndex = 0;
    // Snapshot the pagination window for the upcoming LINE pass.
    // Reading `getFirstVisibleLine()` here — once — keeps the cycle
    // self-consistent if the user scrolls between LINE ticks.
    this.cycleFirstVisibleLine = ui.getFirstVisibleLine();
    // If the user scrolled since the previous pass, wipe the LINE
    // content area. Otherwise stale slots from the old page bleed
    // through when the new page has fewer visible blocks than the
    // viewport (e.g. last page when `totalLines % visibleCount != 0`).
    // We don't blank between *cycles* because that'd flash; we only
    // blank on a real scroll, which the user just deliberately did.
    const visibleCount = ui.getVisibleLineCount();
    if (
      visibleCount > 0 &&
      this.cycleFirstVisibleLine !== this.prevFirstVisibleLine
    ) {
      ui.setLineBaseRow(0);
      ui.clearRect(LINE_HEIGHT, 0, 80, visibleCount * LINE_HEIGHT);
      this.prevFirstVisibleLine = this.cycleFirstVisibleLine;
    }
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

    // Pagination: skip LINE blocks outside the visible window. INPA
    // does this so screens with more LINE blocks than fit on the
    // viewport stay legible — the user steps through with arrow keys
    // and only the on-screen 5±1 blocks paint. The INIT phase already
    // ran the per-cycle EDIABAS job, so the shared result set is in
    // memory; skipping a LINE block just skips the (cheap) string
    // pull + paint, not the data fetch. See
    // `docs/research/screen-line-pagination.md`.
    const ui = this.vm.getRuntime().ui;
    const visibleCount = ui.getVisibleLineCount();
    const firstVisible = this.cycleFirstVisibleLine;
    // `visibleCount === 0` = host has no fixed viewport (CLI, headless
    // tests) → no pagination, run every block.
    const inView =
      visibleCount === 0 ||
      (this.lineIndex >= firstVisible &&
        this.lineIndex < firstVisible + visibleCount);

    if (inView) {
      // Stack the visible LINE blocks vertically starting at row
      // LINE_HEIGHT — each LINE writes inside its own coordinate
      // space (label at relative row 1, LED/value at relative row
      // 3, …) so all LINE 0..N use the same row numbers in their
      // bytecode. The provider adds `lineBaseRow` to incoming rows.
      //
      // We bump the first visible LINE down by one full stride so
      // rows 0..3 stay free for whatever the INIT block painted
      // there — typically the screen title via a `fontSize > 0`
      // `ftextout` that takes ~2 cell rows visually.
      const slot = this.lineIndex - firstVisible; // 0..visibleCount-1
      ui.setLineBaseRow((slot + 1) * LINE_HEIGHT);

      // Execute line's function block
      if (line.func) {
        await this.executeBlock(line.func);
      }

      // Execute control blocks within line
      for (const control of line.controls) {
        if (control.func) {
          await this.executeBlock(control.func);
        }
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
      // Continuous mode — restart at INIT so the script's per-cycle
      // EDIABAS job re-fires and LINE blocks render fresh values.
      // ALLOC stays skipped via the `allocDone` flag in
      // executeInitPhase, and the buffer isn't re-blanked so the
      // previous cycle's output stays visible until LINEs overwrite
      // it (no inter-cycle flash).
      this.lineIndex = 0;
      this.setPhase('init');
    } else {
      // One-shot mode — done, idle.
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
      log.debug({ message }, 'screen executor');
    }
  }
}
