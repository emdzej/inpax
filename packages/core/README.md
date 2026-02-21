# @inpax/core

Core types, constants, and opcodes for INPAX.

## Contents

- **Opcodes** — VM instruction definitions
- **Constants** — System function IDs, flags
- **Types** — Shared type definitions
- **Structures** — IPO file structures

## Usage

```typescript
import { 
  Opcode, 
  SystemFunction,
  IPOHeader,
  INPA_VERSION 
} from '@inpax/core';

// Check opcode
if (opcode === Opcode.CALL) {
  // ...
}

// System function lookup
const funcName = SystemFunction[funcId];
```

## Opcodes

The VM supports ~100 opcodes including:

- Control flow: `JMP`, `CALL`, `RET`, `Jxx`
- Stack: `PUSH`, `POP`, `DUP`
- Arithmetic: `ADD`, `SUB`, `MUL`, `DIV`
- Comparison: `CMP`, `TEST`
- String: `SCAT`, `SCMP`, `SLEN`
- System: `SYSCALL`

## System Functions

INPA uses numbered system calls for UI and EDIABAS operations:

| ID | Function |
|----|----------|
| 1 | setscreen |
| 2 | setmenu |
| 3 | setitem |
| 10 | text |
| 20 | analogout |
| ... | ... |

See `src/system-functions.ts` for full list.
