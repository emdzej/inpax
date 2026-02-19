# INPA VM Internal Functions Reference

Detailed documentation of internal functions used by the INPA interpreter.

## Data Structures

### Stack Entry (`StackEntry`)

Each value on the stack is a 24-byte (0x18) structure:

```c
struct StackEntry {
    int32_t  type;      // +0x00: Type ID
    int32_t  flags;     // +0x04: Flags (1=value, 2=reference)
    union {             // +0x08: Value storage
        int8_t   byte_val;
        int16_t  int_val;
        int32_t  long_val;
        double   real_val;    // Uses +0x08 and +0x0C
        char*    string_ptr;  // Pointer to string data
    } value;
    int32_t  ref_info;  // +0x10: Reference info (scope | index<<16)
};
```

**Type IDs:**

| ID | Type | Size | Description |
|----|------|------|-------------|
| 1 | bool | 1 byte | Boolean (0/1) |
| 2 | byte | 1 byte | Unsigned 8-bit |
| 3 | int | 2 bytes | Signed 16-bit |
| 4 | long | 4 bytes | Signed 32-bit |
| 5 | real | 8 bytes | Double-precision float |
| 6 | string | ptr | Pointer to heap string |
| 7 | array? | ptr | Unknown array type |
| 8 | handle | 4 bytes | UI handle |
| 9 | handle2 | ptr | Another handle type |

### VM State (`VMState`)

```c
struct VMState {
    void*    vtable;       // +0x00: Virtual table pointer
    int32_t  code_size;    // +0x04: Size of current code block
    int32_t  condition;    // +0x08: Last comparison result
    int32_t  ip;           // +0x0C: Instruction pointer (index)
    uint32_t* code_ptr;    // +0x10: Pointer to current instruction
    void*    block_ptr;    // +0x14: Code block base pointer
};
```

### Execution Context (`ExecContext`)

```c
struct ExecContext {
    // ... (0x00 - 0x187)
    void*    global_vars;  // +0x188: Global variable pool (+0x1C = array)
    void*    const_pool;   // +0x18C: Constant pool (+0x1C = array)
    void*    local_vars;   // +0x190: Local/stack vars (+0x1C = array)
    void*    stack;        // +0x194: Value stack (+0x1C = array)
    int32_t  frame_offset; // +0x198: Current stack frame offset
};
```

---

## Array Operations

### `FUN_00421080` — Get Array Count

**Signature:** `int __fastcall FUN_00421080(int arr)`

**Purpose:** Returns the number of elements in the array (count - 1 for last index).

```c
int FUN_00421080(int arr) {
    return *(int*)(arr + 4) - 1;  // arr[4] is count, return last valid index
}
```

**Usage:**
```c
int top_index = FUN_00421080(stack.array);  // Get stack top index
```

---

### `FUN_0041db30` — Get Array Element

**Signature:** `void* __thiscall FUN_0041db30(void* arr, int index)`

**Purpose:** Returns pointer to element at given index.

```c
void* FUN_0041db30(void* arr, int index) {
    return (void*)*(int*)(*(int*)arr + index * 4);  // arr[0][index]
}
```

**Usage:**
```c
StackEntry* entry = FUN_0041db30(stack.array, index);
```

---

### `FUN_0041d5d0` — Get Array Element (alternate)

**Signature:** `void* __thiscall FUN_0041d5d0(void* arr, int index)`

**Purpose:** Similar to `FUN_0041db30`, used for different array types.

---

### `FUN_00464e98` — Append to Array

**Signature:** `void __thiscall FUN_00464e98(void* arr, void* element)`

**Purpose:** Adds element to end of array (push operation).

---

## Stack Operations

### `FUN_0045f843` — Get Stack Top Index

**Signature:** `int __fastcall FUN_0045f843(int context)`

**Purpose:** Returns the index of the top element on the stack.

