/**
 * Internal Functions - handled by interpreter, not providers
 * Includes: timer, state machine, control flow, conversions, string ops, file I/O
 */

import type { VM } from '../vm/interpreter.js';
import type { ExecutionContext } from '../vm/execution-context.js';
import { SystemFunction, ValueType } from '@emdzej/inpax-core';
import { Stack } from '../vm/stack.js';
import { getLogger } from '@emdzej/inpax-logger';

const log = getLogger('internal-functions');

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
      log.warn({ funcId: `0x${funcId.toString(16)}` }, 'internal function not implemented');
      return;
    }
    handler(ctx);
  }

  private stub(name: string): void {
    log.warn({ name }, 'stub function not implemented');
  }

  // ============ Timer ============

  private settimer(ctx: ExecutionContext): void {
    const timeval = ctx.popInt();
    const timernum = ctx.popInt();

    const executor = this.vm.getScreenExecutor();
    if (executor) {
      executor.setTimer(timernum, timeval);
    } else {
      this.timers.set(timernum, { start: Date.now(), duration: timeval });
    }
  }

  private testtimer(ctx: ExecutionContext): void {
    const outRef = ctx.popRef();
    const timernum = ctx.popInt();

    const executor = this.vm.getScreenExecutor();
    let expired: boolean;

    if (executor) {
      expired = executor.testTimer(timernum);
    } else {
      const timer = this.timers.get(timernum);
      expired = timer ? (Date.now() - timer.start >= timer.duration) : true;
    }

    ctx.setOutParam(outRef, Stack.createEntry(ValueType.Bool, expired));
  }

  // ============ Menu ==============

  private setmenu(ctx: ExecutionContext): void {
    const menuHandle = ctx.popInt();
    this.vm.setMenu(menuHandle).catch(err => {
      log.error({ err }, 'setmenu error activating menu');
    });
  }

  // ============ Screen ============

  private setscreen(ctx: ExecutionContext): void {
    const cyclic = ctx.popInt() !== 0;
    const handle = ctx.popRef();
    const screenId = handle.refInfo?.index;
    if (screenId === undefined) {
      log.warn('setscreen invalid screen reference');
      return;
    }
    const screenName = this.findScreenByHandle(screenId);
    if (!screenName) {
      log.warn({ screenId }, 'setscreen screen not found for handle');
      return;
    }

    this.vm.setScreen(screenId, cyclic).catch(err => {
      log.error({ err, screenId }, 'setscreen error activating screen');
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
    const handle = ctx.popInt();
    const smExecutor = this.vm.getStateMachineExecutor();
    if (!smExecutor) {
      log.warn('setstatemachine no state machine executor');
      return;
    }

    const sm = this.findStateMachineByHandle(handle);
    if (sm) {
      smExecutor.start(sm);
    } else {
      log.warn({ handle }, 'setstatemachine state machine not found for handle');
    }
  }

  private setstate(ctx: ExecutionContext): void {
    const handle = ctx.popInt();
    const smExecutor = this.vm.getStateMachineExecutor();
    if (!smExecutor) {
      log.warn('setstate no state machine executor');
      return;
    }

    const stateName = this.findStateNameByHandle(handle);
    if (stateName) {
      smExecutor.setState(stateName);
    } else {
      log.warn({ handle }, 'setstate state not found for handle');
    }
  }

  private callstatemachine(ctx: ExecutionContext): void {
    const handle = ctx.popInt();
    const smExecutor = this.vm.getStateMachineExecutor();
    if (!smExecutor) {
      log.warn('callstatemachine no state machine executor');
      return;
    }

    const sm = this.findStateMachineByHandle(handle);
    if (sm) {
      smExecutor.callStateMachine(sm);
    } else {
      log.warn({ handle }, 'callstatemachine state machine not found for handle');
    }
  }

  private returnstatemachine(): void {
    const smExecutor = this.vm.getStateMachineExecutor();
    if (!smExecutor) {
      log.warn('returnstatemachine no state machine executor');
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
    const ms = ctx.popInt();
    const start = Date.now();
    while (Date.now() - start < ms) { /* busy wait */ }
  }

  // ============ Time ============

  private getdate(ctx: ExecutionContext): void {
    const outRef = ctx.popRef();
    const now = new Date();
    const date = `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getFullYear()}`;
    ctx.setOutParam(outRef, Stack.createEntry(ValueType.String, date));
  }

  private gettime(ctx: ExecutionContext): void {
    const outRef = ctx.popRef();
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    ctx.setOutParam(outRef, Stack.createEntry(ValueType.String, time));
  }

  // ============ String ============

  private strcat(ctx: ExecutionContext): void {
    const right = ctx.popString();
    const left = ctx.popString();
    const outRef = ctx.popRef();
    ctx.setOutParam(outRef, Stack.createEntry(ValueType.String, left + right));
  }

  private strlen(ctx: ExecutionContext): void {
    const str = ctx.popString();
    const outRef = ctx.popRef();
    ctx.setOutParam(outRef, Stack.createEntry(ValueType.Int, str.length));
  }

  private midstr(ctx: ExecutionContext): void {
    const length = ctx.popInt();
    const start = ctx.popInt();
    const str = ctx.popString();
    const outRef = ctx.popRef();
    ctx.setOutParam(outRef, Stack.createEntry(ValueType.String, str.substr(start, length)));
  }

  // ============ Conversion ============

  private realtostring(ctx: ExecutionContext): void {
    const outRef = ctx.popRef();
    ctx.popString(); // format string - TODO: implement formatting
    const value = ctx.popReal();
    ctx.setOutParam(outRef, Stack.createEntry(ValueType.String, value.toString()));
  }

  private stringtoreal(ctx: ExecutionContext): void {
    const outRef = ctx.popRef();
    const value = ctx.popString();
    ctx.setOutParam(outRef, Stack.createEntry(ValueType.Real, parseFloat(value) || 0));
  }

  private inttostring(ctx: ExecutionContext): void {
    const outRef = ctx.popRef();
    const value = ctx.popInt();
    ctx.setOutParam(outRef, Stack.createEntry(ValueType.String, value.toString()));
  }

  private stringtoint(ctx: ExecutionContext): void {
    const outRef = ctx.popRef();
    const value = ctx.popString();
    ctx.setOutParam(outRef, Stack.createEntry(ValueType.Int, parseInt(value, 10) || 0));
  }

  private hexconvert(ctx: ExecutionContext): void {
    const segRef = ctx.popRef();
    const lowRef = ctx.popRef();
    const midRef = ctx.popRef();
    const highRef = ctx.popRef();
    const hexStr = ctx.popString();

    const clean = hexStr.replace(/[^0-9A-Fa-f]/g, '');
    const num = parseInt(clean, 16) || 0;

    ctx.setOutParam(highRef, Stack.createEntry(ValueType.Int, (num >> 24) & 0xFF));
    ctx.setOutParam(midRef, Stack.createEntry(ValueType.Int, (num >> 16) & 0xFF));
    ctx.setOutParam(lowRef, Stack.createEntry(ValueType.Int, (num >> 8) & 0xFF));
    ctx.setOutParam(segRef, Stack.createEntry(ValueType.Int, num & 0xFF));
  }

  private realtoint(ctx: ExecutionContext): void {
    const outRef = ctx.popRef();
    const value = ctx.popReal();
    ctx.setOutParam(outRef, Stack.createEntry(ValueType.Int, Math.floor(value)));
  }

  private inttoreal(ctx: ExecutionContext): void {
    const outRef = ctx.popRef();
    const value = ctx.popInt();
    ctx.setOutParam(outRef, Stack.createEntry(ValueType.Real, value));
  }

  private bytetoint(ctx: ExecutionContext): void {
    const outRef = ctx.popRef();
    const value = ctx.popInt() & 0xFF;
    ctx.setOutParam(outRef, Stack.createEntry(ValueType.Int, value));
  }

  private inttolong(ctx: ExecutionContext): void {
    const outRef = ctx.popRef();
    const value = ctx.popInt();
    ctx.setOutParam(outRef, Stack.createEntry(ValueType.Long, value));
  }

  private longtoreal(ctx: ExecutionContext): void {
    const outRef = ctx.popRef();
    const value = ctx.popInt();
    ctx.setOutParam(outRef, Stack.createEntry(ValueType.Real, value));
  }

  // ============ File I/O ============

  private fileopen(ctx: ExecutionContext): void {
    const mode = ctx.popString();
    const path = ctx.popString();
    this.fileHandle = { path, mode, lines: [] };
    this.fileLineIndex = 0;
    log.warn({ path, mode }, 'file I/O not fully implemented');
  }

  private fileclose(): void {
    this.fileHandle = null;
  }

  private filewrite(ctx: ExecutionContext): void {
    const str = ctx.popString();
    if (this.fileHandle) {
      this.fileHandle.lines.push(str);
    }
  }

  private fileread(ctx: ExecutionContext): void {
    const eofRef = ctx.popRef();
    const strRef = ctx.popRef();

    if (this.fileHandle && this.fileLineIndex < this.fileHandle.lines.length) {
      ctx.setOutParam(strRef, Stack.createEntry(ValueType.String, this.fileHandle.lines[this.fileLineIndex++]));
      ctx.setOutParam(eofRef, Stack.createEntry(ValueType.Bool, false));
    } else {
      ctx.setOutParam(strRef, Stack.createEntry(ValueType.String, ''));
      ctx.setOutParam(eofRef, Stack.createEntry(ValueType.Bool, true));
    }
  }

  // ============ Binary ============

  private getBinaryDataString(ctx: ExecutionContext): void {
    const lenRef = ctx.popRef();
    const strRef = ctx.popRef();
    ctx.setOutParam(strRef, Stack.createEntry(ValueType.String, ''));
    ctx.setOutParam(lenRef, Stack.createEntry(ValueType.Int, 0));
  }
}
