/**
 * Internal Functions - handled by interpreter, not providers
 * Includes: timer, state machine, control flow, conversions, string ops, file I/O
 */

import type { VM } from '../vm/interpreter.js';
import type { ExecutionContext } from '../vm/execution-context.js';
import { StackEntry, SystemFunction, ValueType, Scope } from '@emdzej/inpax-core';
import { Stack } from '../vm/stack.js';

type InternalHandler = (ctx: ExecutionContext) => void;

export class InternalFunctions {
  private vm: VM;
  private handlers: Map<number, InternalHandler> = new Map();
  private timers: Map<number, { start: number; duration: number }> = new Map();
  private fileHandle: { path: string; mode: string; lines: string[] } | null = null;
  private fileLineIndex = 0;

  constructor(vm: VM) {
    this.vm = vm;
    this.registerHandlers();
  }

  private registerHandlers(): void {
    // Timer
    this.handlers.set(SystemFunction.settimer, (ctx) => this.settimer(ctx));
    this.handlers.set(SystemFunction.testtimer, (ctx) => this.testtimer(ctx));

    // Control
    this.handlers.set(SystemFunction.exit, () => this.exit());
    this.handlers.set(SystemFunction.exitwindows, () => this.exit());
    this.handlers.set(SystemFunction.delay, (ctx) => this.delay(ctx));

    // Time
    this.handlers.set(SystemFunction.getdate, (ctx) => this.getdate(ctx));
    this.handlers.set(SystemFunction.gettime, (ctx) => this.gettime(ctx));

    // String
    this.handlers.set(SystemFunction.strcat, (ctx) => this.strcat(ctx));
    this.handlers.set(SystemFunction.strlen, (ctx) => this.strlen(ctx));
    this.handlers.set(SystemFunction.midstr, (ctx) => this.midstr(ctx));

    // Conversion
    this.handlers.set(SystemFunction.realtostring, (ctx) => this.realtostring(ctx));
    this.handlers.set(SystemFunction.stringtoreal, (ctx) => this.stringtoreal(ctx));
    this.handlers.set(SystemFunction.inttostring, (ctx) => this.inttostring(ctx));
    this.handlers.set(SystemFunction.stringtoint, (ctx) => this.stringtoint(ctx));
    this.handlers.set(SystemFunction.hexconvert, (ctx) => this.hexconvert(ctx));
    this.handlers.set(SystemFunction.realtoint, (ctx) => this.realtoint(ctx));
    this.handlers.set(SystemFunction.inttoreal, (ctx) => this.inttoreal(ctx));
    this.handlers.set(SystemFunction.bytetoint, (ctx) => this.bytetoint(ctx));
    this.handlers.set(SystemFunction.inttolong, (ctx) => this.inttolong(ctx));
    this.handlers.set(SystemFunction.longtoreal, (ctx) => this.longtoreal(ctx));

    // File I/O
    this.handlers.set(SystemFunction.fileopen, (ctx) => this.fileopen(ctx));
    this.handlers.set(SystemFunction.fileclose, () => this.fileclose());
    this.handlers.set(SystemFunction.filewrite, (ctx) => this.filewrite(ctx));
    this.handlers.set(SystemFunction.fileread, (ctx) => this.fileread(ctx));

    // Binary
    this.handlers.set(SystemFunction.GetBinaryDataString, (ctx) => this.getBinaryDataString(ctx));

    // Menu
    this.handlers.set(SystemFunction.setmenu, (ctx) => this.setmenu(ctx));
    // Screen
    this.handlers.set(SystemFunction.setscreen, (ctx) => this.setscreen(ctx));

    // State Machine
    this.handlers.set(SystemFunction.setstatemachine, (ctx) => this.setstatemachine(ctx));
    this.handlers.set(SystemFunction.setstate, (ctx) => this.setstate(ctx));
    this.handlers.set(SystemFunction.callstatemachine, (ctx) => this.callstatemachine(ctx));
    this.handlers.set(SystemFunction.returnstatemachine, () => this.returnstatemachine());

    // Job Control (stubs)
    this.handlers.set(SystemFunction.setjobstatus, () => this.stub('setjobstatus'));
    this.handlers.set(SystemFunction.scriptselect, () => this.stub('scriptselect'));
    this.handlers.set(SystemFunction.scriptchange, () => this.stub('scriptchange'));
    this.handlers.set(SystemFunction.select, () => this.stub('select'));
    this.handlers.set(SystemFunction.deselect, () => this.stub('deselect'));
    this.handlers.set(SystemFunction.control, () => this.stub('control'));
    this.handlers.set(SystemFunction.start, () => this.stub('start'));
    this.handlers.set(SystemFunction.stop, () => this.stub('stop'));
    this.handlers.set(SystemFunction.getapistring, () => this.stub('getapistring'));
    this.handlers.set(SystemFunction.togglelist, () => this.stub('togglelist'));

    // String Arrays (stubs)
    this.handlers.set(SystemFunction.StrArrayCreate, () => this.stub('StrArrayCreate'));
    this.handlers.set(SystemFunction.StrArrayDestroy, () => this.stub('StrArrayDestroy'));
    this.handlers.set(SystemFunction.StrArrayWrite, () => this.stub('StrArrayWrite'));
    this.handlers.set(SystemFunction.StrArrayRead, () => this.stub('StrArrayRead'));
    this.handlers.set(SystemFunction.StrArrayGetElementCount, () => this.stub('StrArrayGetElementCount'));
    this.handlers.set(SystemFunction.StrArrayDelete, () => this.stub('StrArrayDelete'));

    // Structures (stubs)
    this.handlers.set(SystemFunction.CreateStructure, () => this.stub('CreateStructure'));
    this.handlers.set(SystemFunction.SetStructureMode, () => this.stub('SetStructureMode'));
    this.handlers.set(SystemFunction.StructureByte, () => this.stub('StructureByte'));
    this.handlers.set(SystemFunction.StructureInt, () => this.stub('StructureInt'));
    this.handlers.set(SystemFunction.StructureLong, () => this.stub('StructureLong'));
    this.handlers.set(SystemFunction.StructureString, () => this.stub('StructureString'));
  }

