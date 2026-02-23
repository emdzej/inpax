import { EventEmitter } from 'eventemitter3';
import type { StateMachineBlock, StateBlock } from '@emdzej/inpax-core';
import { BlockType } from '@emdzej/inpax-core';
import type { IInpaRuntime } from '@emdzej/inpax-interfaces';
import type { VM } from './interpreter.js';
import type { ExecutionContext } from './execution-context.js';

/**
 * State machine executor events
 */
export interface StateMachineExecutorEvents {
  'state:changed': (previousState: string, newState: string) => void;
  'statemachine:entered': (smName: string, fromSm?: string) => void;
  'statemachine:returned': (smName: string, toSm: string) => void;
  'cycle:complete': () => void;
  'stopped': () => void;
}

/**
 * State machine executor configuration
 */
export interface StateMachineExecutorConfig {
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Call stack entry for nested state machine calls
 */
interface CallStackEntry {
  stateMachine: StateMachineBlock;
  currentState: string;
  pendingState: string | null;
  context: ExecutionContext;
}

/**
 * State Machine Executor
 * 
 * Implements INPA state machine execution model:
 * - INIT state is mandatory and runs first
 * - States run to completion before switching
 * - setstate() schedules transition for next cycle
 * - callstatemachine()/returnstatemachine() for nesting
 * 
 * State machines run pseudo-parallel with screens:
 * - One state executes per tick
 * - Cooperative multitasking with ScreenExecutor
 */
export class StateMachineExecutor extends EventEmitter<StateMachineExecutorEvents> {
  private vm: VM;
  private runtime: IInpaRuntime;
  
  // State machine registry (loaded from IPO)
  private stateMachines: Map<string, StateMachineBlock> = new Map();
  
  // Call stack for nested state machines
  private callStack: CallStackEntry[] = [];
  
  // Execution state
  private running: boolean = false;
  private paused: boolean = false;
  
  // Pending transitions (set by setstate/callstatemachine/returnstatemachine)
  private pendingState: string | null = null;
  private pendingCall: StateMachineBlock | null = null;
  private pendingReturn: boolean = false;
  
  // Configuration
  private debug: boolean;

  constructor(
    vm: VM,
    runtime: IInpaRuntime,
    config: StateMachineExecutorConfig = {}
  ) {
    super();
    this.vm = vm;
    this.runtime = runtime;
    this.debug = config.debug ?? false;
  }

  /**
   * Register a state machine for later activation
   */
  registerStateMachine(sm: StateMachineBlock): void {
    this.stateMachines.set(sm.header.name, sm);
    this.log(`Registered state machine: ${sm.header.name}`);
  }

  /**
   * Register multiple state machines
   */
  registerStateMachines(sms: StateMachineBlock[]): void {
    for (const sm of sms) {
      this.registerStateMachine(sm);
    }
  }

  /**
   * Start a state machine as the main background process
   * Equivalent to setstatemachine() in INPA
   */
  async start(smName: string): Promise<void> {
    const sm = this.stateMachines.get(smName);
    if (!sm) {
      throw new Error(`State machine not found: ${smName}`);
    }

    // Clear any existing state
    this.callStack = [];
    this.pendingState = null;
    this.pendingCall = null;
    this.pendingReturn = false;

    // Push initial state machine onto stack
    this.callStack.push({
      stateMachine: sm,
      currentState: 'INIT',
      pendingState: null,
      context: this.vm.createExecutionContext(),
    });

    this.running = true;
    this.paused = false;
    
    this.log(`Started state machine: ${smName}`);
    this.emit('statemachine:entered', smName);
  }

  /**
   * Stop execution
   */
  stop(): void {
    this.running = false;
    this.paused = false;
    this.callStack = [];
    this.log('State machine execution stopped');
    this.emit('stopped');
  }

  /**
   * Pause execution
   */
  pause(): void {
    this.paused = true;
    this.log('State machine execution paused');
  }

