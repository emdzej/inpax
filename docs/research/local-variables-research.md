# Local Variables Research - Issue #63

> **Status:** Complete  
> **Date:** 2026-02-10  
> **Author:** Research Agent

---

## Executive Summary

This research investigates how local variables in user-defined functions are represented in INPA bytecode. The key discovery is that **local variables use a scope-based addressing scheme** within the existing opcode format, rather than a separate "Local Data" section.

---

## Test Files

### LOCL01.ips — Function with local variable
```c
test_func()
{
    int local_x;
    local_x = 42;
}
```

### LOCL02.ips — Function with parameters + local
```c
add_one(in: int x, out: int result)
{
    int temp;
    temp = x + 1;
    result = temp;
}
```

### LOCL03.ips — Nested functions with locals + global
```c
int global_x;

inner() { int inner_local; inner_local = global_x; }
outer() { int outer_local; outer_local = 1; inner(); }
```

---

## Key Findings

### 1. Function Prologue Opcode (`08 51`)

A new opcode sequence appears at the start of every user-defined function body:

```
[u16: frame_info] 08 51 00 00
```

| File | Function | Frame Info | Notes |
|------|----------|------------|-------|
| LOCL01 | test_func | `05 00` | 1 local var |
| LOCL02 | add_one | `0a 00` | 2 params + 1 local |
| LOCL03 | inner | `05 00` | 1 local var |
| LOCL03 | outer | `07 00` | 1 local var |

**Interpretation:** The frame_info field likely encodes stack frame size in bytes.

### 2. Variable Scope Encoding

The most significant discovery is the **scope-based variable addressing**:

**Format:**
```
[opcode] [scope] [index] 00
```

**Scope Values:**
| Scope Byte | Meaning | Example |
|------------|---------|---------|
| `0x00` | Global variable | `01 00 01 00` = global var #1 |
| `0x01` | Local variable | `01 01 01 00` = local var #1 |
| `0x02` | Function parameter | `01 02 00 00` = param #0 |

**Opcodes:**
| Opcode | Mnemonic | Purpose |
|--------|----------|---------|
| `0x01` | `PUSH_VAR_ADDR` | Push address for writing (L-value) |
| `0x07` | `PUSH_VAR_VAL` | Push value for reading (R-value) |

### 3. No Separate Local Data Section

Unlike global variables which have a dedicated "Global Data" section with type markers, **local variables are NOT stored in any data section**. They exist only:
1. On the stack frame (at runtime)
2. As scope-indexed references in bytecode

### 4. Parameter Handling (in/out/inout)

From LOCL02 analysis:

```c
add_one(in: int x, out: int result)
{
    int temp;
    temp = x + 1;
    result = temp;
}
```

**Parameter indexing:**
- `x` (in param) → scope=0x02, index=0
- `result` (out param) → scope=0x02, index=2
- `temp` (local) → scope=0x01, index=1

**Bytecode pattern for `temp = x + 1`:**
```
01 02 00 00    ; PUSH_VAR_ADDR scope=param idx=0 (x)
01 01 01 00    ; PUSH_VAR_ADDR scope=local idx=1 (temp target)
09 60          ; ALU_OP + (add)
...
05 00          ; STORE
```

**Out parameter assignment uses opcode 0x07:**
```
01 02 02 00    ; PUSH_VAR_ADDR scope=param idx=2 (result)
07 02 01 00    ; PUSH_VAR_VAL scope=param idx=1 (read temp value)
05 00          ; STORE
```

### 5. Global Variable Access (Unchanged)

Global variables in functions use the same scope system with scope=0x00:

From LOCL03 `inner()`:
```
01 00 01 00    ; PUSH_VAR_ADDR scope=global idx=1 (global_x)
```

---

## Bytecode Examples

### LOCL01 - test_func Body
```
Offset  Bytes           Interpretation
------  --------------  --------------------------------
0x1F    05 00           Frame info (5 bytes)
0x21    08 51 00 00     FUNC_PROLOGUE
0x25    01 01 01 00     PUSH_VAR_ADDR local[1] (local_x)
0x29    06 02 00 00     PUSH_CONST idx=2 (42)
0x2D    05 00           STORE
0x2F    01 00           ??? (padding?)
0x31    0e 00 00 00     JMP 0 (return)
```

### LOCL02 - add_one Body (temp = x + 1; result = temp)
```
Offset  Bytes           Interpretation
------  --------------  --------------------------------
0x1F    0a 00           Frame info (10 bytes)
0x21    08 51 00 00     FUNC_PROLOGUE
0x25    01 02 00 00     PUSH_VAR_ADDR param[0] (x)
0x29    01 01 01 00     PUSH_VAR_ADDR local[1] (temp)
0x2D    09 60           ALU_OP + 
0x2F    00 00           ??? 
0x31    06 02 02 00     PUSH_CONST idx=2 (1)
0x35    05 00 01 00     STORE + ???
0x39    01 02 02 00     PUSH_VAR_ADDR param[2] (result)
0x3D    07 02 01 00     PUSH_VAR_VAL param[1] (temp)
0x41    05 00 01 00     STORE + ???
0x45    0e 00 00 00     JMP 0 (return)
```

---

## Comparison with Existing Documentation

### Previously Documented (IPO_Structure.md)
| Opcode | Format | Description |
|--------|--------|-------------|
| `01 [u16]` | `PUSH_VAR_ADDR` | Push global variable address |
| `00 01 [u16]` | `PUSH_VAR_VAL` | Push global variable value |

### New Understanding
The format is actually:
| Opcode | Format | Description |
|--------|--------|-------------|
| `01 [scope] [idx] 00` | `PUSH_VAR_ADDR` | Push variable address (any scope) |
| `07 [scope] [idx] 00` | `PUSH_VAR_VAL` | Push variable value (any scope) |

Where scope: 0x00=global, 0x01=local, 0x02=param

---

## New Opcodes Discovered

| Opcode | Mnemonic | Format | Description |
|--------|----------|--------|-------------|
| `08 51` | `FUNC_PROLOGUE` | `08 51 00 00` | Function entry marker |
| `07` | `PUSH_VAR_VAL` | `07 [scope] [idx] 00` | Read variable value |

---

## Implementation Implications

### For Disassembler
1. Add `FUNC_PROLOGUE` (0x08 0x51) opcode handler
2. Modify variable reference parsing to handle scope byte
3. Add scope labels: `global[N]`, `local[N]`, `param[N]`

### For Interpreter
1. Implement stack frame allocation based on frame_info
2. Handle scope-based variable resolution
3. Parameters passed via dedicated param slots (not stack)

---

## Unanswered Questions

1. **Frame info encoding:** Is `05 00` = 5 bytes, or encoded differently?
2. **Opcode 0x06 variations:** `06 02` vs `06 02 02 00` - what's the difference?
3. **Padding bytes:** `01 00` after STORE - purpose unclear
4. **inout params:** How are they different from out? (need more test cases)

---

## Files Generated

- `/Users/emdzej/Documents/LOCL01.ipo` - Compiled test file 1
- `/Users/emdzej/Documents/LOCL02.ipo` - Compiled test file 2  
- `/Users/emdzej/Documents/LOCL03.ipo` - Compiled test file 3

---

## References

- Issue #63: Research: Local variables in functions
- `docs/IPO_Structure.md` - Existing bytecode documentation
- `docs/reference/language-guide.md` - Language syntax reference