  call(funcId: number, ctx: ExecutionContext): void {
    const handler = this.handlers.get(funcId);
    if (!handler) {
      console.warn(`Internal function not implemented: 0x${funcId.toString(16)}`);
      return;
    }
    handler(ctx);
  }

  // ============ Helpers ============

  private popString(ctx: ExecutionContext): string {
    return String(ctx.stack.pop().value);
  }

  private popInt(ctx: ExecutionContext): number {
    return Math.floor(Number(ctx.stack.pop().value));
  }

  private popReal(ctx: ExecutionContext): number {
    return Number(ctx.stack.pop().value);
  }

  private popRef(ctx: ExecutionContext): StackEntry {
    return ctx.stack.pop();
  }

  private setOutParam(ctx: ExecutionContext, ref: StackEntry, value: StackEntry): void {
    if (!ref.refInfo) throw new Error('Expected reference for out parameter');
    const { scope, index } = ref.refInfo;
    ctx.setVariable(scope as Scope, index, value);
  }

  private stub(name: string): void {
    console.warn(`[STUB] ${name} - not implemented`);
  }

  // ============ Timer ============

  private settimer(ctx: ExecutionContext): void {
    const timeval = this.popInt(ctx);
    const timernum = this.popInt(ctx);

    const executor = this.vm.getScreenExecutor();
    if (executor) {
      executor.setTimer(timernum, timeval);
    } else {
      this.timers.set(timernum, { start: Date.now(), duration: timeval });
    }
  }

  private testtimer(ctx: ExecutionContext): void {
    const outRef = this.popRef(ctx);
    const timernum = this.popInt(ctx);

    const executor = this.vm.getScreenExecutor();
    let expired: boolean;

    if (executor) {
      expired = executor.testTimer(timernum);
    } else {
      const timer = this.timers.get(timernum);
      expired = timer ? (Date.now() - timer.start >= timer.duration) : true;
    }

    this.setOutParam(ctx, outRef, Stack.createEntry(ValueType.Bool, expired));
  }

  // ============ Menu ==============

  private setmenu(ctx: ExecutionContext): void {
    const menuHandle = this.popInt(ctx);
    this.vm.setMenu(menuHandle).catch(err => {
      console.error(`[setmenu] Error activating menu: ${err}`);
    });
  }

  // ============ Screen ============

  private setscreen(ctx: ExecutionContext): void {
    const cyclic = this.popInt(ctx) !== 0;
    const handle = this.popRef(ctx);
    const screenId = handle.refInfo?.index;
    if (screenId === undefined) {
      console.warn('[setscreen] Invalid screen reference');
      return;
    }
    const screenName = this.findScreenByHandle(screenId);
    if (!screenName) {
      console.warn(`[setscreen] Screen not found for handle: ${screenId}`);
      return;
    }

    this.vm.setScreen(screenId, cyclic).catch(err => {
      console.error(`[setscreen] Error activating screen: ${err}`);
    });

    this.vm.getRuntime().ui.setScreen(screenId, cyclic);
  }

