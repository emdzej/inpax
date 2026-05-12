import {
    IpoFile,
    FunctionBlock,
    Instruction,
    StackEntry,
    ValueType,
    Opcode,
    AluOp,
    Scope,
    CallTarget,
    StackEntryFlags,
    Value,
} from '@emdzej/inpax-core';
import type { IInpaRuntime, NativeImportParam } from '@emdzej/inpax-interfaces';
import { SystemFunctionDispatcher } from '@emdzej/inpax-dispatcher';
import { createNullRuntime } from '@emdzej/inpax-providers';
import { getLogger } from '@emdzej/inpax-logger';
import { Stack } from './stack.js';
import { ExecutionContext } from './execution-context.js';
import { InternalFunctions } from '../runtime/internal-functions.js';
import { ScreenExecutor, type ScreenExecutorConfig } from './screen-executor.js';
import { StateMachineExecutor, type StateMachineExecutorConfig } from './statemachine-executor.js';

const log = getLogger('vm');

interface ParsedNativeImport {
    importName: string;
    signature: string;
    params: NativeImportParam[];
}

// Type letters from INPA CALLE signatures. Lowercase = in, uppercase = out.
// Coverage matches what's seen in real BMW scripts (BMW INPA + the
// Rectification scripts); unknown letters fall through to `opaque`.
const TYPE_LETTER_TO_KIND: Record<string, NativeImportParam['type']> = {
    s: 'string', i: 'int', l: 'long', r: 'real', b: 'byte', c: 'bool',
};

/**
 * Parse an INPA CALLE import descriptor like
 * `kernel32::GetPrivateProfileStringA:c.sssSis%I`. Returns the import
 * name and an in-order list of typed params (the trailing `%X` is the
 * C return value, treated as a final out-arg). Returns null if the
 * descriptor doesn't have the expected `dll::func:sig` shape.
 */
