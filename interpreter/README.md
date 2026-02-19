# @inpax/interpreter

INPA IPO bytecode interpreter written in TypeScript.

## Features

- **IPO Parser** - Parses IPO binary files into structured data
- **Virtual Machine** - Executes IPO bytecode instructions
- **System Functions** - Built-in functions (string, timer, date/time, etc.)

## Installation

```bash
pnpm install
pnpm build
```

## Usage

### As Library

```typescript
import { parseIpo, VM } from '@inpax/interpreter';
import { readFileSync } from 'fs';

// Load and parse IPO file
const buffer = readFileSync('script.ipo');
const ipo = parseIpo(buffer);

// Create VM and run
const vm = new VM(ipo);
vm.run();
```

### CLI

```bash
# Parse only
npx tsx src/cli.ts script.ipo --parse

# Run
npx tsx src/cli.ts script.ipo

# Debug mode
npx tsx src/cli.ts script.ipo --debug
```

## Project Structure

```
interpreter/
├── src/
│   ├── types/          # Type definitions
│   │   ├── enums.ts    # Opcodes, ValueTypes, BlockTypes
│   │   └── structures.ts # Data structures
│   ├── parser/         # IPO file parser
│   │   └── ipo-parser.ts
│   ├── vm/             # Virtual machine
│   │   ├── stack.ts    # Value stack & call frames
│   │   └── interpreter.ts # Main VM loop
│   ├── runtime/        # Runtime support
│   │   └── system-functions.ts
│   ├── cli.ts          # CLI runner
│   └── index.ts        # Main exports
├── package.json
└── tsconfig.json
```

## Architecture

### Execution Flow

```
IPO File → Parser → IpoFile structure → VM → Execute
                                          ↓
                                    System Functions
```

### VM Components

1. **Stack** - Value stack with call frame support
2. **Globals** - Global variable pool
3. **Constants** - Constant value pool
4. **Functions** - User-defined functions (bytecode)
5. **System Functions** - Built-in native functions

### Supported Opcodes

| Opcode | Name | Description |
|--------|------|-------------|
| 0x01 | LOAD | Push variable copy |
| 0x02 | PUSHREF | Push variable reference |
| 0x04 | CAST | Type conversion |
| 0x05 | MOVE | Assign value |
| 0x08 | JMP | Unconditional jump |
| 0x09 | JMPZ | Jump if zero/false |
| 0x0A | JMPNZ | Jump if non-zero/true |
| 0x0B | ALU | Arithmetic/logic op |
| 0x0C | CALL | Call function |
| 0x0E | RET | Return from function |
| 0x0F | FRAME | Push call frame |
| 0x10 | POP | Pop N values |
| 0x11 | PUSHCONST | Push constant |

### Implemented System Functions

- **UI**: setmenutitle, setmenu, setitem, settitle, setscreen
- **Timer**: settimer, testtimer
- **Control**: exit, exitwindows
- **Utility**: delay, getdate, gettime
- **String**: strcat, strlen, midstr
- **Conversion**: inttostring, stringtoint, realtostring, stringtoreal

## TODO

- [ ] Screen/Menu/StateMachine execution
- [ ] IMPORT32 (DLL calls)
- [ ] Full system function coverage (159 total)
- [ ] EDIABAS API integration
- [ ] UI rendering (TUI or native)

## References

- [IPO Format Documentation](../docs/ipo-format-decompiled.md)
- [Opcode Reference](../docs/opcode-reference.md)
- [System Functions](../docs/system-functions.md)