  private findScreenByHandle(handle: number): string | null {
    const ipo = this.vm.getIpo();
    if (!ipo?.screens) return null;

    const screen = ipo.screens.get(handle);
    return screen?.header?.name ?? null;
  }

  // ============ State Machine ============

  private setstatemachine(ctx: ExecutionContext): void {
    const handle = this.popInt(ctx);
    const smExecutor = this.vm.getStateMachineExecutor();
    if (!smExecutor) {
      console.warn('[setstatemachine] No state machine executor');
      return;
    }

    const sm = this.findStateMachineByHandle(handle);
    if (sm) {
      smExecutor.start(sm);
    } else {
      console.warn(`[setstatemachine] State machine not found for handle: ${handle}`);
    }
  }

  private setstate(ctx: ExecutionContext): void {
    const handle = this.popInt(ctx);
    const smExecutor = this.vm.getStateMachineExecutor();
    if (!smExecutor) {
      console.warn('[setstate] No state machine executor');
      return;
    }

    const stateName = this.findStateNameByHandle(handle);
    if (stateName) {
      smExecutor.setState(stateName);
    } else {
      console.warn(`[setstate] State not found for handle: ${handle}`);
    }
  }

  private callstatemachine(ctx: ExecutionContext): void {
    const handle = this.popInt(ctx);
    const smExecutor = this.vm.getStateMachineExecutor();
    if (!smExecutor) {
      console.warn('[callstatemachine] No state machine executor');
      return;
    }

    const sm = this.findStateMachineByHandle(handle);
    if (sm) {
      smExecutor.callStateMachine(sm);
    } else {
      console.warn(`[callstatemachine] State machine not found for handle: ${handle}`);
    }
  }

  private returnstatemachine(): void {
    const smExecutor = this.vm.getStateMachineExecutor();
    if (!smExecutor) {
      console.warn('[returnstatemachine] No state machine executor');
      return;
    }
    smExecutor.returnStateMachine();
  }

  private findStateMachineByHandle(handle: number): string | null {
    const ipo = this.vm.getIpo();
    if (!ipo?.stateMachines) return null;

    const sm = ipo.stateMachines.get(handle);
    return sm?.header?.name ?? null;
  }

  private findStateNameByHandle(handle: number): string | null {
    const ipo = this.vm.getIpo();
    if (!ipo?.stateMachines) return null;

    for (const sm of ipo.stateMachines.values()) {
      if (sm.func?.header?.blockId === handle) {
        return 'INIT';
      }
      for (const state of sm.states) {
        if (state.header.blockId === handle) {
          return state.header.name;
        }
      }
    }
    return null;
  }

  // ============ Control ============

  private exit(): void {
    this.vm.stop();
  }

  private delay(ctx: ExecutionContext): void {
    const ms = this.popInt(ctx);
    const start = Date.now();
    while (Date.now() - start < ms) { /* busy wait */ }
  }

  // ============ Time ============

  private getdate(ctx: ExecutionContext): void {
    const outRef = this.popRef(ctx);
    const now = new Date();
    const date = `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getFullYear()}`;
    this.setOutParam(ctx, outRef, Stack.createEntry(ValueType.String, date));
  }

  private gettime(ctx: ExecutionContext): void {
    const outRef = this.popRef(ctx);
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    this.setOutParam(ctx, outRef, Stack.createEntry(ValueType.String, time));
  }

  // ============ String ============

  private strcat(ctx: ExecutionContext): void {
    const right = this.popString(ctx);
    const left = this.popString(ctx);
    const outRef = this.popRef(ctx);
    this.setOutParam(ctx, outRef, Stack.createEntry(ValueType.String, left + right));
  }

  private strlen(ctx: ExecutionContext): void {
    const str = this.popString(ctx);
    const outRef = this.popRef(ctx);
    this.setOutParam(ctx, outRef, Stack.createEntry(ValueType.Int, str.length));
  }

  private midstr(ctx: ExecutionContext): void {
    const length = this.popInt(ctx);
    const start = this.popInt(ctx);
    const str = this.popString(ctx);
    const outRef = this.popRef(ctx);
    this.setOutParam(ctx, outRef, Stack.createEntry(ValueType.String, str.substr(start, length)));
  }

  // ============ Conversion ============

  private realtostring(ctx: ExecutionContext): void {
    const outRef = this.popRef(ctx);
    this.popString(ctx); // format string - TODO: implement formatting
    const value = this.popReal(ctx);
    this.setOutParam(ctx, outRef, Stack.createEntry(ValueType.String, value.toString()));
  }

