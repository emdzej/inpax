# Phase 2 Findings: Opcodes & Control Flow

**Date:** 2026-02-09
**Status:** Phase 2 Complete

## 1. Instruction Set Architecture (ISA) Overview

The INPA virtual machine appears to be stack-based. Operations generally involve pushing operands (addresses or values) onto the stack and then executing an operator instruction.

### Opcode Structure
Instructions are variable-length. Many common operations use a `0x00` prefix followed by a sub-opcode.

| Opcode / Sequence | Arguments | Description | Mnemonic |
| :--- | :--- | :--- | :--- |
| `01 [u16]` | `Index` | Push **Address** of Global Variable `Index` to stack. Used for assignment targets (LHS). | `PUSH_VAR_ADDR` |
| `00 01 [u16]` | `Index` | Push **Value** of Global Variable `Index` to stack. Used for reading variables (RHS). | `PUSH_VAR_VAL` |
| `00 06 [u16]` | `Index` | Push **Constant** value from Constant Table at `Index`. | `PUSH_CONST` |
| `00 05` | None | **Store** value. Pops value, pops address, writes value to address. | `STORE` |
| `00 09 [u8]` | `Op` | **Binary Operation**. Pops two values, performs `Op`, pushes result. | `ALU_OP` |
| `00 0B [s16]` | `Offset` | **Jump if False**. Pops condition. If 0 (False), jumps by `Offset` bytes relative to next instruction. | `JMP_FALSE` |
| `00 0E [s16]` | `Offset` | **Jump Always**. Unconditional jump by `Offset` bytes. | `JMP` |

## 2. Arithmetic & Logic Operations (`00 09`)

The `00 09` opcode is followed by a single byte specifying the operation.

| Sub-Opcode | Symbol | Operation |
| :--- | :--- | :--- |
| `0x60` | `+` | Addition |
| `0x61` | `-` | Subtraction |
| `0x62` | `*` | Multiplication |
| `0x64` | `<` | Less Than |
| `0x65` | `>` | Greater Than |

## 3. Control Flow Structures

### If Statement
Structure of `if (x > 5) { ... }`:
1.  **Condition Evaluation**: Pushes `x`, pushes `5`, executes `ALU (>)`.
2.  **Branching**: `JMP_FALSE` (0x00 0B) with offset to skip the block.
3.  **Block Body**: Instructions inside the curly braces.
4.  **End**: Execution continues (Target of JMP_FALSE).

### While Loop
Structure of `while (i < 5) { ... }`:
1.  **Loop Start Label**: (Implicit target of jump back).
2.  **Condition**: Pushes `i`, pushes `5`, executes `ALU (<)`.
3.  **Exit Branch**: `JMP_FALSE` with offset to skip the loop body.
4.  **Body**: Instructions inside loop.
5.  **Loop Back**: `JMP` (0x00 0E) with **negative** offset to Loop Start.

## 4. Example Bytecode Trace

**Source:** `x = 10;`
```
01 01 00       ; PUSH_VAR_ADDR (Var 1 'x')
00 06 00 00    ; PUSH_CONST (Const 0 '10')
00 05          ; STORE
```

**Source:** `if (x > 5)`
```
00 01 01 00    ; PUSH_VAR_VAL (Var 1 'x')
00 06 01 00    ; PUSH_CONST (Const 1 '5')
00 09 65       ; ALU (>)
00 0B 00 0E    ; JMP_FALSE +14 bytes (Skip body)
```

## 5. Next Steps (Phase 3)
- **Functions**: Analyze `call` instructions and parameter passing.
- **Strings**: Verify string handling opcodes (concatenation, etc.).
- **API Calls**: Investigate how `extern` functions (like `text()`, `INPAapiJob`) are invoked.
