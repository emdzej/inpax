# Local Variables Research

> **Issue:** #63  
> **Status:** Complete  
> **Date:** 2026-02-10  
> **Researcher:** Marek (via subagent)

## Executive Summary

Local variables in INPA bytecode are **NOT stored in Global Data**. Instead:

1. Functions with local variables emit a **ENTER_LOCAL_FRAME** instruction at the start
2. Variable references use a **scope byte** (high byte of index) to distinguish:
   - `0x00` = Global variable
   - `0x01` = Local variable
   - `0x02` = Function parameter
3. OUT parameters use a special **DEREF_OUT_PARAM** opcode (`0x07`)

## Test Files Compiled

| File | Source | Description |
|------|--------|-------------|
| LOCL01.ipo | `test_func() { int local_x; local_x = 42; }` | Simple local variable |
| LOCL02.ipo | `add_one(in: int x, out: int result) { int temp; ... }` | Parameters + local |
| LOCL03.ipo | Nested functions with global + locals | Scope interaction |

## Key Findings

### 1. Local Frame Initialization

Functions with local variables start with:
```
XX 00 08 51 00 00
```

Where `XX` seems to encode frame info (possibly size or flags). The `08 51` pattern (`0x51` = 'Q') is a marker.

**Examples observed:**
- `05 00 08 51 00 00` - test_func with 1 local
- `0a 00 08 51 00 00` - add_one with 2 params + 1 local  
- `06 00 08 51 00 00` - inpainit with 1 local
- `07 00 08 51 00 00` - outer with 1 local

Functions **without** local variables (like `inpaexit`) do NOT have this sequence.

### 2. Variable Scope Encoding

Variable indices are 16-bit, with the high byte indicating scope:

| High Byte | Scope | Example |
|-----------|-------|---------|
| `0x00` | Global variable | `01 00 00` = PUSH_ADDR global[0] |
| `0x01` | Local variable | `01 01 01` = PUSH_ADDR local[1] |
| `0x02` | Function parameter | `01 02 02` = PUSH_ADDR param[2] |

### 3. New Opcodes Discovered

#### `0x07` - DEREF_OUT_PARAM
Used to get the target address for OUT parameter assignment:
```
07 02 01 = DEREF_OUT_PARAM param[2], scope=01
```

This dereferences the pointer passed for an OUT parameter so you can store a value there.

#### `0x0F` - CALL_PREPARE (tentative)
Appears before function calls that pass arguments:
```
0f 00 00 00 = CALL_PREPARE
```

May initialize the argument passing mechanism.

### 4. Global Data Section

**IMPORTANT:** The Global Data section only contains **global variables**, not locals or parameters.

| File | Global Count | Variables |
|------|--------------|-----------|
| LOCL01.ipo | 1 | (implicit from inpa.h?) |
| LOCL02.ipo | 1 | (implicit from inpa.h?) |
| LOCL03.ipo | 2 | global_x + 1 from inpa.h |

### 5. Parameter Passing Convention

For a function call like `add_one(5, val)`:

1. `0F 00 00 00` - CALL_PREPARE
2. `01 01 02` - PUSH_PARAM_ADDR of val (for OUT param, pass address)
3. `02 02 00 00` - PUSH constant 5 (for IN param, pass value)
4. `0C 80 04 00` - CALL_USER add_one

**IN parameters:** passed by value  
**OUT/INOUT parameters:** passed by address

## Bytecode Analysis

### LOCL01 - Simple Local

Source:
```c
test_func() {
    int local_x;
    local_x = 42;
}
```

Bytecode:
```
05 00 08 51 00 00  ; ENTER_LOCAL_FRAME(5)
01 01 01           ; PUSH_LOCAL_ADDR local[1]
06 02 00           ; PUSH_CONST const[2] (=42)
05 00 01           ; STORE
0e 00 00 00        ; RET
```

### LOCL02 - Parameters + Local

Source:
```c
add_one(in: int x, out: int result) {
    int temp;
    temp = x + 1;
    result = temp;
}
```

Bytecode:
```
0a 00 08 51 00 00  ; ENTER_LOCAL_FRAME(10)
01 02 00           ; PUSH_GLOBAL_ADDR ??? (misparse?)
01 01 01           ; PUSH_LOCAL_ADDR local[1] (temp)
09 60 00           ; ALU_ADD
06 02 02           ; PUSH_PARAM_VAL param[2] (x)
05 00 01           ; STORE to temp
01 02 02           ; PUSH_PARAM_ADDR param[2]
07 02 01           ; DEREF_OUT_PARAM - get result's target
05 00 01           ; STORE
0e 00 00 00        ; RET
```

## Implications for Disassembler

### Required Updates

1. **Add scope-aware variable display:**
   - Parse high byte of index to determine scope
   - Show `global[N]`, `local[N]`, or `param[N]`

2. **New opcodes to implement:**
   - `0x07` - DEREF_OUT_PARAM
   - `0x0F` - CALL_PREPARE (tentative)

3. **Local frame tracking:**
   - Detect `XX 00 08 51 00 00` pattern
   - Track local variable count per function

4. **Parameter parsing:**
   - Distinguish IN (by value) vs OUT/INOUT (by reference)

### Section Preamble Interpretation

The first byte of section preamble appears to encode something about locals:
- `04 00 00 00 0a 0a 00` - function with locals
- `02 00 00 00 0a 0a 00` - inpainit (with local `val`)
- `03 00 00 00 0a 0a 00` - inpaexit (no locals)
- `00 00 00 00 0a 0a 00` - __inpa_startup__ (system func)

## Open Questions

1. **Frame size calculation:** How is the `XX` in `XX 00 08 51` computed? It doesn't directly match local count.

2. **Stack layout:** Exact memory layout of locals vs params on stack.

3. **`0x51` marker:** Why 'Q'? Historical artifact or mnemonic?

4. **INOUT semantics:** Are they identical to OUT at bytecode level?

## Conclusion

Local variables in INPA use a **scope byte** mechanism rather than separate sections. This is efficient and allows the VM to use a simple stack frame model. The Global Data section truly only contains globals.

The key insight is that the **same opcodes** (`01` PUSH_ADDR, `05` STORE, `06` PUSH_VAL) work for all variable types - the scope byte in the index tells the VM where to look.

---

## Appendix: Raw Bytecode Dumps

### LOCL01.ipo (239 bytes)
```
test_func bytecode: 0500085100000101010006020000050001000e000000
inpainit bytecode:  03000f0000000c8004000e000000
```

### LOCL02.ipo (272 bytes)
```
add_one bytecode:  0a000851000001020000010101000960000006020200050001000102020007020100050001000e000000
inpainit bytecode: 0600085100000f00000001010200020200000c8004000e000000
```

### LOCL03.ipo (295 bytes)
```
inner bytecode:    0500085100000100010006020000050001000e000000
outer bytecode:    0700085100000101010006020000050001000f0000000c8004000e000000
inpainit bytecode: 06000101020006000100050001000f0000000c8005000e000000
```
