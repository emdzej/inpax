# @emdzej/inpax-interpreter

VM interpreter for INPAX bytecode execution.

## Usage

```typescript
import { Interpreter } from '@emdzej/inpax-interpreter';
import { parseIPO } from '@emdzej/inpax-parser';
import type { IUIProvider, IEdiabasProvider } from '@emdzej/inpax-interfaces';

const ipo = parseIPO(buffer);

const interpreter = new Interpreter({
  ipo,
  ui: uiProvider,
  ediabas: ediabasProvider,
});

// Run entry function
await interpreter.run('inpainit');

// Or step through
interpreter.load('inpainit');
while (!interpreter.halted) {
  await interpreter.step();
}
```

## VM Architecture

- **Stack-based** — Operands pushed/popped from stack
- **System calls** — UI and EDIABAS via numbered syscalls
- **Local variables** — Per-function local storage
- **String table** — Shared string pool

## Execution Modes

### Continuous

```typescript
await interpreter.run('functionName');
```

### Step-by-step

```typescript
interpreter.load('functionName');
while (!interpreter.halted) {
  const instruction = interpreter.current;
  console.log(instruction);
  await interpreter.step();
}
```

### Debug

```typescript
interpreter.on('instruction', (instr) => {
  console.log(`${instr.offset}: ${instr.opcode}`);
});

interpreter.on('syscall', (call) => {
  console.log(`SYSCALL: ${call.name}(${call.args})`);
});
```

## State

```typescript
interface VMState {
  pc: number;           // Program counter
  sp: number;           // Stack pointer
  stack: unknown[];     // Value stack
  locals: unknown[];    // Local variables
  halted: boolean;      // Execution stopped
}
```

## Host overrides for system functions

Hosts (CLI, web app, TUI, headless test harnesses) usually need
different semantics for the same BEST2 verb — `exitwindows` should
close a browser tab in the web app, call `process.exit` in the CLI,
collapse a panel in the TUI. The `systemFunctions` slot in `VMConfig`
lets the host wire those in without forking the interpreter.

```typescript
import {
  VM,
  type SystemFunctionOverride,
} from '@emdzej/inpax-interpreter';
import { SystemFunction } from '@emdzej/inpax-core';

const vm = new VM(ipo, {
  runtime,
  systemFunctions: new Map<number, SystemFunctionOverride>([
    [SystemFunction.exitwindows, async (ctx, vm) => {
      // Drain whatever args the verb expects (exitwindows takes none),
      // then run host-specific teardown.
      await saveSession();
      window.close();
    }],
    [SystemFunction.exit, (ctx, vm) => {
      // Sync handlers are fine — the VM awaits both.
      process.exit(0);
    }],
  ]),
});
```

Rules of the road:

- **Override fully replaces the default.** No chain-to-default —
  consumers who want "default plus side-effect" compose by hand
  (e.g. call into a host-specific method, then trigger the same
  behaviour the default would).
- **Override is responsible for popping its own arguments** from the
  `ExecutionContext`, matching `InternalFunctions`' convention. The
  dispatcher's generic argument-collection path is bypassed when an
  override fires.
- **Sync or async — both are awaited.** Return `void` for sync, a
  `Promise<void>` for async; the VM `await`s either.
- **Override precedence:** checked before both the internal-functions
  registry and the dispatcher. If no entry is registered for a given
  `funcId`, default routing applies unchanged.
