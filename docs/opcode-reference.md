# IPO Opcode Reference

Complete reference for INPA VM opcodes based on `FUN_004607d7` decompilation.

## Instruction Format

```
┌─────────┬─────────┬─────────────────┐
│ Opcode  │  Type   │     Index       │
│  (u8)   │  (u8)   │    (u16 LE)     │
├─────────┼─────────┼────────┬────────┤
│ byte 0  │ byte 1  │ byte 2 │ byte 3 │
└─────────┴─────────┴────────┴────────┘
```

Reading in C:
```c
uint32_t instr = *(uint32_t*)code_ptr;
uint8_t  opcode = instr & 0xFF;
uint8_t  type   = (instr >> 8) & 0xFF;
uint16_t index  = instr >> 16;
```

---

## Scope Values (byte 1 for LOAD/PUSH operations)

| Value | Name | Description |
|-------|------|-------------|
| `0x00` | GLOBAL | Global variable pool |
| `0x01` | CONST | Constant pool |
| `0x02` | LOCAL | Local variable (stack frame relative) |
| `0x40` | SCREEN | Screen UI handle |
| `0x41` | MENU | Menu UI handle |
| `0x42` | STATE | State machine handle |

---

## 0x01 — LOAD

**Format:** `01 [scope] [index:u16]`

**Operation:** Load value from variable pool onto stack (by copy).

```
Stack: [...] → [..., value]
```

**Pseudocode:**
```c
case 0x01:
    scope = byte1;
    index = bytes23;
    
    if (scope == 0x02) {  // LOCAL
        // Index relative to current stack frame
        var = stack.locals[frame_base + index];
    } else {
        // GLOBAL (0) or CONST (1)
        var = pools[scope][index];
    }
    
    stack.push(copy_of(var));
    ip++;
```

**Example:**
```
01 01 00 00  ; Load constant #0
01 02 01 00  ; Load local variable #1
01 00 05 00  ; Load global variable #5
```

---

## 0x02 — PUSHREF

**Format:** `02 [scope] [index:u16]`

**Operation:** Push reference to variable onto stack (not a copy).

```
Stack: [...] → [..., &variable]
```

**Pseudocode:**
```c
case 0x02:
    scope = byte1;
    index = bytes23;
    
    if (scope == 0x02) {  // LOCAL
        // Adjust index by current frame offset
        index += frame_offset;
    }
    
    stack.push(reference_to(pools[scope], index));
    ip++;
```

**Use case:** Used before CALL to pass arguments by reference (out parameters).

**Example:**
```
02 02 00 00  ; Push reference to local #0
```

---

## 0x03 — LOADINOUTREF

**Format:** `03 [scope] [index:u16]`

**Operation:** Load in/out parameter reference (for bidirectional parameters).

```
Stack: [...] → [..., &inout_param]
```

**Pseudocode:**
```c
case 0x03:
    ref = resolve_inout_param(scope, index);
    stack.push(ref);
    ip++;
```

---

## 0x04 — NOP

**Format:** `04 00 00 00`

**Operation:** No operation, skip to next instruction.

```
Stack: unchanged
```

**Pseudocode:**
```c
case 0x04:
    ip++;
```

---

## 0x05 — MOVE (Store/Assign)

**Format:** `05 00 [count:u16]`

**Operation:** Pop value(s) from stack and store to target. If top-of-stack is bool, also updates VM condition flag.

```
Stack: [..., target_ref, value] → [...]
```

**Pseudocode:**
```c
case 0x05:
    count = bytes23;
    
    // Get top of stack (the value to store)
    top = stack.peek();
    
    // If it's a boolean, update condition register
    if (top.type == BOOL) {
        vm.condition = top.value;
    }
    
    // Pop 'count' items (performs the assignment)
    stack.pop(count);
    ip++;
```

