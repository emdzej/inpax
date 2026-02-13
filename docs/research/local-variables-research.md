# Local Variables in INPA Functions - Research Findings

> **Status:** Complete  
> **Date:** 2026-02-10  
> **Issue:** #63

## Summary

Local variables in INPA functions use a **scope-based addressing scheme** where each variable access opcode includes a scope byte to distinguish between global variables, local variables, and function parameters.

## Key Findings

### 1. Variable Scope Encoding

Variable access opcodes (`01` for address, `07` for value) use a 4-byte format:

```
[opcode] [scope] [index] 00
```

| Scope Byte | Meaning | Example |
|------------|---------|---------|
| `0x00` | Global variable | `01 00 05 00` = address of global[5] |
| `0x01` | Local variable | `01 01 01 00` = address of local[1] |
| `0x02` | Function parameter | `01 02 00 00` = address of param[0] |

### 2. Opcodes

| Opcode | Format | Mnemonic | Description |
|--------|--------|----------|-------------|
| `01` | `01 [scope] [idx] 00` | `PUSH_VAR_ADDR` | Push variable address (for assignment LHS) |
| `07` | `07 [scope] [idx] 00` | `PUSH_VAR_VAL` | Push variable value (for reading) |

### 3. Variable Indexing

**Local Variables:**

- Index starts at **1** (not 0)
- LOCAL[0] appears to be reserved (possibly for return value or frame management)
- Each declared local gets the next available index

**Function Parameters:**

- Index starts at **0**
- Parameters appear in order: first `in` param, then `out` params
- There may be hidden slots between in/out params (observed PARAM[1] gap in `add_one`)

**Global Variables:**

- Index starts at **0**
- Indices correspond to order in Global Data section

### 4. Function Frame Structure

User-defined functions have a frame info field before the prologue:

```
[func_name]\n [func_id u16] [type u16] 0a 0a 00 [frame_size u16] 08 51 00 00 [bytecode...]
```

**Frame Size Calculation:**

- Base size: 3 bytes (likely return address + frame pointer)
- +2 bytes per local variable (int = 2 bytes)
- +2 bytes per parameter slot
- +2 bytes if function makes calls (observed pattern)

**Observed Frame Sizes:**

| Function | Locals | Params | Calls | Frame Size | Formula |
|----------|--------|--------|-------|------------|---------|
| test_func | 1 | 0 | N | 5 | 3 + 2*1 = 5 ✓ |
| inner | 1 | 0 | N | 5 | 3 + 2*1 = 5 ✓ |
| outer | 1 | 0 | Y | 7 | 3 + 2*1 + 2 = 7 ✓ |
| add_one | 1 | 2 | N | 10 | 3 + 2*1 + 2*3 = 11 ✗ |
| inpainit | 0-1 | 0 | Y | 3-6 | varies |

Note: The add_one frame size calculation suggests additional complexity in parameter handling that requires further investigation.

### 5. Function Prologue

User-defined functions start with `08 51 00 00` (FUNC_PROLOGUE) marker.

System functions (`inpainit`, `inpaexit`) may or may not have this marker depending on whether they have local variables.

### 6. No Separate "Local Data" Section

Local variables are **NOT** stored in a separate section like Global Data. Instead:

- Global Data section only contains global variable types
- Local variable storage is implicit in the stack frame
- Frame size in function header determines stack allocation

## Test Files Analyzed

### LOCL01.ips

```c
test_func() {
    int local_x;
    local_x = 42;
}
```

- LOCAL[1] access confirmed
- Frame size: 5 bytes

### LOCL02.ips  

```c
add_one(in: int x, out: int result) {
    int temp;
    temp = x + 1;
    result = temp;
}
```

- PARAM[0] = x (input)
- PARAM[1] = hidden slot (?)
- PARAM[2] = result (output)
- LOCAL[1] = temp
- Frame size: 10 bytes

### LOCL03.ips

```c
int global_x;

inner() {
    int inner_local;
    inner_local = global_x;
}

outer() {
    int outer_local;
    outer_local = 1;
    inner();
}
```

- Global access: GLOBAL[1] for global_x
- Each function has independent LOCAL[1] for its local
- Nested calls work correctly with separate frames

## Bytecode Examples

### Assignment to Local Variable

Source: `local_x = 42;`

```hex
01 01 01 00    ; PUSH_VAR_ADDR LOCAL[1]
00 06 02 00    ; PUSH_CONST[2] (value 42 from constant table)
00 05          ; STORE
```

### Reading Parameter

Source: `temp = x + 1;`

```hex
01 01 01 00    ; PUSH_VAR_ADDR LOCAL[1] (temp)
07 02 00 00    ; PUSH_VAR_VAL PARAM[0] (x)
00 06 01 00    ; PUSH_CONST[1] (value 1)
00 09 60       ; ALU_OP (+)
00 05          ; STORE
```

### Global Variable Access from Function

Source: `inner_local = global_x;`

```hex
01 01 01 00    ; PUSH_VAR_ADDR LOCAL[1] (inner_local)
07 00 01 00    ; PUSH_VAR_VAL GLOBAL[1] (global_x)  -- Note: scope 0x00!
00 05          ; STORE
```

## Implementation Notes

### For Disassembler

1. Parse scope byte in opcodes 0x01 and 0x07
2. Display scope name: `G[n]` for global, `L[n]` for local, `P[n]` for param
3. Consider LOCAL[0] as reserved/return value

### For Compiler

1. Track separate indices for each scope
2. Calculate frame size based on locals + params + call requirements
3. Generate scope-qualified variable references

## Open Questions

1. **What is LOCAL[0] used for?** Never accessed in test files - possibly reserved for return value or frame linkage.

2. **Why is PARAM[1] skipped in add_one?** The gap between in/out params suggests hidden slot, possibly for bidirectional data flow or caller context.

3. **Exact frame size formula?** The formula `3 + 2*locals + 2*params` works for simple cases but `add_one` with 10 bytes doesn't fit. May need more test cases with different param combinations.

## Conclusion

The INPA VM uses a straightforward scope-based addressing scheme:

- Scope byte in each variable access opcode
- 0x00 = global, 0x01 = local, 0x02 = param
- Stack frames sized according to local/param count
- No dynamic allocation - frame size is compile-time constant

This enables efficient stack-based execution while maintaining separation between global state and function-local state.