  /**
   * Resume execution
   */
  resume(): void {
    if (this.paused && this.running) {
      this.paused = false;
      this.log('State machine execution resumed');
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
   * Get current state machine name
   */
  getCurrentStateMachine(): string | null {
    const current = this.callStack[this.callStack.length - 1];
    return current?.stateMachine.header.name ?? null;
  }

  /**
   * Get current state name
   */
  getCurrentState(): string | null {
    const current = this.callStack[this.callStack.length - 1];
    return current?.currentState ?? null;
  }

  /**
   * Get call stack depth
   */
  getCallDepth(): number {
    return this.callStack.length;
  }

  // === State Machine Control API (called from system functions) ===

  /**
   * Schedule transition to a new state
   * Called by setstate() system function
   */
  setState(stateName: string): void {
    if (this.callStack.length === 0) {
      throw new Error('No active state machine for setstate()');
    }
    this.pendingState = stateName;
    this.log(`setstate(${stateName}) - scheduled for next cycle`);
  }

  /**
   * Call a sub-state machine
   * Called by callstatemachine() system function
   */
  callStateMachine(smName: string): void {
    const sm = this.stateMachines.get(smName);
    if (!sm) {
      throw new Error(`State machine not found: ${smName}`);
    }
    this.pendingCall = sm;
    this.log(`callstatemachine(${smName}) - scheduled for next cycle`);
  }

  /**
   * Return from current state machine to caller
   * Called by returnstatemachine() system function
   */
  returnStateMachine(): void {
    if (this.callStack.length <= 1) {
      // No caller - stop execution
      this.log('returnstatemachine() with no caller - stopping');
      this.stop();
      return;
    }
    this.pendingReturn = true;
    this.log('returnstatemachine() - scheduled for next cycle');
  }

  // === Execution ===

  /**
   * Execute one tick (one state execution)
   * Called by the main scheduler
   */
  async tick(): Promise<void> {
    if (!this.running || this.paused || this.callStack.length === 0) {
      return;
    }

    // Process pending operations from previous cycle
    await this.processPendingOperations();

    if (this.callStack.length === 0) {
      return; // Stack cleared by return
    }

    // Execute current state
    const current = this.callStack[this.callStack.length - 1];
    const state = this.findState(current.stateMachine, current.currentState);

    if (!state) {
      throw new Error(
        `State '${current.currentState}' not found in state machine '${current.stateMachine.header.name}'`
      );
    }

    this.log(`Executing state: ${current.stateMachine.header.name}.${current.currentState}`);

    // Execute state's function block
    if (state.func) {
      await this.vm.executeBlockWithContext(state.func, current.context);
    }

    this.emit('cycle:complete');
  }

  // === Internal Methods ===

  /**
   * Process pending state transitions and calls
   */
  private async processPendingOperations(): Promise<void> {
    // Handle return first (highest priority)
    if (this.pendingReturn) {
      this.pendingReturn = false;
      await this.doReturn();
      return;
    }

    // Handle call
    if (this.pendingCall) {
      const sm = this.pendingCall;
      this.pendingCall = null;
      await this.doCall(sm);
      return;
    }

    // Handle state transition
    if (this.pendingState) {
      const newState = this.pendingState;
      this.pendingState = null;
      this.doSetState(newState);
    }
  }

  /**
   * Execute state transition
   */
  private doSetState(newState: string): void {
    const current = this.callStack[this.callStack.length - 1];
    const prevState = current.currentState;
    
    // Validate state exists
    const state = this.findState(current.stateMachine, newState);
    if (!state) {
      throw new Error(
        `State '${newState}' not found in state machine '${current.stateMachine.header.name}'`
      );
    }

    current.currentState = newState;
    this.log(`State transition: ${prevState} → ${newState}`);
    this.emit('state:changed', prevState, newState);
  }

  /**
   * Execute call to sub-state machine
   */
  private async doCall(sm: StateMachineBlock): Promise<void> {
    const callerName = this.getCurrentStateMachine();
    
    this.callStack.push({
      stateMachine: sm,
      currentState: 'INIT',
      pendingState: null,
      context: this.vm.createExecutionContext(),
    });

    this.log(`Entered state machine: ${sm.header.name} (from ${callerName})`);
    this.emit('statemachine:entered', sm.header.name, callerName ?? undefined);
  }

  /**
   * Execute return from sub-state machine
   */
  private async doReturn(): Promise<void> {
    if (this.callStack.length === 0) {
      return;
    }

    const returning = this.callStack.pop()!;
    const returningTo = this.callStack[this.callStack.length - 1];

    if (returningTo) {
      this.log(
        `Returned from ${returning.stateMachine.header.name} to ${returningTo.stateMachine.header.name}`
      );
      this.emit(
        'statemachine:returned',
        returning.stateMachine.header.name,
        returningTo.stateMachine.header.name
      );
    } else {
      // No more state machines - stop
      this.log(`Returned from ${returning.stateMachine.header.name} - stack empty, stopping`);
      this.running = false;
      this.emit('stopped');
    }
  }

  /**
   * Find a state by name in a state machine
   */
  private findState(sm: StateMachineBlock, stateName: string): StateBlock | undefined {
    // INIT is a special state - check for initFunc
    if (stateName === 'INIT') {
      // Return a synthetic StateBlock for INIT using main function
      if (sm.func) {
        return {
          header: {
            type: BlockType.StateFunc,
            name: 'INIT',
            blockId: -1,
            flags: 0,
            arg1: '',
            arg2: '',
            marker: 0,
            size: 0,
          },
          func: sm.func,
        };
      }
    }

    return sm.states.find(s => s.header.name === stateName);
  }

  /**
   * Debug logging
   */
  private log(message: string): void {
    if (this.debug) {
      console.log(`[StateMachineExecutor] ${message}`);
    }
  }
}