```c
int FUN_0045f843(int context) {
    void* stack = *(void**)(context + 0x194);
    void* array = *(void**)(stack + 0x1C);
    return FUN_00421080(array);  // count - 1
}
```

**Usage:**
```c
int top = FUN_0045f843(context);  // Get top index
// Returns -1 if stack is empty
```

---

### `FUN_0045f9a7` — Get Stack Entry by Index

**Signature:** `StackEntry* __thiscall FUN_0045f9a7(void* context, int index)`

**Purpose:** Returns the stack entry at the given index.

```c
StackEntry* FUN_0045f9a7(void* context, int index) {
    void* stack = *(void**)(context + 0x194);
    void* array = *(void**)(stack + 0x1C);
    return (StackEntry*)FUN_0041db30(array, index);
}
```

**Usage:**
```c
StackEntry* entry = FUN_0045f9a7(context, top_index);
int value = entry->value.long_val;
```

---

### `FUN_0045fa38` — Pop Two Operands (Binary Op)

**Signature:** `uint __thiscall FUN_0045fa38(void* context, void** out_rhs, void** out_lhs)`

**Purpose:** Gets the top two stack entries for binary operations (without removing them).

```c
uint FUN_0045fa38(void* context, void** out_rhs, void** out_lhs) {
    int top = FUN_00421080(stack.array);
    
    if (top <= 0) {
        *out_rhs = NULL;
        *out_lhs = NULL;
        return 0;  // Failure
    }
    
    *out_rhs = FUN_0041db30(stack.array, top);      // Top of stack
    *out_lhs = FUN_0041db30(stack.array, top - 1);  // Second from top
    return 1;  // Success
}
```

**Note:** Result is stored in `out_lhs` (the second operand), then `FUN_0045eee3(1)` pops one element.

---

### `FUN_0045fb30` — Pop Three Operands (Ternary Op)

**Signature:** `uint __thiscall FUN_0045fb30(void* context, void** a, void** b, void** c)`

**Purpose:** Gets top three stack entries.

---

### `FUN_0045eee3` — Pop N Elements

**Signature:** `void __thiscall FUN_0045eee3(void* context, int count)`

**Purpose:** Removes `count` elements from the top of the stack.

```c
void FUN_0045eee3(void* context, int count) {
    void* stack = *(void**)(context + 0x194);
    FUN_0045e43e(stack, count);  // Internal pop
}
```

**Usage:**
```c
FUN_0045eee3(context, 2);  // Pop 2 items
```

---

### `FUN_0045ee7c` — Push Frame Marker

**Signature:** `void __fastcall FUN_0045ee7c(int context)`

**Purpose:** Pushes a call frame marker onto the stack. Used before CALL to mark the boundary between caller and callee stack frames.

```c
void FUN_0045ee7c(int context) {
    void* stack = *(void**)(context + 0x194);
    FUN_0045e316(stack);  // Push frame marker
}
```

---

### `FUN_0045ee95` — Pop Frame / Cleanup

**Signature:** `void __fastcall FUN_0045ee95(int context)`

**Purpose:** Pops the current call frame, restoring previous frame state.

```c
void FUN_0045ee95(int context) {
    void* stack = *(void**)(context + 0x194);
    FUN_0045e348(stack);  // Pop frame
    // Update frame_offset from popped frame
    *(int*)(context + 0x198) = *(int*)(stack + 0x3C);
}
```

---

### `FUN_0045f06e` — Push Return Address

**Signature:** `void __thiscall FUN_0045f06e(void* context, void* code_ptr, int ip)`

**Purpose:** Saves the return address (code pointer and instruction index) onto the call stack.

```c
void FUN_0045f06e(void* context, void* code_ptr, int ip) {
    void* stack = *(void**)(context + 0x194);
    
    // Create return address node
    ReturnNode node = { code_ptr, ip };
    
    // Push onto call stack
    FUN_0045e6f5(stack, &node);
}
```

**Usage:** Called by CALL opcode before jumping to function.

