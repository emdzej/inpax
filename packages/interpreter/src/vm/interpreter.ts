import {
    IpoFile,
    FunctionBlock,
    ScreenBlock,
    Instruction,
    StackEntry,
    ValueType,
    Opcode,
    AluOp,
    Scope,
    CallTarget,
    TypeMarker,
    Value,
} from '@inpax/core';
import type { IInpaRuntime } from '@inpax/interfaces';
import { SystemFunctionDispatcher } from '@inpax/dispatcher';
import { createNullRuntime } from '@inpax/providers';
import { Stack } from './stack.js';
import { InternalFunctions } from '../runtime/internal-functions.js';
import {
    collectArguments,
    writeOutParams,
    type CollectedArgs,
} from '../runtime/signature-handler.js';
import { ScreenExecutor, type ScreenExecutorConfig } from './screen-executor.js';
import { StateMachineExecutor, type StateMachineExecutorConfig } from './statemachine-executor.js';

/**
 * VM State
 */
export interface VMState {
    ip: number; // Instruction pointer
    currentBlock: FunctionBlock | null;
    condition: number; // Last comparison result
    running: boolean;
}

/**
 * VM Configuration
 */
export interface VMConfig {
    runtime?: IInpaRuntime;
    debug?: boolean;
    /** Screen executor configuration */
    screenExecutor?: ScreenExecutorConfig;
    /** State machine executor configuration */
    stateMachineExecutor?: StateMachineExecutorConfig;
}

/**
 * INPA Virtual Machine
 */
export class VM {
    private ipo: IpoFile;
    private stack: Stack;
    private globals: StackEntry[];
    private state: VMState;
    private runtime: IInpaRuntime;
    private dispatcher: SystemFunctionDispatcher;
    private internal: InternalFunctions;
    private debug: boolean;

    // Screen execution
    private screenExecutor: ScreenExecutor | null = null;
    private screenExecutorConfig: ScreenExecutorConfig;

    // State machine execution
    private stateMachineExecutor: StateMachineExecutor | null = null;
    private stateMachineExecutorConfig: StateMachineExecutorConfig;

    private config: VMConfig;

    constructor(ipo: IpoFile, config: VMConfig = {}) {
        this.ipo = ipo;
        this.stack = new Stack();
        this.globals = this.initGlobals();
        this.state = {
            ip: 0,
            currentBlock: null,
            condition: 0,
            running: false,
        };
        this.debug = config.debug ?? false;
        this.runtime = config.runtime ?? createNullRuntime();
        this.dispatcher = new SystemFunctionDispatcher(this.runtime);
        this.internal = new InternalFunctions(this);
        this.screenExecutorConfig = config.screenExecutor ?? {};
        this.stateMachineExecutorConfig = config.stateMachineExecutor ?? {};
        this.config = config;
        // Initialize state machine executor and register all state machines from IPO
        this.initStateMachineExecutor();
    }

    /**
     * Initialize global variables from IPO
     */
    private initGlobals(): StackEntry[] {
        return this.ipo.globals.types.map((type) => ({
            type,
            flags: 1,
            value: this.getDefaultValue(type),
        }));
    }

    /**
     * Get default value for type
     */
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

    /**
     * Run interpreter starting from __inpa_startup__
     */
    async run(): Promise<void> {
        // Start with __inpa_startup__ (function ID 0x00)
        const initFunc = this.ipo.functions.get(0x00);
        if (!initFunc) {
            throw new Error('__inpa_startup__ function not found');
        }

        this.callFunction(initFunc);
        await this.execute();
    }

    /**
     * Call a user function
     */
    callFunction(func: FunctionBlock): void {
        this.state.currentBlock = func;
        this.state.ip = 0;
    }

    /**
     * Main execution loop (async for provider calls)
     */
    private async execute(): Promise<void> {
        this.state.running = true;

        while (this.state.running && this.state.currentBlock) {
            const block = this.state.currentBlock;

            if (this.state.ip >= block.instructions.length) {
                // End of function - implicit return
                this.doReturn();
                continue;
            }

            const instr = block.instructions[this.state.ip];
            await this.executeInstruction(instr);
        }
    }

