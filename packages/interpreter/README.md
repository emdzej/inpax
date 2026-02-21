# @inpax/interpreter

VM interpreter for INPAX bytecode execution.

## Usage

```typescript
import { Interpreter } from '@inpax/interpreter';
import { parseIPO } from '@inpax/parser';
import type { IUIProvider, IEdiabasProvider } from '@inpax/interfaces';

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