**Example:**
```
; Sequence: push target ref, push value, MOVE
02 02 00 00  ; Push ref to local #0 (target)
01 01 00 00  ; Push const #0 (value)
05 00 02 00  ; MOVE - pop 2 items, assign value to target
```

---

## 0x06 — PUSHR (Push Store Target)

**Format:** `06 [scope] [index:u16]`

**Operation:** Push reference as store target (left-hand side of assignment).

```
Stack: [...] → [..., &store_target]
```

**Pseudocode:**
```c
case 0x06:
    ref = resolve_variable(scope, index);
    stack.push_store_target(ref);
    ip++;
```

---

## 0x07 — PUSHREFSTORE

**Format:** `07 [scope] [index:u16]`

**Operation:** Push reference for out parameter store target.

```
Stack: [...] → [..., &out_param]
```

---

## 0x08 — ALLOC (Allocate Local Variable)

**Format:** `08 [type] 00 00`

**Operation:** Allocate local variable of specified type with default value.

```
Stack: [...] → [..., new_local]
```

**Type markers:**

| Byte 1 | Type | Default Value |
|--------|------|---------------|
| `0x50` | bool | `false` (0) |
| `0x51` | int (s16) | `0` |
| `0x52` | byte (u8) | `0` |
| `0x53` | long (s32) | `0` |
| `0x54` | real (f64) | `0.0` |
| `0x55` | string | `""` (empty) |
| `0x56` | handle | `null` |
| `0x57` | array? | `null` |

**Pseudocode:**
```c
case 0x08:
    type_marker = byte1;
    internal_type = convert_type(type_marker);  // 0x50→1, 0x51→3, etc.
    
    switch (internal_type) {
        case 1: value = false; break;       // bool
        case 2: value = (byte)0; break;     // byte
        case 3: value = (short)0; break;    // int
        case 4: value = (int)0; break;      // long
        case 5: value = 0.0; break;         // real
        case 6: value = ""; break;          // string
        default: value = null;
    }
    
    local = create_typed_value(internal_type, value);
    stack.push(local);
    ip++;
```

**Example:**
```
08 51 00 00  ; Allocate local int variable
08 55 00 00  ; Allocate local string variable
```

---

## 0x09 — ALU (Arithmetic/Logic Operation)

**Format:** `09 [op] 00 00`

**Operation:** Perform arithmetic or logical operation on stack operands.

### Binary Operations (pop 2, push 1)

| Op | Symbol | Operation |
|----|--------|-----------|
| `0x60` | `+` | Addition |
| `0x61` | `-` | Subtraction |
| `0x62` | `*` | Multiplication |
| `0x63` | `/` | Division |
| `0x64` | `<` | Less than |
| `0x65` | `>` | Greater than |
| `0x66` | `<=` | Less or equal |
| `0x67` | `>=` | Greater or equal |
| `0x68` | `==` | Equal |
| `0x69` | `!=` | Not equal |
| `0x6A` | `&&` | Logical AND |
| `0x6B` | `\|\|` | Logical OR |
| `0x6C` | `^^` | Logical XOR |
| `0x6F` | `&` | Bitwise AND |
| `0x70` | `\|` | Bitwise OR |
| `0x71` | `^` | Bitwise XOR |

### Unary Operations (pop 1, push 1)

| Op | Symbol | Operation |
|----|--------|-----------|
| `0x6D` | `-` | Negation |
| `0x6E` | `!` | Logical NOT |

**Pseudocode (binary):**
```c
case 0x09:
    op = byte1;
    
    // Pop two operands
    rhs = stack.pop();
    lhs = stack.peek();  // Result stored in-place
    
    switch (op) {
        case 0x60: lhs.value = lhs.value + rhs.value; break;
        case 0x61: lhs.value = lhs.value - rhs.value; break;
        case 0x62: lhs.value = lhs.value * rhs.value; break;
        case 0x63:
            if (rhs.value == 0) {
                raise_error(400);  // Division by zero
            } else {
                lhs.value = lhs.value / rhs.value;
            }
            break;
        case 0x64: lhs.value = lhs.value < rhs.value; break;
        // ... etc
    }
    
    // For comparisons, update condition register
    if (is_comparison(op)) {
        vm.condition = lhs.value;
    }
    
    stack.pop(1);  // Remove rhs, lhs remains with result
    ip++;
```