    /**
     * Execute single instruction
     */
    private async executeInstruction(instr: Instruction): Promise<void> {
        const { opcode, operand1, operand2 } = instr;

        if (this.debug) {
            console.log(`[VM] IP=${this.state.ip} OP=0x${opcode.toString(16)} op1=${operand1} op2=${operand2}`);
        }

        switch (opcode) {
            case Opcode.LOAD:
                this.opLoad(operand1, operand2);
                break;

            case Opcode.PUSHREF:
                this.opPushRef(operand1, operand2);
                break;

            case Opcode.LOADINOUTREF:
                this.opLoadInOutRef(operand1, operand2);
                break;

            case Opcode.NOP:
                // No operation
                break;

            case Opcode.MOVE:
                this.opMove(operand2);
                break;

            case Opcode.PUSHR:
                this.opPushR(operand1, operand2);
                break;

            case Opcode.PUSHREFSTORE:
                this.opPushRefStore(operand1, operand2);
                break;

            case Opcode.ALLOC:
                this.opAlloc(operand1);
                break;

            case Opcode.ALU:
                this.opAlu(operand1 as AluOp);
                break;

            case Opcode.JMP:
                this.opJmp(operand2);
                return; // Don't increment IP

            case Opcode.JMPNZ:
                if (this.opJmpNZ(operand2)) return;
                break;

            case Opcode.CALL:
                await this.opCall(operand1 as CallTarget, operand2);
                return; // IP handled by call

            case Opcode.CALLE:
                this.opCallE(operand2);
                break;

            case Opcode.RET:
                this.doReturn();
                return; // IP handled by return

            case Opcode.FRAME:
                this.opFrame();
                break;

            case Opcode.LOGTABLE:
                this.opLogTable(operand2);
                break;

            case Opcode.PUSHIMM:
                this.opPushImm(operand1, operand2);
                break;

            default:
                throw new Error(`Unknown opcode: 0x${opcode.toString(16)}`);
        }

        this.state.ip++;
    }

    // ============ Opcode implementations ============

    private opLoad(scope: Scope, index: number): void {
        const entry = this.resolveVariable(scope, index);
        this.stack.push({ ...entry, flags: 1 });
    }

    private opPushRef(scope: Scope, index: number): void {
        this.stack.push(Stack.createRef(scope, index));
    }

    private opLoadInOutRef(scope: Scope, index: number): void {
        this.opPushRef(scope, index);
    }

  private opMove(count: number): void {
    // MOVE: Assign value to reference
    // Stack: [..., target_ref, value] → [...]
    for (let i = 0; i < count; i++) {
        const ref = this.stack.pop();
        const value = this.stack.pop();
        if (ref.refInfo) {
            this.storeVariable(ref.refInfo.scope, ref.refInfo.index, value);
        }
        if (value.type === ValueType.Bool) {
            this.state.condition = value.value ? 1 : 0;
        }
    }
  }

  private storeVariable(scope: Scope, index: number, entry: StackEntry): void {
    switch (scope) {
      case Scope.Global:
        this.globals[index] = { ...entry };
        break;
      case Scope.Local:
        this.stack.setLocal(index, { ...entry });
        break;
      case Scope.Const:
        throw new Error('Cannot assign to constant');
      default:
        throw new Error(`Cannot store to scope: 0x${scope.toString(16)}`);
    }
  }

    private opPushR(scope: Scope, index: number): void {
        this.opPushRef(scope, index);
    }

    private opPushRefStore(scope: Scope, index: number): void {
        // PUSHREFSTORE: Push reference for storing value (used by out params)
        this.opPushRef(scope, index);
    }