  private stringtoreal(ctx: ExecutionContext): void {
    const outRef = this.popRef(ctx);
    const value = this.popString(ctx);
    this.setOutParam(ctx, outRef, Stack.createEntry(ValueType.Real, parseFloat(value) || 0));
  }

  private inttostring(ctx: ExecutionContext): void {
    const outRef = this.popRef(ctx);
    const value = this.popInt(ctx);
    this.setOutParam(ctx, outRef, Stack.createEntry(ValueType.String, value.toString()));
  }

  private stringtoint(ctx: ExecutionContext): void {
    const outRef = this.popRef(ctx);
    const value = this.popString(ctx);
    this.setOutParam(ctx, outRef, Stack.createEntry(ValueType.Int, parseInt(value, 10) || 0));
  }

  private hexconvert(ctx: ExecutionContext): void {
    const segRef = this.popRef(ctx);
    const lowRef = this.popRef(ctx);
    const midRef = this.popRef(ctx);
    const highRef = this.popRef(ctx);
    const hexStr = this.popString(ctx);

    const clean = hexStr.replace(/[^0-9A-Fa-f]/g, '');
    const num = parseInt(clean, 16) || 0;

    this.setOutParam(ctx, highRef, Stack.createEntry(ValueType.Int, (num >> 24) & 0xFF));
    this.setOutParam(ctx, midRef, Stack.createEntry(ValueType.Int, (num >> 16) & 0xFF));
    this.setOutParam(ctx, lowRef, Stack.createEntry(ValueType.Int, (num >> 8) & 0xFF));
    this.setOutParam(ctx, segRef, Stack.createEntry(ValueType.Int, num & 0xFF));
  }

  private realtoint(ctx: ExecutionContext): void {
    const outRef = this.popRef(ctx);
    const value = this.popReal(ctx);
    this.setOutParam(ctx, outRef, Stack.createEntry(ValueType.Int, Math.floor(value)));
  }

  private inttoreal(ctx: ExecutionContext): void {
    const outRef = this.popRef(ctx);
    const value = this.popInt(ctx);
    this.setOutParam(ctx, outRef, Stack.createEntry(ValueType.Real, value));
  }

  private bytetoint(ctx: ExecutionContext): void {
    const outRef = this.popRef(ctx);
    const value = this.popInt(ctx) & 0xFF;
    this.setOutParam(ctx, outRef, Stack.createEntry(ValueType.Int, value));
  }

  private inttolong(ctx: ExecutionContext): void {
    const outRef = this.popRef(ctx);
    const value = this.popInt(ctx);
    this.setOutParam(ctx, outRef, Stack.createEntry(ValueType.Long, value));
  }

  private longtoreal(ctx: ExecutionContext): void {
    const outRef = this.popRef(ctx);
    const value = this.popInt(ctx);
    this.setOutParam(ctx, outRef, Stack.createEntry(ValueType.Real, value));
  }

  // ============ File I/O ============

  private fileopen(ctx: ExecutionContext): void {
    const mode = this.popString(ctx);
    const path = this.popString(ctx);
    this.fileHandle = { path, mode, lines: [] };
    this.fileLineIndex = 0;
    console.warn(`[fileopen] ${path} mode=${mode} - file I/O not fully implemented`);
  }

  private fileclose(): void {
    this.fileHandle = null;
  }

  private filewrite(ctx: ExecutionContext): void {
    const str = this.popString(ctx);
    if (this.fileHandle) {
      this.fileHandle.lines.push(str);
    }
  }

  private fileread(ctx: ExecutionContext): void {
    const eofRef = this.popRef(ctx);
    const strRef = this.popRef(ctx);

    if (this.fileHandle && this.fileLineIndex < this.fileHandle.lines.length) {
      this.setOutParam(ctx, strRef, Stack.createEntry(ValueType.String, this.fileHandle.lines[this.fileLineIndex++]));
      this.setOutParam(ctx, eofRef, Stack.createEntry(ValueType.Bool, false));
    } else {
      this.setOutParam(ctx, strRef, Stack.createEntry(ValueType.String, ''));
      this.setOutParam(ctx, eofRef, Stack.createEntry(ValueType.Bool, true));
    }
  }

  // ============ Binary ============

  private getBinaryDataString(ctx: ExecutionContext): void {
    const lenRef = this.popRef(ctx);
    const strRef = this.popRef(ctx);
    this.setOutParam(ctx, strRef, Stack.createEntry(ValueType.String, ''));
    this.setOutParam(ctx, lenRef, Stack.createEntry(ValueType.Int, 0));
  }
}