---

### `FUN_0045f119` — Pop Return Address

**Signature:** `void __thiscall FUN_0045f119(void* context, void** out_code, int* out_ip)`

**Purpose:** Retrieves and removes the return address from the call stack.

```c
void FUN_0045f119(void* context, void** out_code, int* out_ip) {
    void* stack = *(void**)(context + 0x194);
    
    // Pop return address node
    ReturnNode node;
    FUN_0045e7b3(stack, &node);
    
    *out_code = node.code_ptr;
    *out_ip = node.ip;
}
```

**Usage:** Called by RET opcode to restore caller's context.

---

## Value Push Operations

### `FUN_0045f1ac` — LOAD (Push Value Copy)

**Signature:** `void __thiscall FUN_0045f1ac(void* context, uint encoded_ref)`

**Purpose:** Loads a value from a variable pool and pushes a **copy** onto the stack.

**Encoded reference format:** `[scope:u8] [unused:u8] [index:u16]`

```c
void FUN_0045f1ac(void* context, uint encoded_ref) {
    uint scope = encoded_ref & 0xFF;
    uint index = encoded_ref >> 16;
    
    StackEntry* source;
    
    if (scope == 0x02) {  // LOCAL
        // Index is relative to current frame
        int frame_offset = *(int*)(context + 0x198);
        source = get_stack_entry(context, frame_offset + index);
    } else {
        // GLOBAL (0) or CONST (1)
        void* pool = *(void**)(context + 0x188 + scope * 4);
        source = get_pool_entry(pool, index);
    }
    
    // Create copy and push
    StackEntry* copy = create_entry_copy(source);
    stack_push(context, copy);
}
```

**Examples:**
```
01 00 05 00  ; Load global #5
01 01 00 00  ; Load constant #0
01 02 03 00  ; Load local #3 (frame-relative)
```

---

### `FUN_0045f306` — PUSHREF (Push Reference)

**Signature:** `void __thiscall FUN_0045f306(void* context, uint encoded_ref)`

**Purpose:** Pushes a **reference** to a variable (not a copy). Used for out parameters.

```c
void FUN_0045f306(void* context, uint encoded_ref) {
    uint scope = encoded_ref & 0xFF;
    uint index = encoded_ref >> 16;
    
    if (scope == 0x02) {  // LOCAL
        // Adjust index by frame offset for absolute reference
        index += *(short*)(context + 0x198);
    }
    
    // Create reference entry
    StackEntry* ref = create_reference(scope, index);
    stack_push(context, ref);
}
```

---

### `FUN_0045f3ef` — LOADINOUTREF (Load In/Out Reference)

**Signature:** `void __thiscall FUN_0045f3ef(void* context, uint encoded_ref)`

**Purpose:** Loads a bidirectional (in/out) parameter reference.

---

### `FUN_0045f59c` — PUSHR (Push Store Target)

**Signature:** `void __thiscall FUN_0045f59c(void* context, uint encoded_ref)`

**Purpose:** Pushes a reference as a store target (left-hand side of assignment).

```c
void FUN_0045f59c(void* context, uint encoded_ref) {
    uint scope = encoded_ref & 0xFF;
    uint index = encoded_ref >> 16;
    
    if (scope == 0x02) {  // LOCAL
        index += *(short*)(context + 0x198);
    }
    
    // Get the target variable
    void* pool = *(void**)(context + 0x188 + scope * 4);
    StackEntry* target = get_pool_entry(pool, index);
    
    // Get current stack top
    int top = stack_top_index(context);
    StackEntry* top_entry = get_stack_entry(context, top);
    
    // Link store target to top entry
    FUN_0045e0b9(target, top_entry->value_ptr);
}
```

---

### `FUN_0045f6b3` — PUSHREFSTORE (Push Out Parameter Reference)

**Signature:** `void __thiscall FUN_0045f6b3(void* context, uint encoded_ref)`