    private opAlloc(typeMarker: number): void {
        let type: ValueType;
        let value: Value;

        switch (typeMarker) {
            case 0x50:
                type = ValueType.Bool;
                value = false;
                break;
            case 0x51:
                type = ValueType.Int;
                value = 0;
                break;
            case 0x52:
                type = ValueType.Byte;
                value = 0;
                break;
            case 0x53:
                type = ValueType.Long;
                value = 0;
                break;
            case 0x54:
                type = ValueType.Real;
                value = 0.0;
                break;
            case 0x55:
                type = ValueType.String;
                value = '';
                break;
            case 0x56:
                type = ValueType.Handle1;
                value = null;
                break;
            case 0x57:
                type = ValueType.Handle2;
                value = null;
                break;
            default:
                type = ValueType.Void;
                value = null;
        }

        this.stack.push({ type, flags: 1, value });
    }

    private opJmp(offset: number): void {
        this.state.ip = offset;
    }

    private opJmpNZ(offset: number): boolean {
        if (this.state.condition === 0) {
            this.state.ip = offset;
            return true;
        }
        return false;
    }

    private opAlu(op: AluOp): void {
        if (op === AluOp.NEG || op === AluOp.NOT) {
            const entry = this.stack.peek();
            if (op === AluOp.NEG) {
                entry.value = -(entry.value as number);
            } else {
                entry.value = !entry.value;
            }
            return;
        }

        const [lhs, rhs] = this.stack.getTwoOperands();
        let result: Value;

        switch (op) {
            case AluOp.ADD:
                if (lhs.type === ValueType.String) {
                    result = String(lhs.value) + String(rhs.value);
                } else {
                    result = (lhs.value as number) + (rhs.value as number);
                }
                break;
            case AluOp.SUB:
                result = (lhs.value as number) - (rhs.value as number);
                break;
            case AluOp.MUL:
                result = (lhs.value as number) * (rhs.value as number);
                break;
            case AluOp.DIV:
                if (rhs.value === 0) throw new Error('Division by zero');
                result = (lhs.value as number) / (rhs.value as number);
                break;
            case AluOp.LT:
                result = (lhs.value as number) < (rhs.value as number);
                this.state.condition = result ? 1 : 0;
                break;
            case AluOp.LE:
                result = (lhs.value as number) <= (rhs.value as number);
                this.state.condition = result ? 1 : 0;
                break;
            case AluOp.GT:
                result = (lhs.value as number) > (rhs.value as number);
                this.state.condition = result ? 1 : 0;
                break;
            case AluOp.GE:
                result = (lhs.value as number) >= (rhs.value as number);
                this.state.condition = result ? 1 : 0;
                break;
            case AluOp.EQ:
                result = lhs.value === rhs.value;
                this.state.condition = result ? 1 : 0;
                break;
            case AluOp.NE:
                result = lhs.value !== rhs.value;
                this.state.condition = result ? 1 : 0;
                break;
            case AluOp.AND:
                result = Boolean(lhs.value) && Boolean(rhs.value);
                break;
            case AluOp.OR:
                result = Boolean(lhs.value) || Boolean(rhs.value);
                break;
            case AluOp.BAND:
                result = (lhs.value as number) & (rhs.value as number);
                break;
            case AluOp.BOR:
                result = (lhs.value as number) | (rhs.value as number);
                break;
            case AluOp.BXOR:
                result = (lhs.value as number) ^ (rhs.value as number);
                break;
            default:
                throw new Error(`Unknown ALU op: 0x${(op as number).toString(16)}`);
        }
        this.stack.push({ type: lhs.type, flags: 1, value: result });
        //lhs.value = result;
        //this.stack.popN(1);
    }

    private async opCall(target: CallTarget, funcId: number): Promise<void> {
        this.state.ip++;

        if (target === CallTarget.UserFunction) {
            const func = this.ipo.functions.get(funcId);
            if (!func) throw new Error(`Function not found: ${funcId}`);

            // this.stack.pushReturnAddress(
            //     this.state.currentBlock!.header.blockId,
            //     this.state.ip
            // );
            this.callFunction(func);
        } else {
            // System function call
            await this.callSystemFunction(funcId);
            this.stack.popFrame();
        }
    }

