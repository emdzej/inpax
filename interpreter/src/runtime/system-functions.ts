import type { VM } from '../vm/interpreter.js';
import { StackEntry, ValueType } from '../types/index.js';
import { Stack } from '../vm/stack.js';

/**
 * System function handler signature
 */
export type SystemFunctionHandler = (vm: VM) => void;

/**
 * System function registry
 */
export class SystemFunctions {
  private vm: VM;
  private handlers: Map<number, SystemFunctionHandler> = new Map();

  constructor(vm: VM) {
    this.vm = vm;
    this.registerBuiltins();
  }

  /**
   * Register all built-in system functions
   */
  private registerBuiltins(): void {
    // UI Functions
    this.register(0x00, this.setmenutitle);
    this.register(0x01, this.setmenu);
    this.register(0x02, this.setitem);
    this.register(0x03, this.settitle);
    this.register(0x04, this.setscreen);
    
    // Timer Functions
    this.register(0x09, this.settimer);
    this.register(0x0a, this.testtimer);

    // Control Functions
    this.register(0x0c, this.exit);
    this.register(0x0d, this.exitwindows);

    // Utility Functions
    this.register(0x1b, this.delay);
    this.register(0x1c, this.getdate);
    this.register(0x1d, this.gettime);

    // String Functions
    this.register(0x23, this.strcat);
    this.register(0x24, this.strlen);
    this.register(0x25, this.midstr);

    // Conversion Functions
    this.register(0x1e, this.realtostring);
    this.register(0x1f, this.stringtoreal);
    this.register(0x20, this.inttostring);
    this.register(0x21, this.stringtoint);
  }

  /**
   * Register a system function handler
   */
  register(id: number, handler: SystemFunctionHandler): void {
    this.handlers.set(id, handler.bind(this));
  }

  /**
   * Call a system function by ID
   */
  call(id: number): void {
    const handler = this.handlers.get(id);
    if (!handler) {
      console.warn(`System function not implemented: 0x${id.toString(16)}`);
      return;
    }
    handler(this.vm);
  }

  // ============ Helper methods ============

  private popString(): string {
    const entry = this.vm.getStack().pop();
    return String(entry.value);
  }

  private popInt(): number {
    const entry = this.vm.getStack().pop();
    return Math.floor(Number(entry.value));
  }

  private popReal(): number {
    const entry = this.vm.getStack().pop();
    return Number(entry.value);
  }

  private popBool(): boolean {
    const entry = this.vm.getStack().pop();
    return Boolean(entry.value);
  }

  private popRef(): StackEntry {
    return this.vm.getStack().pop();
  }

  private pushString(value: string): void {
    this.vm.getStack().push(Stack.createEntry(ValueType.String, value));
  }

  private pushInt(value: number): void {
    this.vm.getStack().push(Stack.createEntry(ValueType.Int, value));
  }

  private pushBool(value: boolean): void {
    this.vm.getStack().push(Stack.createEntry(ValueType.Bool, value));
  }

  private setOutParam(ref: StackEntry, value: StackEntry): void {
    if (!ref.refInfo) {
      throw new Error('Expected reference for out parameter');
    }
    
    const { scope, index } = ref.refInfo;
    if (scope === 0x00) {
      this.vm.getGlobals()[index] = value;
    } else if (scope === 0x02) {
      this.vm.getStack().set(index, value);
    }
  }

  // ============ System function implementations ============

  // 0x00: setmenutitle(in: string title)
  private setmenutitle(vm: VM): void {
    const title = this.popString();
    console.log(`[setmenutitle] ${title}`);
    // TODO: Implement UI
  }

  // 0x01: setmenu(in: MENU handle)
  private setmenu(vm: VM): void {
    const handle = this.popInt();
    console.log(`[setmenu] handle=${handle}`);
    // TODO: Implement UI
  }

  // 0x02: setitem(in: int ItemNum, in: string ItemText, in: bool Enabled)
  private setitem(vm: VM): void {
    const enabled = this.popBool();
    const text = this.popString();
    const itemNum = this.popInt();
    console.log(`[setitem] ${itemNum}: "${text}" enabled=${enabled}`);
    // TODO: Implement UI
  }

  // 0x03: settitle(in: string title)
  private settitle(vm: VM): void {
    const title = this.popString();
    console.log(`[settitle] ${title}`);
    // TODO: Implement UI
  }

