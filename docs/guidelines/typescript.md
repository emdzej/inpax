# TypeScript Guidelines

## Core Principles

- `strict: true` in tsconfig (mandatory)
- No `any` - use `unknown` if type is truly unknown
- Explicit return types for public functions
- Use `readonly` for immutable data
- Prefer `Uint8Array` for binary data

## Types vs Interfaces

```typescript
// ✅ Use `type` for data models
type IpoInstruction = {
  opcode: number;
  operands: number[];
  offset: number;
};

// ✅ Use `interface` for contracts and operations
interface Parser {
  parse(buffer: Uint8Array): IpoFile;
}
```

**Rule of thumb:**

- `type` → Data shapes (IpoInstruction, ScreenDef, MenuDef)
- `interface` → Service contracts, abstract interfaces

## Const Objects over Enums

```typescript
// ✅ Good: Const object + type (better tree-shaking)
const Opcodes = {
  PUSH_VAR_ADDR: 0x01,
  PUSH_VAR_VAL: 0x0001,
  PUSH_CONST: 0x0006,
  STORE: 0x0005,
  ALU_OP: 0x0009,
  JMP_FALSE: 0x000B,
  JMP: 0x000E,
  CALL_USER: 0x0C80,
  CALL_SYSTEM: 0x0C81,
} as const;

type Opcode = (typeof Opcodes)[keyof typeof Opcodes];

// ❌ Bad: Enums (poor tree-shaking, runtime overhead)
enum Opcode {
  PushVarAddr = 0x01,
}
```

**Why avoid enums?**
- Enums generate extra runtime code
- Poor tree-shaking (entire enum included even if one value used)
- Const objects are just plain objects - zero overhead

## Naming Conventions

| Type          | Convention            | Example                          |
| ------------- | --------------------- | -------------------------------- |
| Variables     | camelCase             | `instruction`, `isRunning`       |
| Constants     | SCREAMING_SNAKE_CASE  | `MAX_STACK_DEPTH`, `HEADER_SIZE` |
| Functions     | camelCase             | `parseIpo`, `disassemble`        |
| Types         | PascalCase            | `IpoFile`, `Instruction`         |
| Interfaces    | PascalCase            | `Parser`, `Interpreter`          |
| Const Objects | PascalCase + plural   | `Opcodes`, `TypeMarkers`         |
| Classes       | PascalCase            | `Stack`, `InpaRuntime`           |

## File Naming

| Type             | Convention             | Example               |
| ---------------- | ---------------------- | --------------------- |
| Types/Interfaces | lowercase              | `types.ts`            |
| Classes          | lowercase              | `stack.ts`            |
| Utilities        | camelCase              | `parseHeader.ts`      |
| Tests            | Same name + `.spec.ts` | `stack.spec.ts`       |

## Common Patterns

### Discriminated Unions

```typescript
type ParseResult<T> = 
  | { success: true; value: T } 
  | { success: false; error: InpaxError };
```

### Bit Width Types

```typescript
type BitWidth = 8 | 16 | 32;

function readValue(view: DataView, offset: number, bits: BitWidth): number {
  switch (bits) {
    case 8: return view.getUint8(offset);
    case 16: return view.getUint16(offset, true);
    case 32: return view.getUint32(offset, true);
  }
}
```

### Snapshot Pattern (for debugging)

```typescript
class Stack {
  snapshot(): StackSnapshot {
    return {
      values: [...this.values],
      sp: this.sp,
    };
  }
}
```

## Anti-patterns

```typescript
// ❌ Using `any`
function decode(data: any): any {}

// ❌ Using enums
enum Opcode { Move = 0x01 }

// ❌ Type assertions without validation
const instruction = response as IpoInstruction;

// ❌ Non-null assertions without checks
const opcode = instruction!.opcode;

// ❌ Implicit any in function params
function process(data) {}

// ❌ Magic numbers without constants
if (buffer[0] === 0x05) {}  // What is 0x05?

// ✅ Better:
const TYPE_REAL = 0x05;
if (buffer[0] === TYPE_REAL) {}
```

## Binary Data

```typescript
// ✅ Use Uint8Array for binary buffers
function parseHeader(buffer: Uint8Array): IpoHeader {
  const view = new DataView(buffer.buffer, buffer.byteOffset);
  return {
    signature: view.getUint8(0),
    version: view.getUint16(1, true),
    // ...
  };
}

// ✅ Use DataView for multi-byte reads
const view = new DataView(buffer.buffer, buffer.byteOffset);
const value = view.getUint32(offset, true); // little-endian
```

## Error Handling

```typescript
// ✅ Use typed errors
import { InpaxError, ErrorCodes } from '@emdzej/inpax-core';

throw new InpaxError(ErrorCodes.INVALID_OPCODE, `Unknown opcode: 0x${opcode.toString(16)}`);

// ✅ Check error type
if (error instanceof InpaxError) {
  console.error(`Inpax error: ${error.code}`);
}
```