    /**
     * Call system function - routes to internal or dispatcher
     */
    private async callSystemFunction(funcId: number): Promise<void> {
        // Check if internal (handled by interpreter)
        if (this.dispatcher.isInternal(funcId)) {
            this.internal.call(funcId);
            return;
        }

        // Collect arguments from stack based on signature
        const collected = collectArguments(funcId, this.stack);

        // Dispatch to provider with input args only
        const result = this.dispatcher.dispatch(funcId, collected.inputs);

        // Handle async result
        let returnValue: unknown;
        if (result instanceof Promise) {
            returnValue = await result;
        } else {
            returnValue = result;
        }

        // Write out params back to stack/globals
        this.writeOutParams(collected, returnValue);
    }

    /**
     * Write provider return values to out parameters
     */
    private writeOutParams(collected: CollectedArgs, returnValue: unknown): void {
        if (collected.outRefs.length === 0) return;

        // Convert return value to array of out values
        let outValues: unknown[];

        if (returnValue === undefined || returnValue === null) {
            outValues = [];
        } else if (Array.isArray(returnValue)) {
            // Provider returned tuple/array - use directly
            outValues = returnValue;
        } else {
            // Single return value - wrap in array
            outValues = [returnValue];
        }

        writeOutParams(
            collected.outRefs,
            collected.outParams,
            outValues,
            this.globals,
            this.stack
        );
    }

    private opCallE(index: number): void {
        throw new Error(`CALLE (external DLL call) not implemented: ${index}`);
    }

    private doReturn(): void {
        const ret = this.stack.popReturnAddress();

        if (ret.blockId === -1) {
            // Normal end of execution (from run())
            this.state.running = false;
            return;
        }

        if (ret.blockId === -2) {
            // Sentinel from executeBlock() - stop execution
            this.state.running = false;
            return;
        }

        const callerFunc = this.ipo.functions.get(ret.blockId);
        if (!callerFunc) {
            throw new Error(`Return to unknown function: ${ret.blockId}`);
        }

        this.state.currentBlock = callerFunc;
        this.state.ip = ret.ip;
        this.state.condition = 0;
        this.stack.popFrame();
    }

    private opFrame(): void {
        this.stack.pushFrame();
    }

    private opLogTable(index: number): void {
        console.warn(`LOGTABLE lookup at index ${index} - returning 0`);
        this.stack.push({ type: ValueType.Long, flags: 1, value: 0 });
    }

    private opPushImm(typeMarker: number, rawValue: number): void {
        let type: ValueType;
        let value: Value;

        switch (typeMarker) {
            case 0x50:
                type = ValueType.Bool;
                value = rawValue !== 0;
                break;
            case 0x51:
                type = ValueType.Int;
                value = rawValue > 0x7FFF ? rawValue - 0x10000 : rawValue;
                break;
            case 0x52:
                type = ValueType.Byte;
                value = rawValue & 0xFF;
                break;
            case 0x53:
                type = ValueType.Long;
                value = rawValue > 0x7FFF ? rawValue - 0x10000 : rawValue;
                break;
            default:
                type = ValueType.Int;
                value = rawValue;
        }

        this.stack.push({ type, flags: 1, value });
    }

    // ============ Helper methods ============

    private resolveVariable(scope: Scope, index: number): StackEntry {
        switch (scope) {
            case Scope.Global:
                return this.globals[index];
            case Scope.Const:
                return this.ipo.constants.values[index];
            case Scope.Local:
                return this.stack.getLocal(index);
            default:
                throw new Error(`UI handle scope not implemented: 0x${scope.toString(16)}`);
        }
    }

    // ============ Public API ============

    getStack(): Stack {
        return this.stack;
    }

    getGlobals(): StackEntry[] {
        return this.globals;
    }

    getConstants(): StackEntry[] {
        return this.ipo.constants.values;
    }

    getState(): VMState {
        return this.state;
    }

    getRuntime(): IInpaRuntime {
        return this.runtime;
    }

    stop(): void {
        this.state.running = false;
        if (this.screenExecutor) {
            this.screenExecutor.stop();
        }
        if (this.stateMachineExecutor) {
            this.stateMachineExecutor.stop();
        }
    }

    // ============ Screen Execution API ============