**Purpose:** Pushes reference for out parameter store target (double indirection).

---

## Value Creation and Conversion

### `FUN_0045dac6` — Create Typed Value

**Signature:** `StackEntry* __thiscall FUN_0045dac6(void* this, int type, int* value)`

**Purpose:** Creates a new stack entry with the specified type and value.

```c
StackEntry* FUN_0045dac6(void* entry, int type, int* value) {
    *(int*)entry = type;           // Set type
    *(int*)(entry + 4) = 1;        // Set flags (by-value)
    
    if (type == 6) {  // STRING
        // Allocate and copy string
        char* str = allocate_string(*(char**)value);
        *(char**)(entry + 8) = str;
    } else {
        // Copy raw value (up to 8 bytes for double)
        *(int*)(entry + 8) = value[0];
        *(int*)(entry + 12) = value[1];
    }
    
    return entry;
}
```

---

### `FUN_0045dba0` — Copy Stack Entry

**Signature:** `StackEntry* __thiscall FUN_0045dba0(void* dest, StackEntry* source)`

**Purpose:** Creates a deep copy of a stack entry.

```c
StackEntry* FUN_0045dba0(void* dest, StackEntry* source) {
    *(int*)dest = source->type;
    *(int*)(dest + 4) = source->flags;
    *(int*)(dest + 16) = source->ref_info;
    
    if (source->type == 6) {  // STRING
        // Deep copy string
        char* str = allocate_string(source->value.string_ptr);
        *(char**)(dest + 8) = str;
    } else {
        // Copy raw value
        *(int*)(dest + 8) = source->value.long_val;
        *(int*)(dest + 12) = *(int*)((char*)source + 12);
    }
    
    return dest;
}
```

---

### `FUN_0045dc5a` — Free Stack Entry

**Signature:** `void __fastcall FUN_0045dc5a(StackEntry* entry)`

**Purpose:** Frees resources associated with a stack entry (strings).

```c
void FUN_0045dc5a(StackEntry* entry) {
    if (entry->type == 6 && entry->value.string_ptr != NULL) {
        // Free string memory
        FUN_004703cf(entry->value.string_ptr);
        free(entry->value.string_ptr);
    }
}
```

---

### `FUN_0045dcae` — Convert Value Type

**Signature:** `void __thiscall FUN_0045dcae(void* entry, int new_type)`

**Purpose:** Converts a stack entry to a different type in-place.

```c
void FUN_0045dcae(void* entry, int new_type) {
    int old_type = *(int*)entry;
    
    // Handle string → non-string (free old string)
    if (old_type == 6 && new_type != 6) {
        free_string(*(char**)(entry + 8));
        *(int*)(entry + 8) = 0;
    }
    
    // Handle non-string → string (allocate new)
    if (old_type != 6 && new_type == 6) {
        *(char**)(entry + 8) = allocate_empty_string();
    }
    
    *(int*)entry = new_type;
    
    // Convert value based on type combination
    switch (new_type) {
        case 2:  // → byte
            switch (old_type) {
                case 5:  // real → byte
                    *(char*)(entry + 8) = (char)(int)*(double*)(entry + 8);
                    break;
                // other cases...
            }
            break;
        case 3:  // → int16
            switch (old_type) {
                case 2:  // byte → int16
                    *(short*)(entry + 8) = (short)*(char*)(entry + 8);
                    break;
                case 5:  // real → int16
                    *(short*)(entry + 8) = (short)(int)*(double*)(entry + 8);
                    break;
            }
            break;
        case 4:  // → int32
            switch (old_type) {
                case 2:  // byte → int32
                    *(int*)(entry + 8) = (int)*(char*)(entry + 8);
                    break;
                case 3:  // int16 → int32
                    *(int*)(entry + 8) = (int)*(short*)(entry + 8);
                    break;
                case 5:  // real → int32
                    *(int*)(entry + 8) = (int)*(double*)(entry + 8);
                    break;
            }
            break;
        case 5:  // → real (double)
            switch (old_type) {
                case 2:  // byte → real
                    *(double*)(entry + 8) = (double)(int)*(char*)(entry + 8);
                    break;
                case 3:  // int16 → real
                    *(double*)(entry + 8) = (double)(int)*(short*)(entry + 8);
                    break;
                case 4:  // int32 → real
                    *(double*)(entry + 8) = (double)*(int*)(entry + 8);
                    break;
            }
            break;
    }
}
```

