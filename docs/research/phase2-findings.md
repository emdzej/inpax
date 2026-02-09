# Phase 2 Findings: Opcodes & Control Flow

## Overview

Analysis of IPO bytecode for control flow and arithmetic operations. Confirmed **stack-based architecture**.

## Test Scripts Created

- `test_if.ips` — simple if statement
- `test_while.ips` — while loop
- `test_arithmetic.ips` — arithmetic operations (+, -, *)

## Opcode Table

| Opcode | Mnemonic | Function |
| :--- | :--- | :--- |
| `01 [u16]` | `PUSH_VAR_ADDR` | Push variable address (for assignment target) |
| `00 01 [u16]` | `PUSH_VAR_VAL` | Push variable value (for reading) |
| `00 06 [u16]` | `PUSH_CONST` | Push constant from data section |
| `00 05` | `STORE` | Pop Value, Pop Addr → Write to variable |
| `00 09 [op]` | `ALU_OP` | Arithmetic/comparison operation |
| `00 0B [s16]` | `JMP_FALSE` | Jump if top of stack is 0 (False) |
| `00 0E [s16]` | `JMP` | Unconditional jump |

## ALU Operations (`00 09 [op]`)

| Op byte | Operation |
| :--- | :--- |
| `00` | Add (+) |
| `01` | Sub (-) |
| `02` | Mul (*) |
| `10` | Greater Than (>) |
| `11` | Less Than (<) |

## Architecture Notes

1. **Stack-based** — operands pushed to stack, operations pop and push results
2. **Variables by index** — no names in bytecode, referenced by u16 index
3. **Two-byte prefix** — most opcodes start with `00` prefix
4. **Jump offsets** — signed 16-bit relative offsets

## Control Flow Patterns

### If Statement
```
PUSH_VAR_VAL x      ; load condition variable
PUSH_CONST 5        ; load comparison value  
ALU_OP GT           ; compare: x > 5
JMP_FALSE +offset   ; skip if false
... (true block) ...
```

### While Loop
```
loop_start:
PUSH_VAR_VAL i      ; load counter
PUSH_CONST 5        ; load limit
ALU_OP LT           ; compare: i < 5
JMP_FALSE +exit     ; exit if false
... (loop body) ...
JMP -offset         ; jump back to loop_start
exit:
```

## Next Steps

- Phase 3: Functions & UI constructs
- Integrate `inspect_ipo.js` disassembler into main codebase
- Map function call opcodes
- Analyze SCREEN/MENU bytecode patterns