    /**
     * Execute a function block (used by ScreenExecutor)
     * Runs the block to completion and returns
     */
    async executeBlock(block: FunctionBlock): Promise<void> {
        const subVm = new VM(this.ipo, this.config);

        subVm.callFunction(block);
        await subVm.execute();
    }

    async setMenu(menuHandle: number): Promise<void> {
        const menu = this.ipo.menus.get(menuHandle);
        if (!menu) {
            throw new Error(`Menu not found: ${menuHandle}`);
        }
    }

    /**
     * Set and start a screen with the given frequent flag
     * @param screenId Screen block ID or handle
     * @param frequentFlag Whether to refresh continuously
     */
    async setScreen(screenId: number, frequentFlag: boolean): Promise<void> {
        // Stop existing screen executor
        if (this.screenExecutor) {
            this.screenExecutor.stop();
            this.screenExecutor = null;
        }

        // Find screen block
        const screen = this.ipo.screens.get(screenId);
        if (!screen) {
            throw new Error(`Screen not found: ${screenId}`);
        }

        // Create and start new executor
        this.screenExecutor = new ScreenExecutor(
            screen,
            frequentFlag,
            this,
            this.runtime,
            { ...this.screenExecutorConfig, debug: this.debug }
        );

        await this.screenExecutor.start();
    }

    /**
     * Get the current screen executor
     */
    getScreenExecutor(): ScreenExecutor | null {
        return this.screenExecutor;
    }

    /**
     * Set a timer (delegates to screen executor)
     */
    setTimer(timerNum: number, ms: number): void {
        if (!this.screenExecutor) {
            throw new Error('No active screen executor for timer');
        }
        this.screenExecutor.setTimer(timerNum, ms);
    }

    /**
     * Test if timer has expired (delegates to screen executor)
     */
    testTimer(timerNum: number): boolean {
        if (!this.screenExecutor) {
            return true; // No executor = timer expired
        }
        return this.screenExecutor.testTimer(timerNum);
    }

    // ============ State Machine Execution API ============

    /**
     * Initialize state machine executor and register all state machines from IPO
     */
    private initStateMachineExecutor(): void {
        this.stateMachineExecutor = new StateMachineExecutor(
            this,
            this.runtime,
            { ...this.stateMachineExecutorConfig, debug: this.debug }
        );

        // Register all state machines from IPO
        for (const sm of this.ipo.stateMachines.values()) {
            this.stateMachineExecutor.registerStateMachine(sm);
        }
    }

    /**
     * Start a state machine as the main background process
     * Equivalent to setstatemachine() in INPA
     */
    async setStateMachine(smName: string): Promise<void> {
        if (!this.stateMachineExecutor) {
            throw new Error('State machine executor not initialized');
        }
        await this.stateMachineExecutor.start(smName);
    }

    /**
     * Schedule transition to a new state
     * Called by setstate() system function
     */
    setState(stateName: string): void {
        if (!this.stateMachineExecutor) {
            throw new Error('State machine executor not initialized');
        }
        this.stateMachineExecutor.setState(stateName);
    }

    /**
     * Call a sub-state machine
     * Called by callstatemachine() system function
     */
    callStateMachine(smName: string): void {
        if (!this.stateMachineExecutor) {
            throw new Error('State machine executor not initialized');
        }
        this.stateMachineExecutor.callStateMachine(smName);
    }

    /**
     * Return from current state machine to caller
     * Called by returnstatemachine() system function
     */
    returnStateMachine(): void {
        if (!this.stateMachineExecutor) {
            throw new Error('State machine executor not initialized');
        }
        this.stateMachineExecutor.returnStateMachine();
    }

    /**
     * Get the state machine executor
     */
    getStateMachineExecutor(): StateMachineExecutor | null {
        return this.stateMachineExecutor;
    }

    /**
     * Execute one tick of the state machine
     * Called by the main scheduler
     */
    async tickStateMachine(): Promise<void> {
        if (this.stateMachineExecutor) {
            await this.stateMachineExecutor.tick();
        }
    }
}