---

## Execution Control

### `FUN_00460731` — Jump to Function

**Signature:** `void __thiscall FUN_00460731(void* vm, int code_block)`

**Purpose:** Sets up VM state to execute a function.

```c
void FUN_00460731(void* vm, int code_block) {
    *(int*)(vm + 0x08) = 0;                        // Reset condition
    *(int*)(vm + 0x0C) = 0;                        // Reset IP to 0
    *(int*)(vm + 0x14) = code_block;               // Set code block pointer
    *(int*)(vm + 0x04) = FUN_00440180(code_block); // Set code size
    FUN_0045eec3(0x4a42b0);                        // Sync stack frame offset
}
```

---

### `FUN_00440180` — Get Code Block Size

**Signature:** `int __fastcall FUN_00440180(int code_block)`

**Purpose:** Returns the number of instructions in a code block.

```c
int FUN_00440180(int code_block) {
    return *(int*)(code_block + 8) - 1;  // Instruction count - 1
}
```

---

### `FUN_0041fc3f` — Resolve Call Target

**Signature:** `int __thiscall FUN_0041fc3f(void* ctx, uint call_ref, code** out_func)`

**Purpose:** Resolves a CALL instruction target to a function pointer.

**Returns:** 1 = user function, 2 = system function

```c
int FUN_0041fc3f(void* ctx, uint call_ref, code** out_func) {
    uint target = call_ref & 0xFF;
    uint func_id = call_ref >> 16;
    
    if (target == 0x80) {  // User function
        // Lookup in user function table at offset 0x38
        void* table = *(void**)(ctx + 0x38);
        *out_func = get_entry(table, func_id);
        return 1;
    } else {  // System function (0x81)
        // Lookup in system function table at offset 0x44
        void* table = *(void**)(ctx + 0x44);
        *out_func = get_entry(table, func_id);
        return 2;
    }
}
```

---

## Type Conversion

### `FUN_00460f29` — Type Marker to Internal Type

**Signature:** `int __cdecl FUN_00460f29(char type_marker)`

**Purpose:** Converts IPO type marker (0x50-0x57) to internal type ID (1-9).

```c
int FUN_00460f29(char type_marker) {
    switch (type_marker) {
        case 0x50: return 1;  // bool
        case 0x51: return 3;  // int (s16)
        case 0x52: return 2;  // byte (u8)
        case 0x53: return 4;  // long (s32)
        case 0x54: return 5;  // real (f64)
        case 0x55: return 6;  // string
        case 0x56: return 9;  // handle type 1
        case 0x57: return 7;  // handle type 2
        default:   return 0;  // unknown
    }
}
```

---

## ALU Operations

### `FUN_00460faf` — Execute ALU Operation

**Signature:** `void __thiscall FUN_00460faf(void* vm, char alu_op)`

**Purpose:** Executes arithmetic or logical operation on stack operands.