**Example:**
```
; Compute a + b
01 02 00 00  ; LOAD local #0 (a)
01 02 01 00  ; LOAD local #1 (b)
09 60 00 00  ; ALU ADD
```

---

## 0x0A — JMP (Unconditional Jump)

**Format:** `0A 00 [target:u16]`

**Operation:** Jump to instruction at absolute index.

```
Stack: unchanged
```

**Pseudocode:**
```c
case 0x0A:
    ip = bytes23;  // Absolute instruction index
```

**Note:** Target is instruction index, not byte offset.

**Example:**
```
0A 00 05 00  ; Jump to instruction #5
```

---

## 0x0B — JMPNZ (Jump If Not Zero / Conditional Jump)

**Format:** `0B 00 [target:u16]`

**Operation:** Jump to target if condition register is zero (false). Otherwise continue.

```
Stack: unchanged
```

**Pseudocode:**
```c
case 0x0B:
    if (vm.condition == 0) {
        ip = bytes23;  // Take jump (condition was FALSE)
    } else {
        ip++;  // Continue (condition was TRUE)
    }
```

**Note:** This is "jump if FALSE" — used for `if` statements where we skip the body when condition fails.

**Example:**
```
; if (x > 0) { ... }
01 02 00 00  ; LOAD x
01 01 00 00  ; LOAD const 0
09 65 00 00  ; ALU GT (x > 0), sets condition
0B 00 0A 00  ; JMPNZ #10 - skip if condition is FALSE
; ... if body ...
```

---

## 0x0C — CALL (Function Call)

**Format:** `0C [target] [func_id:u16]`

**Target values:**
- `0x80` — User-defined function
- `0x81` — Built-in system function

**Operation:** Call function by ID.

```
Stack (before): [..., arg1, arg2, ...]
Stack (after):  [..., result] (for functions with return value)
```

**Pseudocode:**
```c
case 0x0C:
    target = byte1;
    func_id = bytes23;
    ip++;  // Pre-increment (return address points to next instruction)
    
    if (target == 0x80) {
        // User function call
        stack.push_return_address(code_ptr, ip);
        jump_to_function(func_id);
    } else {
        // System function call (0x81)
        func_ptr = system_functions[func_id];
        func_ptr(context);
        stack.cleanup_args();
    }
```

**Example:**
```
0F 00 00 00  ; FRAME (call prologue)
02 02 00 00  ; PUSHREF local #0 (argument)
0C 80 04 00  ; CALL user function #4
```

---

## 0x0D — CALLE (External DLL Call)

**Format:** `0D 01 [const_idx:u16]`

**Operation:** Call external DLL function. Constant at index contains the import signature.

```
Stack: [..., args...] → [..., result]
```

**Pseudocode:**
```c
case 0x0D:
    const_idx = bytes23;
    ip++;
    
    // Push the import signature constant
    stack.push(constants[const_idx]);
    
    // Call through import32 handler
    if (import32_handler != null) {
        import32_handler(context);
    }
    
    stack.cleanup_args();
```

**Import signature format:** `"dllname:funcname"` stored as string constant.

---

## 0x0E — RET (Return)

**Format:** `0E 00 00 00`

**Operation:** Return from current function. Restore caller's execution context.

```
Stack: [..., return_value] → [..., return_value] (in caller's frame)
```

