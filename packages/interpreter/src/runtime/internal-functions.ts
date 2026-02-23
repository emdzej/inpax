/**
 * Internal Functions - handled by interpreter, not providers
 * Includes: timer, state machine, control flow, conversions, string ops, file I/O
 */

import type { VM } from '../vm/interpreter.js';
import { StackEntry, SystemFunction, ValueType } from '@inpax/core';
import { Stack } from '../vm/stack.js';

type InternalHandler = () => void;

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
    this.handlers.set(SystemFunction.settimer, () => this.settimer());
    this.handlers.set(SystemFunction.testtimer, () => this.testtimer());

    // Control
    this.handlers.set(SystemFunction.exit, () => this.exit());
    this.handlers.set(SystemFunction.exitwindows, () => this.exit());
    this.handlers.set(SystemFunction.delay, () => this.delay());

    // Time
    this.handlers.set(SystemFunction.getdate, () => this.getdate());
    this.handlers.set(SystemFunction.gettime, () => this.gettime());

    // String
    this.handlers.set(SystemFunction.strcat, () => this.strcat());
    this.handlers.set(SystemFunction.strlen, () => this.strlen());
    this.handlers.set(SystemFunction.midstr, () => this.midstr());

    // Conversion
    this.handlers.set(SystemFunction.realtostring, () => this.realtostring());
    this.handlers.set(SystemFunction.stringtoreal, () => this.stringtoreal());
    this.handlers.set(SystemFunction.inttostring, () => this.inttostring());
    this.handlers.set(SystemFunction.stringtoint, () => this.stringtoint());
    this.handlers.set(SystemFunction.hexconvert, () => this.hexconvert());
    this.handlers.set(SystemFunction.realtoint, () => this.realtoint());
    this.handlers.set(SystemFunction.inttoreal, () => this.inttoreal());
    this.handlers.set(SystemFunction.bytetoint, () => this.bytetoint());
    this.handlers.set(SystemFunction.inttolong, () => this.inttolong());
    this.handlers.set(SystemFunction.longtoreal, () => this.longtoreal());

    // File I/O
    this.handlers.set(SystemFunction.fileopen, () => this.fileopen());
    this.handlers.set(SystemFunction.fileclose, () => this.fileclose());
    this.handlers.set(SystemFunction.filewrite, () => this.filewrite());
    this.handlers.set(SystemFunction.fileread, () => this.fileread());

    // Binary
    this.handlers.set(SystemFunction.GetBinaryDataString, () => this.getBinaryDataString());

    // Menu
    this.handlers.set(SystemFunction.setmenu, () => this.setmenu());
    // Screen
    this.handlers.set(SystemFunction.setscreen, () => this.setscreen());

    // State Machine (stubs)
    this.handlers.set(SystemFunction.setstatemachine, () => this.setstatemachine());
    this.handlers.set(SystemFunction.setstate, () => this.setstate());
    this.handlers.set(SystemFunction.callstatemachine, () => this.callstatemachine());
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

  call(funcId: number): void {
    const handler = this.handlers.get(funcId);
    if (!handler) {
      console.warn(`Internal function not implemented: 0x${funcId.toString(16)}`);
      return;
    }
    handler();
  }

  // ============ Helpers ============

  private popString(): string {
    return String(this.vm.getStack().pop().value);
  }

  private popInt(): number {
    return Math.floor(Number(this.vm.getStack().pop().value));
  }

  private popReal(): number {
    return Number(this.vm.getStack().pop().value);
  }

  private popRef(): StackEntry {
    return this.vm.getStack().pop();
  }

  private setOutParam(ref: StackEntry, value: StackEntry): void {
    if (!ref.refInfo) throw new Error('Expected reference for out parameter');
    const { scope, index } = ref.refInfo;
    if (scope === 0x00) {
      this.vm.getGlobals()[index] = value;
    } else if (scope === 0x02) {
      this.vm.getStack().set(index, value);
    }
  }

  private stub(name: string): void {
    console.warn(`[STUB] ${name} - not implemented`);
  }

  // ============ Timer ============

  private settimer(): void {
    const timeval = this.popInt();
    const timernum = this.popInt();

    // Delegate to ScreenExecutor if available, otherwise use local timers
    const executor = this.vm.getScreenExecutor();
    if (executor) {
      executor.setTimer(timernum, timeval);
    } else {
      this.timers.set(timernum, { start: Date.now(), duration: timeval });
    }
  }

  private testtimer(): void {
    const outRef = this.popRef();
    const timernum = this.popInt();

    // Delegate to ScreenExecutor if available
    const executor = this.vm.getScreenExecutor();
    let expired: boolean;

    if (executor) {
      expired = executor.testTimer(timernum);
    } else {
      const timer = this.timers.get(timernum);
      expired = timer ? (Date.now() - timer.start >= timer.duration) : true;
    }

    this.setOutParam(outRef, Stack.createEntry(ValueType.Bool, expired));
  }

  // ============ Menu ==============

  private setmenu(): void {
    const menuHandle = this.popInt();
    this.vm.setMenu(menuHandle).catch(err => {
      console.error(`[setmenu] Error activating menu: ${err}`);
    });
  }

  // ============ Screen ============

  private setscreen(): void {
    const cyclic = this.popInt() !== 0; // bool as int
    const handle = this.popRef();
    const screenId = handle.refInfo?.index;
    if (screenId === undefined) {
      console.warn('[setscreen] Invalid screen reference');
      return;
    }
    // Find screen name by handle
    const screenName = this.findScreenByHandle(screenId);
    if (!screenName) {
      console.warn(`[setscreen] Screen not found for handle: ${screenId}`);
      return;
    }

    // Activate screen via VM
    // Note: This is async but system functions are sync - we start it and let it run
    this.vm.setScreen(screenId, cyclic).catch(err => {
      console.error(`[setscreen] Error activating screen: ${err}`);
    });

    // Also notify UI provider for display purposes
    this.vm.getRuntime().ui.setScreen(screenId, cyclic);
  }

  /**
   * Find screen name by handle (block ID)
   */
  private findScreenByHandle(handle: number): string | null {
    const ipo = (this.vm as any).ipo;
    if (!ipo?.screens) return null;

    const screen = ipo.screens.get(handle);
    return screen?.header?.name ?? null;
  }

  // ============ State Machine ============

  private setstatemachine(): void {
    const handle = this.popInt();
    // Get state machine name from IPO by handle/blockId
    const smExecutor = this.vm.getStateMachineExecutor();
    if (!smExecutor) {
      console.warn('[setstatemachine] No state machine executor');
      return;
    }

    // The handle is the block ID - we need to find the name
    // For now, iterate to find the state machine with this ID
    const sm = this.findStateMachineByHandle(handle);
    if (sm) {
      smExecutor.start(sm);
    } else {
      console.warn(`[setstatemachine] State machine not found for handle: ${handle}`);
    }
  }

  private setstate(): void {
    const handle = this.popInt();
    // The handle is the state block ID - we need to find the state name
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

  private callstatemachine(): void {
    const handle = this.popInt();
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

  /**
   * Find state machine name by handle (block ID)
   * The IPO stores state machines by ID, but StateMachineExecutor uses names
   */
  private findStateMachineByHandle(handle: number): string | null {
    const ipo = (this.vm as any).ipo; // Access IPO through VM
    if (!ipo?.stateMachines) return null;

    const sm = ipo.stateMachines.get(handle);
    return sm?.header?.name ?? null;
  }

  /**
   * Find state name by handle (block ID)
   * States are stored within state machines
   */
  private findStateNameByHandle(handle: number): string | null {
    const ipo = (this.vm as any).ipo;
    if (!ipo?.stateMachines) return null;

    // Search all state machines for a state with this handle
    for (const sm of ipo.stateMachines.values()) {
      // Check INIT (main function of state machine)
      if (sm.func?.header?.blockId === handle) {
        return 'INIT';
      }
      // Check named states
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

  private delay(): void {
    const ms = this.popInt();
    const start = Date.now();
    while (Date.now() - start < ms) { /* busy wait */ }
  }

  // ============ Time ============

  private getdate(): void {
    const outRef = this.popRef();
    const now = new Date();
    const date = `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getFullYear()}`;
    this.setOutParam(outRef, Stack.createEntry(ValueType.String, date));
  }

  private gettime(): void {
    const outRef = this.popRef();
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    this.setOutParam(outRef, Stack.createEntry(ValueType.String, time));
  }

  // ============ String ============

  private strcat(): void {
    const right = this.popString();
    const left = this.popString();
    const outRef = this.popRef();
    this.setOutParam(outRef, Stack.createEntry(ValueType.String, left + right));
  }

  private strlen(): void {
    const str = this.popString();
    const outRef = this.popRef();
    this.setOutParam(outRef, Stack.createEntry(ValueType.Int, str.length));
  }

  private midstr(): void {
    const length = this.popInt();
    const start = this.popInt();
    const str = this.popString();
    const outRef = this.popRef();
    this.setOutParam(outRef, Stack.createEntry(ValueType.String, str.substr(start, length)));
  }

  // ============ Conversion ============

  private realtostring(): void {
    const outRef = this.popRef();
    const format = this.popString();
    const value = this.popReal();
    // TODO: Parse format string
    this.setOutParam(outRef, Stack.createEntry(ValueType.String, value.toString()));
  }

  private stringtoreal(): void {
    const outRef = this.popRef();
    const value = this.popString();
    this.setOutParam(outRef, Stack.createEntry(ValueType.Real, parseFloat(value) || 0));
  }

  private inttostring(): void {
    const outRef = this.popRef();
    const value = this.popInt();
    this.setOutParam(outRef, Stack.createEntry(ValueType.String, value.toString()));
  }

  private stringtoint(): void {
    const outRef = this.popRef();
    const value = this.popString();
    this.setOutParam(outRef, Stack.createEntry(ValueType.Int, parseInt(value, 10) || 0));
  }

  private hexconvert(): void {
    const segRef = this.popRef();
    const lowRef = this.popRef();
    const midRef = this.popRef();
    const highRef = this.popRef();
    const hexStr = this.popString();

    // Parse hex string (format varies)
    const clean = hexStr.replace(/[^0-9A-Fa-f]/g, '');
    const num = parseInt(clean, 16) || 0;

    this.setOutParam(highRef, Stack.createEntry(ValueType.Int, (num >> 24) & 0xFF));
    this.setOutParam(midRef, Stack.createEntry(ValueType.Int, (num >> 16) & 0xFF));
    this.setOutParam(lowRef, Stack.createEntry(ValueType.Int, (num >> 8) & 0xFF));
    this.setOutParam(segRef, Stack.createEntry(ValueType.Int, num & 0xFF));
  }

  private realtoint(): void {
    const outRef = this.popRef();
    const value = this.popReal();
    this.setOutParam(outRef, Stack.createEntry(ValueType.Int, Math.floor(value)));
  }

  private inttoreal(): void {
    const outRef = this.popRef();
    const value = this.popInt();
    this.setOutParam(outRef, Stack.createEntry(ValueType.Real, value));
  }

  private bytetoint(): void {
    const outRef = this.popRef();
    const value = this.popInt() & 0xFF;
    this.setOutParam(outRef, Stack.createEntry(ValueType.Int, value));
  }

  private inttolong(): void {
    const outRef = this.popRef();
    const value = this.popInt();
    this.setOutParam(outRef, Stack.createEntry(ValueType.Long, value));
  }

  private longtoreal(): void {
    const outRef = this.popRef();
    const value = this.popInt();
    this.setOutParam(outRef, Stack.createEntry(ValueType.Real, value));
  }

  // ============ File I/O ============

  private fileopen(): void {
    const mode = this.popString();
    const path = this.popString();
    // Simplified - real impl would use fs
    this.fileHandle = { path, mode, lines: [] };
    this.fileLineIndex = 0;
    console.warn(`[fileopen] ${path} mode=${mode} - file I/O not fully implemented`);
  }

  private fileclose(): void {
    this.fileHandle = null;
  }

  private filewrite(): void {
    const str = this.popString();
    if (this.fileHandle) {
      this.fileHandle.lines.push(str);
    }
  }

  private fileread(): void {
    const eofRef = this.popRef();
    const strRef = this.popRef();

    if (this.fileHandle && this.fileLineIndex < this.fileHandle.lines.length) {
      this.setOutParam(strRef, Stack.createEntry(ValueType.String, this.fileHandle.lines[this.fileLineIndex++]));
      this.setOutParam(eofRef, Stack.createEntry(ValueType.Bool, false));
    } else {
      this.setOutParam(strRef, Stack.createEntry(ValueType.String, ''));
      this.setOutParam(eofRef, Stack.createEntry(ValueType.Bool, true));
    }
  }

  // ============ Binary ============

  private getBinaryDataString(): void {
    const lenRef = this.popRef();
    const strRef = this.popRef();
    // Returns last binary result - simplified
    this.setOutParam(strRef, Stack.createEntry(ValueType.String, ''));
    this.setOutParam(lenRef, Stack.createEntry(ValueType.Int, 0));
  }
}