```c
void FUN_00460faf(void* vm, char alu_op) {
    StackEntry *lhs, *rhs;
    FUN_0045fa38(context, &rhs, &lhs);  // Get two operands
    
    switch (alu_op) {
        case 0x60:  // ADD
            switch (lhs->type) {
                case 2: lhs->value.byte_val += rhs->value.byte_val; break;
                case 3: lhs->value.int_val += rhs->value.int_val; break;
                case 4: lhs->value.long_val += rhs->value.long_val; break;
                case 5: lhs->value.real_val += rhs->value.real_val; break;
                case 6: string_concat(lhs, rhs); break;  // String concatenation!
            }
            break;
            
        case 0x61:  // SUB
            // ... similar to ADD
            break;
            
        case 0x62:  // MUL
            // ... similar
            break;
            
        case 0x63:  // DIV
            // Check for division by zero
            if (rhs->value == 0 && !error_flag) {
                raise_error(400);  // Division by zero
            } else {
                // ... perform division
            }
            break;
            
        case 0x64:  // LT (<)
            vm->condition = (lhs->value < rhs->value);
            lhs->value.long_val = vm->condition;
            FUN_0045dcae(lhs, 1);  // Convert to bool
            break;
            
        // ... 0x65-0x6E comparison/logic ops
        
        case 0x6D:  // NEG (unary -)
            // Only uses top of stack
            top = get_stack_top(context);
            switch (top->type) {
                case 2: top->value.byte_val = -top->value.byte_val; break;
                case 3: top->value.int_val = -top->value.int_val; break;
                case 4: top->value.long_val = -top->value.long_val; break;
                case 5: top->value.real_val = -top->value.real_val; break;
            }
            return;  // Don't pop
            
        case 0x6E:  // NOT (!)
            top = get_stack_top(context);
            if (top->type == 1) {  // bool only
                top->value.long_val = (top->value.long_val == 0) ? 1 : 0;
            }
            return;  // Don't pop
            
        case 0x6F:  // BAND (bitwise &)
            // ... integer types only
            break;
            
        case 0x70:  // BOR (bitwise |)
            // ...
            break;
            
        case 0x71:  // BXOR (bitwise ^)
            // ...
            break;
    }
    
    FUN_0045eee3(context, 1);  // Pop rhs, keep lhs with result
}
```

---

## Error Handling

### `FUN_0045d76e` — Raise Runtime Error

**Signature:** `void FUN_0045d76e(void* ctx, int error_code)`

**Purpose:** Raises a runtime error with the specified error code.

**Known error codes:**

| Code | Description |
|------|-------------|
| 400 | Division by zero |
| 0x13 | Invalid parameter value |
| 0x14 | API call failed |
| 0x149 | Type mismatch |
| 0x195 | Operation not supported for type |

---

## Memory Management

### `FUN_0046d018` — Allocate Memory

**Signature:** `void* FUN_0046d018(int size)`

**Purpose:** Allocates `size` bytes of memory.

### `FUN_0046d041` — Free Memory

**Signature:** `void FUN_0046d041(void* ptr)`

**Purpose:** Frees previously allocated memory.

### `FUN_004701b9` — Allocate and Copy String

**Signature:** `char* FUN_004701b9(void* dest, char* source)`

**Purpose:** Allocates memory for string and copies content.

### `FUN_004703cf` — Free String

**Signature:** `void FUN_004703cf(char* str)`

**Purpose:** Frees string memory.

### `FUN_00470810` — String Concatenate

**Signature:** `void FUN_00470810(char* dest, char* append)`

**Purpose:** Appends string to existing string (reallocates if needed).

---

## Summary: Call Sequence Example

```
; Function call: result = helper(arg1, arg2);

; 1. Push call frame marker
0F 00 00 00          ; FRAME - marks stack boundary

; 2. Push arguments
01 02 00 00          ; LOAD local #0 (arg1) - push copy
02 02 01 00          ; PUSHREF local #1 (arg2) - push reference (out param)

; 3. Call function
0C 80 04 00          ; CALL user #4 (helper)
                     ; → FUN_0045f06e saves return address
                     ; → FUN_00460731 jumps to function code
                     ; → Function executes...
                     ; → RET calls FUN_0045f119 to restore

; 4. Result is on stack (if function returns value)
06 02 02 00          ; PUSHR local #2 (result target)
05 00 02 00          ; MOVE - assign result
```

---

*Reference: INPA.exe Ghidra decompilation*