**Pseudocode:**
```c
case 0x0E:
    // Pop return address from call stack
    (saved_code_ptr, saved_ip) = stack.pop_return_address();
    
    if (saved_code_ptr == 0) {
        // No caller - end of execution
        ip++;
    } else {
        // Restore caller's context
        code_ptr = saved_code_ptr;
        ip = saved_ip;
        code_size = get_block_size(code_ptr);
        vm.condition = 0;
        stack.pop_frame();
    }
```

---

## 0x0F — FRAME (Call Frame Setup)

**Format:** `0F 00 00 00`

**Operation:** Push call frame marker. Used before CALL to mark the stack boundary.

```
Stack: [...] → [..., <frame_marker>]
```

**Pseudocode:**
```c
case 0x0F:
    stack.push_frame_marker();
    ip++;
```

**Typical sequence:**
```
0F 00 00 00  ; FRAME - mark call boundary
02 02 00 00  ; PUSHREF arg1
01 02 01 00  ; LOAD arg2
0C 80 04 00  ; CALL function #4
```

---

## 0x10 — LOGTABLE (Logic Table Lookup)

**Format:** `10 00 [table_id:u16]`

**Operation:** Execute logic table by ID.

```
Stack: depends on table
```

**Pseudocode:**
```c
case 0x10:
    table_id = bytes23;
    ip++;
    
    table = lookup_logic_table(table_id);
    execute_logic_table(table);
```

---

## 0x11 — PUSHIMM (Push Immediate)

**Format:** `11 [type] [value:u16]`

**Operation:** Push immediate value directly (no constant pool lookup).

**Type encoding:**
| Byte 1 | Type | Value interpretation |
|--------|------|---------------------|
| `0x50` | bool | `bytes23` as 0/1 |
| `0x51` | int | `bytes23` as signed 16-bit |
| `0x52` | byte | `byte2` as unsigned 8-bit |
| `0x53` | long | `bytes23` as signed 16-bit (extended to 32) |

```
Stack: [...] → [..., immediate_value]
```

**Pseudocode:**
```c
case 0x11:
    type = byte1;
    
    switch (type) {
        case 0x50:  // bool
            value = bytes23;
            break;
        case 0x51:  // int (s16)
            value = (int16_t)bytes23;
            break;
        case 0x52:  // byte
            value = byte2;
            break;
        case 0x53:  // long
            value = bytes23;
            break;
    }
    
    local = create_typed_value(convert_type(type), value);
    stack.push(local);
    ip++;
```

**Example:**
```
11 50 01 00  ; Push bool TRUE
11 51 2A 00  ; Push int 42
```

---

## Execution Flow Example

**IPS source:**
```c
test() {
    int x;
    x = 10 + 5;
}
```

**Compiled IPO:**
```
08 51 00 00  ; ALLOC int (local x)
06 02 00 00  ; PUSHR local #0 (store target = x)
11 51 0A 00  ; PUSHIMM int 10
11 51 05 00  ; PUSHIMM int 5
09 60 00 00  ; ALU ADD (10 + 5 = 15)
05 00 02 00  ; MOVE (x = 15)
0E 00 00 00  ; RET
```

**Stack trace:**
```
                    ; Stack: []
08 51 00 00         ; Stack: [x:int=0]
06 02 00 00         ; Stack: [x:int=0, &x]
11 51 0A 00         ; Stack: [x:int=0, &x, 10]
11 51 05 00         ; Stack: [x:int=0, &x, 10, 5]
09 60 00 00         ; Stack: [x:int=0, &x, 15]
05 00 02 00         ; Stack: [x:int=15]
0E 00 00 00         ; Return
```

---

## VM State Summary

| Register | Offset | Description |
|----------|--------|-------------|
| code_size | `this+0x04` | Size of current code block |
| condition | `this+0x08` | Last comparison result (0 or non-zero) |
| ip | `this+0x0C` | Instruction pointer (index) |
| code_ptr | `this+0x10` | Pointer to current instruction |
| block_ptr | `this+0x14` | Pointer to code block base |

---

*Reference: INPA.exe decompilation, function FUN_004607d7*
