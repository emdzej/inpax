# INPA.exe Interpreter Analysis

Based on reverse engineering of `ref/INPA.exe.c` (Ghidra decompilation).

## Overview

The INPA VM is a **stack-based virtual machine** that executes 4-byte instructions from compiled `.ipo` files.

### Key Components

| Component | Address | Description |
|-----------|---------|-------------|
| Main Interpreter | `FUN_004607d7` | Opcode dispatch loop |
| ALU Operations | `FUN_00460faf` | Arithmetic/logic operations |
| Type Converter | `FUN_00460f29` | Converts type markers to internal IDs |
| Call Dispatcher | `FUN_0041fc3f` | Distinguishes user vs system calls |
| Stack | `DAT_004a42b0` | Value/reference stack |

## Instruction Format

All instructions are **4 bytes**:

```
[opcode:u8] [type/scope:u8] [index:u16 LE]
```

Reading pattern from decompilation:
```c
opcode = **(uint **)((int)this + 0x10) & 0xff;         // byte 0
type   = **(uint **)((int)this + 0x10) >> 8 & 0xff;   // byte 1  
index  = **(uint **)((int)this + 0x10) >> 0x10;       // bytes 2-3
```

## Opcode Reference (from `FUN_004607d7`)

### Core Instructions

| Opcode | Name | Format | Description |
|--------|------|--------|-------------|
| `0x01` | LOAD | `01 [scope] [index]` | Load value onto stack |
| `0x02` | PUSHREF | `02 [scope] [index]` | Push reference to stack |
| `0x03` | LOADINOUTREF | `03 [scope] [index]` | Load in/out parameter reference |
| `0x04` | NOP | `04 00 00 00` | No operation (skip) |
| `0x05` | MOVE | `05 00 [count]` | Move/store operation |
| `0x06` | PUSHR | `06 [scope] [index]` | Push store target reference |
| `0x07` | PUSHREFSTORE | `07 [scope] [index]` | Push reference for out param |
| `0x08` | ALLOC | `08 [type] 00 00` | Allocate local variable |
| `0x09` | ALU | `09 [op] 00 00` | Arithmetic/logic operation |
| `0x0A` | JMP | `0A 00 [offset]` | Unconditional jump |
| `0x0B` | JMPNZ | `0B 00 [offset]` | Jump if not zero (conditional) |
| `0x0C` | CALL | `0C [target] [id]` | Call function |
| `0x0D` | CALLE | `0D 01 [const_idx]` | Call external DLL |
| `0x0E` | RET | `0E 00 00 00` | Return from function |
| `0x0F` | FRAME | `0F 00 00 00` | Push call frame |
| `0x10` | LOGTABLE | `10 00 [table_id]` | Logic table lookup |
| `0x11` | PUSHIMM | `11 [type] [value]` | Push immediate value |

### Scope Values (byte 1 for LOAD/STORE)

| Scope | Value | Description |
|-------|-------|-------------|
| Global | `0x00` | Global variable |
| Const | `0x01` | Constant pool |
| Local | `0x02` | Local/stack variable |
| Screen | `0x40` | Screen handle |
| Menu | `0x41` | Menu handle |
| StateMachine | `0x42` | State machine handle |

### Type Markers (for ALLOC `0x08`)

From `FUN_00460f29`:

| Marker | Internal | Type |
|--------|----------|------|
| `0x50` | 1 | bool |
| `0x51` | 3 | int (s16) |
| `0x52` | 2 | byte (u8) |
| `0x53` | 4 | long (s32) |
| `0x54` | 5 | real (double) |
| `0x55` | 6 | string |
| `0x56` | 9 | handle? |
| `0x57` | 7 | unknown |

### CALL Targets (byte 1 for `0x0C`)

| Target | Value | Description |
|--------|-------|-------------|
| User | `0x80` | User-defined function |
| System | `0x81` | Built-in system function |

From `FUN_0041fc3f`:
```c
if ((param_1 & 0xff) == 0x80) {
    // User function call - lookup in function table at this+0x38
} else {
    // System function call - lookup in system table at this+0x44
}
```

## ALU Operations (`0x09` sub-opcodes)

From `FUN_00460faf`:

### Arithmetic

| Sub-op | Symbol | Operation |
|--------|--------|-----------|
| `0x60` | `+` | Addition |
| `0x61` | `-` | Subtraction |
| `0x62` | `*` | Multiplication |
| `0x63` | `/` | Division (with div-by-zero check) |
| `0x6D` | `-` | Unary negation |

### Comparison

| Sub-op | Symbol | Operation |
|--------|--------|-----------|
| `0x64` | `<` | Less than |
| `0x65` | `>` | Greater than |
| `0x66` | `<=` | Less or equal |
| `0x67` | `>=` | Greater or equal |
| `0x68` | `==` | Equal |
| `0x69` | `!=` | Not equal |

### Logical

| Sub-op | Symbol | Operation |
|--------|--------|-----------|
| `0x6A` | `&&` | Logical AND |
| `0x6B` | `\|\|` | Logical OR |
| `0x6C` | `^^` | Logical XOR |
| `0x6E` | `!` | Logical NOT |

### Bitwise