function parseNativeImport(raw: string): ParsedNativeImport | null {
    if (!raw) return null;
    // Last `:` separates the name from the signature — names like
    // "kernel32::GetPrivateProfileStringA" contain `::` internally, so
    // splitting on every `:` would corrupt them.
    const sigStart = raw.lastIndexOf(':');
    if (sigStart < 0) return null;
    const importName = raw.slice(0, sigStart);
    const signature = raw.slice(sigStart + 1);

    // Expected shape: `<callConv>.<paramLetters>[%<retLetter>]`.
    const dotIdx = signature.indexOf('.');
    if (dotIdx < 0) return null;
    const paramSig = signature.slice(dotIdx + 1);
    if (!paramSig) return null;

    const params: NativeImportParam[] = [];
    let i = 0;
    while (i < paramSig.length) {
        const ch = paramSig[i];
        if (ch === '%') {
            // Return value — single letter follows.
            const retCh = paramSig[i + 1];
            if (!retCh) break;
            params.push({
                direction: 'out',
                type: TYPE_LETTER_TO_KIND[retCh.toLowerCase()] ?? 'opaque',
                isReturn: true,
            });
            i += 2;
            continue;
        }
        const direction = ch === ch.toUpperCase() && ch !== ch.toLowerCase() ? 'out' : 'in';
        params.push({
            direction,
            type: TYPE_LETTER_TO_KIND[ch.toLowerCase()] ?? 'opaque',
            isReturn: false,
        });
        i++;
    }

    return { importName, signature, params };
}

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

        const ctx = new ExecutionContext(this.globals, this.ipo.constants.values);
        await this.execute(initFunc, ctx);
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
    async execute(block: FunctionBlock, ctx: ExecutionContext): Promise<void> {
        this.callFunction(block);
        this.state.running = true;

        while (this.state.running && this.state.currentBlock) {
            const currentBlock = this.state.currentBlock;

            if (this.state.ip >= currentBlock.instructions.length) {
                // End of function - implicit return
                this.doReturn(ctx);
                continue;
            }

            const instr = currentBlock.instructions[this.state.ip];
            try {
                await this.executeInstruction(instr, ctx);
            } catch (err) {
                if (err instanceof Error) {
                    err.message = `${err.message} [in ${currentBlock.header.name}#${currentBlock.header.blockId} @pc=${this.state.ip} op=0x${instr.opcode.toString(16).padStart(2, '0')} op1=0x${instr.operand1.toString(16)} op2=0x${instr.operand2.toString(16)} frameOffset=${ctx.frameOffset} stackLen=${ctx.stack.size}]`;
                }
                throw err;
            }
        }
    }

    /**
     * Execute a function block with a fresh execution context — own
     * call stack, own value stack, own `state.currentBlock` / `state.ip`
     * — but sharing the supplied `globals` array (or this VM's own
     * if none is passed). Used by `executeBlock` to run a menu /
     * F-key handler without corrupting whatever the main VM is
     * doing on its own state, while still letting that handler read
     * and write the globals inpainit set up.
     */
    async executeIsolated(
        block: FunctionBlock,
        sharedGlobals?: StackEntry[]
    ): Promise<void> {
        const ctx = new ExecutionContext(
            sharedGlobals ?? this.globals,
            this.ipo.constants.values
        );
        await this.execute(block, ctx);
    }

    /**
     * Execute single instruction
     */
    private async executeInstruction(instr: Instruction, ctx: ExecutionContext): Promise<void> {
        const { opcode, operand1, operand2 } = instr;

        if (this.debug) {
            log.debug({ ip: this.state.ip, opcode: `0x${opcode.toString(16)}`, op1: operand1, op2: operand2 }, 'vm instruction');
        }

        switch (opcode) {
            case Opcode.LOAD:
                this.opLoad(operand1, operand2, ctx);
                break;

            case Opcode.PUSHREF:
                this.opPushRef(operand1, operand2, ctx);
                break;

            case Opcode.LOADINOUTREF:
                this.opLoadInOutRef(operand1, operand2, ctx);
                break;

            case Opcode.NOP:
                // No operation
                break;

            case Opcode.MOVE:
                this.opMove(operand2, ctx);
                break;

            case Opcode.PUSHR:
                this.opPushR(operand1, operand2, ctx);
                break;

            case Opcode.PUSHREFSTORE:
                this.opPushRefStore(operand1, operand2, ctx);
                break;

            case Opcode.ALLOC:
                this.opAlloc(operand1, ctx);
                break;

            case Opcode.ALU:
                this.opAlu(operand1 as AluOp, ctx);
                break;

            case Opcode.JMP:
                this.opJmp(operand2);
                return; // Don't increment IP

            case Opcode.JMPNZ:
                if (this.opJmpNZ(operand2)) return;
                break;

            case Opcode.CALL:
                await this.opCall(operand1 as CallTarget, operand2, ctx);
                return; // IP handled by call

            case Opcode.CALLE:
                this.opCallE(operand2, ctx);
                break;

            case Opcode.RET:
                this.doReturn(ctx);
                return; // IP handled by return

            case Opcode.FRAME:
                this.opFrame(ctx);
                break;

            case Opcode.LOGTABLE:
                this.opLogTable(operand2, ctx);
                break;

            case Opcode.PUSHIMM:
                this.opPushImm(operand1, operand2, ctx);
                break;

            default:
                throw new Error(`Unknown opcode: 0x${opcode.toString(16)}`);
        }

        this.state.ip++;
    }

    // ============ Opcode implementations ============

    private opLoad(scope: Scope, index: number, ctx: ExecutionContext): void {
        const entry = ctx.getVariable(scope, index);
        ctx.stack.push({ ...entry, flags: 1 });
    }

    private opPushRef(scope: Scope, index: number, ctx: ExecutionContext): void {
        ctx.stack.push(ctx.createRef(scope, index));
    }

    private opLoadInOutRef(scope: Scope, index: number, ctx: ExecutionContext): void {
        // LOADINOUTREF (0x03) implements the read side of `inout:` (and
        // by extension `out:` when the callee reads before writing).
        // The caller pushed a ref-descriptor with PUSHREF (0x02), which
        // ends up sitting in local[index] when the callee's frame is
        // established. To get an actual VALUE on the stack — what the
        // ALU then operates on — we must follow that descriptor once.
        //
        // The previous implementation deferred to `opPushRef`, which
        // creates a fresh ref pointing at local[index] itself. That
        // produces a ref-to-ref whose `.value` is `null`, so a bytecode
        // sequence emitted by INPACOMP for `n + 1` (see
        // disasm/mj-concat.txt:21 — `03 02 00 00 ; LOADINOUTREF`)
        // collapsed to `null + 1 = 1` and silently corrupted every
        // inout-arg arithmetic op.
        const slot = ctx.getVariable(scope, index);
        if (slot.refInfo) {
            const target = ctx.getVariable(
                slot.refInfo.scope as Scope,
                slot.refInfo.index
            );
            ctx.stack.push({ ...target, flags: 1 });
        } else {
            // Defensive: slot isn't actually a ref (caller forgot to
            // PUSHREF, or this opcode was emitted for a non-inout
            // local). Fall back to a plain by-value load.
            ctx.stack.push({ ...slot, flags: 1 });
        }
    }

    private opMove(count: number, ctx: ExecutionContext): void {
        // MOVE (FUN_004607d7 case 0x05): peek the top — if it's a bool
        // copy its value into the condition register — then pop exactly
        // `operand2` items from the stack. MOVE does NOT do any
        // assignment; assignment happens on the PUSHR / PUSHREFSTORE
        // side and the value lives on the stack until MOVE cleans it up.
        if (ctx.stack.size > 0) {
            const top = ctx.stack.peek();
            if (top.type === ValueType.Bool) {
                this.state.condition = top.value ? 1 : 0;
            }
        }
        for (let i = 0; i < count && ctx.stack.size > 0; i++) {
            ctx.stack.pop();
        }
    }

    private opPushR(scope: Scope, index: number, ctx: ExecutionContext): void {
        // PUSHR (FUN_0045f59c): store the current top-of-stack into the
        // target variable. Does NOT push a ref. Stack stays untouched —
        // the value remains on top so the subsequent MOVE can pop it.
        // This is the store side of every INPA assignment:
        //   LOAD value  →  push value
        //   PUSHR target → write value into target (stack unchanged)
        //   MOVE 1      → pop the value
        if (ctx.stack.size === 0) return;
        const top = ctx.stack.peek();
        ctx.setVariable(scope, index, top);
    }

    private opPushRefStore(scope: Scope, index: number, ctx: ExecutionContext): void {
        // PUSHREFSTORE (FUN_0045f6b3): the variable at (scope, index)
        // is itself a reference descriptor (passed in as an out-param).
        // Dereference it once and store top-of-stack into the actual
        // destination. Like PUSHR, does NOT push anything.
        if (ctx.stack.size === 0) return;
        const top = ctx.stack.peek();
        const refHolder = ctx.getVariable(scope, index);
        if (refHolder?.refInfo) {
            ctx.setVariable(
                refHolder.refInfo.scope as Scope,
                refHolder.refInfo.index,
                top
            );
        }
    }

    private opAlloc(typeMarker: number, ctx: ExecutionContext): void {
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

        ctx.stack.push({ type, flags: 1, value });
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

    private opAlu(op: AluOp, ctx: ExecutionContext): void {
        if (op === AluOp.NEG || op === AluOp.NOT) {
            const entry = ctx.stack.peek();
            if (op === AluOp.NEG) {
                entry.value = -(entry.value as number);
            } else {
                entry.value = !entry.value;
            }
            return;
        }

        const [lhs, rhs] = ctx.stack.getTwoOperands();
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
        // Comparisons + boolean ops produce a bool result; arithmetic
        // and bitwise ops preserve the lhs type. Tagging the result
        // type correctly is load-bearing for `MOVE` (which copies the
        // top value into the condition register only when it sees a
        // Bool on top) — without this, a `JMPNZ` after a string-vs-
        // string comparison sees a stale condition and either always
        // jumps or never jumps. That's exactly what hid the F2-F9
        // conditional ftextouts in startus.ipo's main screen.
        const isBoolResult =
            op === AluOp.LT ||
            op === AluOp.LE ||
            op === AluOp.GT ||
            op === AluOp.GE ||
            op === AluOp.EQ ||
            op === AluOp.NE ||
            op === AluOp.AND ||
            op === AluOp.OR;
        const resultType = isBoolResult ? ValueType.Bool : lhs.type;
        ctx.stack.push({ type: resultType, flags: 1, value: result });
    }

    private async opCall(target: CallTarget, funcId: number, ctx: ExecutionContext): Promise<void> {
        this.state.ip++;

        if (target === CallTarget.UserFunction) {
            const func = this.ipo.functions.get(funcId);
            if (!func) throw new Error(`Function not found: ${funcId}`);

            // Record where to resume in the caller, then transfer to the
            // callee. The frame marker pushed by the preceding FRAME
            // instruction holds markerPosition = where args start; that
            // becomes the callee's frameOffset so its local[0] reads the
            // first argument.
            //
            // Pin the caller as a FunctionBlock reference (not just an
            // ID): LINE / CONTROL / MENU-ITEM blocks share the integer
            // namespace with top-level functions, so an ID-only return
            // address would mis-route RET to whatever function happens
            // to live at the same numeric ID (`function 0` =
            // `__inpa_startup__` collides with every screen's `LINE 0`,
            // which produced an inpainit re-run loop when the screen
            // executor returned from a user CALL inside a line).
            const caller = this.state.currentBlock!;
            ctx.stack.pushReturnAddress(caller, this.state.ip);
            ctx.stack.setFrameOffset(ctx.stack.getTopFrameMarker());
            this.callFunction(func);
        } else {
            // System function call
            await this.callSystemFunction(funcId, ctx);
            ctx.popFrame();
        }
    }

    /**
     * Call system function - routes to internal or dispatcher
     */
    private async callSystemFunction(funcId: number, ctx: ExecutionContext): Promise<void> {
        // Check if internal (handled by interpreter)
        if (this.dispatcher.isInternal(funcId)) {
            this.internal.call(funcId, ctx);
            return;
        }

        await this.dispatcher.dispatch(funcId, ctx, this);
    }

    private opCallE(constIdx: number, ctx: ExecutionContext): void {
        // External DLL call (CALLE / opcode 0x0D). The constant at
        // constIdx is the import descriptor — name + signature, e.g.
        // "kernel32::GetPrivateProfileStringA:c.sssSis%I" or
        // "api32.DLL::__apiGetConfig:c.lsS%I".
        //
        // INPA.exe runs this via FUN_004607d7 case 0xd: push the
        // descriptor constant, optionally invoke a registered external
        // handler (PTR_FUN_0048d55c), then popFrame. We do the same,
        // but route the call through `runtime.nativeImports` when set.
        const rawSig = String(this.ipo.constants.values[constIdx]?.value ?? '');
        const parsed = parseNativeImport(rawSig);
        const provider = this.runtime?.nativeImports;

        if (!provider || !parsed) {
            if (parsed) {
                log.debug(
                    { importName: parsed.importName },
                    'CALLE: no native import provider, frame discarded'
                );
            } else {
                log.warn({ rawSig }, 'CALLE: could not parse import descriptor, frame discarded');
            }
            ctx.popFrame();
            return;
        }

        // The args (and out-arg refs and return slot) live on the stack
        // between the FRAME marker and the current top, in push order.
        const marker = ctx.stack.getTopFrameMarker();
        const slotCount = parsed.params.length;
        const slots: StackEntry[] = [];
        for (let i = 0; i < slotCount; i++) {
            slots.push(ctx.stack.get(marker + i));
        }

        // Gather inputs in declaration order — out-only slots become
        // undefined so the provider can index by position without doing
        // its own filtering.
        const inputs = parsed.params.map((p, i) =>
            p.direction === 'in' ? slots[i].value : undefined
        );

        let results: unknown[] = [];
        try {
            results = provider.call({
                importName: parsed.importName,
                signature: parsed.signature,
                params: parsed.params,
                inputs,
            });
        } catch (err) {
            log.error({ err, importName: parsed.importName }, 'CALLE handler threw');
        }

        // Write out-results back through the matching ref slots. Provider
        // returns an array in declaration order (undefined / skipped for
        // in slots); we route each non-undefined value through its slot's
        // refInfo.
        for (let i = 0; i < parsed.params.length && i < results.length; i++) {
            const p = parsed.params[i];
            if (p.direction !== 'out' && !p.isReturn) continue;
            const value = results[i];
            if (value === undefined) continue;
            const slot = slots[i];
            if (slot.refInfo) {
                ctx.setVariable(slot.refInfo.scope as Scope, slot.refInfo.index, {
                    type: slot.type,
                    flags: 1,
                    value: value as Value,
                });
            }
        }

        ctx.popFrame();
    }

    private doReturn(ctx: ExecutionContext): void {
        const ret = ctx.stack.popReturnAddress();

        // No caller pinned on the stack → top-level RET, stop the VM
        // loop. Covers both the natural end-of-`vm.run()` case and the
        // `executeBlock()` sentinel that the screen executor relies
        // on to bound a single block's execution.
        if (!ret.block) {
            this.state.running = false;
            return;
        }

        this.state.currentBlock = ret.block;
        this.state.ip = ret.ip;
        this.state.condition = 0;
        ctx.popFrame();
    }

    private opFrame(ctx: ExecutionContext): void {
        ctx.pushFrame();
    }

    private opLogTable(index: number, ctx: ExecutionContext): void {
        log.warn({ index }, 'LOGTABLE lookup returned 0');
        ctx.stack.push({ type: ValueType.Long, flags: 1, value: 0 });
    }

    private opPushImm(typeMarker: number, rawValue: number, ctx: ExecutionContext): void {
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

        ctx.stack.push({ type, flags: 1, value });
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

    createExecutionContext(): ExecutionContext {
        // Share the VM's globals — every executor (state machine,
        // screen, menu handlers) must see the writes `__inpa_startup__`
        // and `inpainit` made. Building a fresh `initGlobals()` here
        // would orphan the F-key bindings, the title, the SGBD/install
        // paths, etc. and the script's later phases would read zeros /
        // empty strings.
        return new ExecutionContext(this.globals, this.ipo.constants.values);
    }

    getState(): VMState {
        return this.state;
    }

    getRuntime(): IInpaRuntime {
        return this.runtime;
    }

    getIpo(): IpoFile {
        return this.ipo;
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
     * Execute a function block on this VM as if it were a fresh top
     * call — sharing `this.globals` (so the block sees inpainit's
     * writes), `this.runtime` (one set of providers, one cable),
     * and the same `state.currentBlock` / `state.ip`. Used by menu /
     * F-key handlers and by the host's "load a new program in place"
     * flow.
     *
     * Caller is responsible for ensuring nothing else is mid-flight
     * on this VM — typically by stopping the screen executor before
     * dispatching the handler. INPA itself is single-script: its
     * dispatcher pauses the OnIdle screen loop while a menu item
     * runs and lets the handler re-establish the screen via
     * `setscreen`. We mirror that.
     */
    async executeBlock(block: FunctionBlock): Promise<void> {
        await this.executeIsolated(block, this.globals);
    }

    /**
     * Execute a function block with a provided execution context
     * (used by StateMachineExecutor to preserve context across states).
     * The supplied context is assumed to already carry the right
     * globals.
     */
    async executeBlockWithContext(block: FunctionBlock, ctx: ExecutionContext): Promise<void> {
        await this.execute(block, ctx);
    }

    async setMenu(menuHandle: number): Promise<void> {
        const menu = this.ipo.menus.get(menuHandle);
        if (!menu) {
            throw new Error(`Menu not found: ${menuHandle}`);
        }
        // Two flavours of menu definition coexist:
        //   1. Static — every entry is a `MenuItemBlock` with the F-key
        //      slot in `header.flags` and the label in `header.arg1`.
        //      The INIT block typically only calls `setmenutitle`
        //      (e.g. MS430.IPO m_main).
        //   2. Dynamic — INIT calls `setitem(itemNum, text, enabled)`
        //      against script globals (e.g. startus.ipo m_main).
        // Many real menus mix the two: static labels for fixed entries
        // (Info / End / Exit), `setitem` for the localized slots.
        //
        // Order: clear the provider's menu state, then pre-register
        // static entries, then run INIT so `setitem` calls inside INIT
        // overwrite the statics as needed.
        //
        // CRITICAL: defer the bytecode execution past the current
        // microtask. `setMenu` is invoked from a `setmenu` system-call
        // inside an `await` chain, so `this.state.currentBlock` /
        // `this.state.ip` are still owned by the *caller's* execute()
        // loop. Running `this.execute(menu.func, …)` synchronously here
        // would overwrite those fields, and when the outer loop resumes
        // it would re-enter the menu's bytecode (or worse, a garbage
        // mix) instead of finishing `__inpa_startup__`. The setTimeout
        // hop puts everything on a fresh task — `vm.run()` is done
        // by then, `state` is idle, and the menu can have it.
        const ui = this.runtime.ui;
        const menuFunc = menu.func;
        const staticItems = menu.items;
        setTimeout(() => {
            ui.setMenu(menuHandle);
            for (const item of staticItems) {
                if (item.header.arg1) {
                    ui.setItem(item.header.flags, item.header.arg1, true);
                }
            }
            if (menuFunc) {
                this.execute(menuFunc, this.createExecutionContext())
                    .catch((err: unknown) => {
                        log.error({ err }, 'menu init block failed');
                    });
            }
        }, 0);
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