  // 0x04: setscreen(in: SCREEN handle, in: bool cyclic)
  private setscreen(vm: VM): void {
    const cyclic = this.popBool();
    const handle = this.popInt();
    console.log(`[setscreen] handle=${handle} cyclic=${cyclic}`);
    // TODO: Implement UI
  }

  // Timer state
  private timers: Map<number, { start: number; duration: number }> = new Map();

  // 0x09: settimer(in: int timernum, in: int timeval)
  private settimer(vm: VM): void {
    const timeval = this.popInt();
    const timernum = this.popInt();
    
    this.timers.set(timernum, {
      start: Date.now(),
      duration: timeval,
    });
    
    console.log(`[settimer] timer=${timernum} ms=${timeval}`);
  }

  // 0x0A: testtimer(in: int timernum, out: bool expiredflag)
  private testtimer(vm: VM): void {
    const outRef = this.popRef();
    const timernum = this.popInt();
    
    const timer = this.timers.get(timernum);
    let expired = false;
    
    if (timer) {
      const elapsed = Date.now() - timer.start;
      expired = elapsed >= timer.duration;
    }
    
    this.setOutParam(outRef, Stack.createEntry(ValueType.Bool, expired));
  }

  // 0x0C: exit()
  private exit(vm: VM): void {
    console.log('[exit]');
    vm.stop();
  }

  // 0x0D: exitwindows()
  private exitwindows(vm: VM): void {
    console.log('[exitwindows]');
    vm.stop();
  }

  // 0x1B: delay(in: int Time)
  private delay(vm: VM): void {
    const ms = this.popInt();
    console.log(`[delay] ${ms}ms`);
    // Note: This is synchronous - in real implementation would need async
    const start = Date.now();
    while (Date.now() - start < ms) {
      // Busy wait (not ideal, but simple)
    }
  }

  // 0x1C: getdate(out: string date)
  private getdate(vm: VM): void {
    const outRef = this.popRef();
    const now = new Date();
    const date = `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getFullYear()}`;
    this.setOutParam(outRef, Stack.createEntry(ValueType.String, date));
  }

  // 0x1D: gettime(out: string time)
  private gettime(vm: VM): void {
    const outRef = this.popRef();
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    this.setOutParam(outRef, Stack.createEntry(ValueType.String, time));
  }

  // 0x23: strcat(out: string dest, in: string left, in: string right)
  private strcat(vm: VM): void {
    const right = this.popString();
    const left = this.popString();
    const outRef = this.popRef();
    this.setOutParam(outRef, Stack.createEntry(ValueType.String, left + right));
  }

  // 0x24: strlen(out: int length, in: string str)
  private strlen(vm: VM): void {
    const str = this.popString();
    const outRef = this.popRef();
    this.setOutParam(outRef, Stack.createEntry(ValueType.Int, str.length));
  }

  // 0x25: midstr(out: string result, in: string str, in: int start, in: int length)
  private midstr(vm: VM): void {
    const length = this.popInt();
    const start = this.popInt();
    const str = this.popString();
    const outRef = this.popRef();
    this.setOutParam(outRef, Stack.createEntry(ValueType.String, str.substr(start, length)));
  }

  // 0x1E: realtostring(in: real value, in: string format, out: string result)
  private realtostring(vm: VM): void {
    const outRef = this.popRef();
    const format = this.popString();
    const value = this.popReal();
    
    // Simple formatting (format string ignored for now)
    const result = value.toString();
    this.setOutParam(outRef, Stack.createEntry(ValueType.String, result));
  }

  // 0x1F: stringtoreal(in: string value, out: real result)
  private stringtoreal(vm: VM): void {
    const outRef = this.popRef();
    const value = this.popString();
    this.setOutParam(outRef, Stack.createEntry(ValueType.Real, parseFloat(value)));
  }

  // 0x20: inttostring(in: int value, out: string result)
  private inttostring(vm: VM): void {
    const outRef = this.popRef();
    const value = this.popInt();
    this.setOutParam(outRef, Stack.createEntry(ValueType.String, value.toString()));
  }

  // 0x21: stringtoint(in: string value, out: int result)
  private stringtoint(vm: VM): void {
    const outRef = this.popRef();
    const value = this.popString();
    this.setOutParam(outRef, Stack.createEntry(ValueType.Int, parseInt(value, 10)));
  }
}