| Sub-op | Symbol | Operation |
|--------|--------|-----------|
| `0x6F` | `&` | Bitwise AND |
| `0x70` | `\|` | Bitwise OR |
| `0x71` | `^` | Bitwise XOR |

## Stack Operations

The stack (`DAT_004a42b0`) stores typed values. Each stack entry appears to be a struct:

```c
struct StackEntry {
    int type;       // offset 0: type ID (1-9)
    int flags;      // offset 4: flags/metadata  
    union {         // offset 8: value
        char byte_val;
        short int_val;
        int long_val;
        double real_val;
        char* string_ptr;
    } value;
};
```

Key stack functions:
- `FUN_0045f1ac` - Push value
- `FUN_0045f306` - Push reference
- `FUN_0045eee3` - Pop N entries
- `FUN_0045f843` - Get stack top index
- `FUN_0045f9a7` - Get entry at index
- `FUN_0045fa38` - Pop two operands for binary ops

## Control Flow

### Conditional Jump (`0x0B`)

```c
case 0xb:
    if (*(int *)((int)this + 8) == 0) {
        // condition is FALSE - take jump
        *(uint *)((int)this + 0xc) = **(uint **)((int)this + 0x10) >> 0x10;
    } else {
        // condition is TRUE - continue
        *(int *)((int)this + 0xc) = *(int *)((int)this + 0xc) + 1;
    }
    break;
```

### Unconditional Jump (`0x0A`)

```c
case 10:
    *(uint *)((int)this + 0xc) = **(uint **)((int)this + 0x10) >> 0x10;
    break;
```

Jump target is **absolute instruction index** (not byte offset).

### Return (`0x0E`)

```c
case 0xe:
    FUN_0045f119(&DAT_004a42b0, &saved_ip, &saved_code);
    if (saved_ip == 0) {
        // End of execution
        ip = ip + 1;
    } else {
        // Restore caller's context
        code_ptr = saved_ip;
        ip = saved_code;
        result = 0;
        code_size = FUN_00440180(code_ptr);
        // Pop call frame
        FUN_0045ee95(0x4a42b0);
    }
    break;
```

## Function Calls

### Call Prologue (`0x0F`)

```c
case 0xf:
    FUN_0045ee7c(0x4a42b0);  // Push call frame marker
    ip = ip + 1;
    break;
```

### User Function Call (`0x0C 0x80`)

```c
case 0xc:
    ip = ip + 1;
    target = byte1;  // 0x80 or 0x81
    func_id = index;
    
    call_type = FUN_0041fc3f(&context, target | (func_id << 16), &func_ptr);
    
    if (call_type == 1) {  // User function
        // Save return address
        FUN_0045f06e(&stack, code_ptr, ip);
        // Jump to function
        FUN_00460731(this, func_ptr);
    } else if (call_type == 2) {  // System function
        func_ptr(context, &system_state);
        FUN_0045ee95(0x4a42b0);  // Cleanup
    }
    break;
```

### External DLL Call (`0x0D`)

```c
case 0xd:
    ip = ip + 1;
    const_idx = index;
    
    // Load constant (DLL signature string)
    FUN_0045f1ac(&stack, const_idx);
    
    // Call through import table
    if (PTR_FUN_0048d55c != NULL) {
        PTR_FUN_0048d55c(context, &system_state);
    }
    FUN_0045ee95(0x4a42b0);
    break;
```

## VM State Structure

The interpreter maintains state in `this` pointer:

| Offset | Field | Description |
|--------|-------|-------------|
| `0x04` | code_size | Size of current code block |
| `0x08` | result | Last comparison/condition result |
| `0x0C` | ip | Instruction pointer (index) |
| `0x10` | code_ptr | Pointer to instruction data |
| `0x14` | block_ptr | Pointer to current block |

## Execution Loop

```c
undefined4 FUN_004607d7(void *this, int context) {
    while (ip < code_size) {
        instruction = FUN_00462100(code_ptr, ip);
        *(this) = instruction;
        
        switch (instruction & 0xff) {
            case 0x01: /* LOAD */ ...
            case 0x02: /* PUSHREF */ ...
            // ... etc
        }
    }
    return result;
}
```

## Key Global Variables

| Address | Name | Purpose |
|---------|------|---------|
| `DAT_004a42b0` | Stack | Value/reference stack |
| `DAT_0049ff18` | Context | Execution context |
| `DAT_004a3f08` | SavedState | Saved execution state |
| `DAT_0048d4e8` | Mode | Execution mode flag |
| `DAT_004a0024` | ErrorFlag | Error handling flag |

## Error Handling

Division by zero (opcode `0x63`):
```c
if (divisor == 0) {
    if (DAT_004a0024 == 0) {
        FUN_0045d76e((void*)0x0, 400);  // Error code 400
    }
}
```

## Related Functions

| Function | Purpose |
|----------|---------|
| `FUN_00460731` | Jump to function |
| `FUN_00440180` | Get code block size |
| `FUN_0045dac6` | Create typed value |
| `FUN_0045dcae` | Convert value type |
| `FUN_0045d76e` | Raise error |
| `FUN_00462100` | Read instruction at offset |

---

*Document generated from INPA.exe.c decompilation analysis*
