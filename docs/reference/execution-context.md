# Execution Context (ExecContext)

Deep dive into INPA's execution context structure and stack frame management.

## Overview

INPA uses a single global `ExecContext` that manages multiple execution stacks and variable pools. This allows the VM to handle different execution contexts (screens, state machines, menus) with isolated stack frames.

## Structure

```c
struct Stack {
    void*   vtable;         // +0x00: Virtual table
    // ... internal fields
    void*   entries;        // +0x1C: Array of StackEntry values
    void*   frame_stack;    // +0x28: Array of frame offsets (ushort[])
    int     frame_offset;   // +0x3C: Current frame offset
};

struct ExecContext {
    Stack   stacks[6];      // +0x00 to +0x17F: Six independent stacks
                            // +0x00:  Stack 0 (main)
                            // +0x40:  Stack 1 
                            // +0x80:  Stack 2
                            // +0xC0:  Stack 3
                            // +0x100: Stack 4
                            // +0x140: Stack 5
    
    byte    exec_type;      // +0x180: Execution type (0/1/2)
    int     stack_id;       // +0x184: Active stack index (0-5)
    
    void*   global_vars;    // +0x188: Global variable pool
    void*   const_pool;     // +0x18C: Constant pool
    void*   local_vars;     // +0x190: (Unused - locals are on stack!)
    void*   stack;          // +0x194: Pointer to active stack
    int     frame_offset;   // +0x198: Copy of stack->frame_offset
};
```

## Key Insight: Locals Are On The Stack

**Local variables are NOT in a separate pool.** They share the same stack as temporary values. The `frame_offset` determines where local variables start.

```
Stack layout during function call:
┌─────────────────────────────────┐
│ [0] caller's local 0            │  ← Previous frame
│ [1] caller's local 1            │
│ [2] caller's temp value         │
├─────────────────────────────────┤
│ [3] ← frame_offset (saved: 3)   │  ← Current frame starts here
│ [3] callee's local 0            │
│ [4] callee's local 1            │
│ [5] callee's temp value         │
│ [6] callee's temp value         │  ← Stack top
└─────────────────────────────────┘
```

## Frame Offset Calculation

### FRAME Opcode (Push Frame)

Called before a function call to establish a new stack frame.

```c
void FRAME(Stack* stack) {
    // Get current stack top
    int top = stack->entries.count - 1;
    
    // New frame starts at top + 1
    stack->frame_offset = top + 1;
    
    // Save this offset to frame stack (for later restoration)
    stack->frame_stack.push(stack->frame_offset);
}
```

### ENDFRAME / Return

Called when returning from a function to cleanup locals and restore previous frame.

```c
void ENDFRAME(Stack* stack) {
    if (stack->frame_stack.count < 1) {
        stack->frame_offset = 0;
        return;
    }
    
    // Pop all values from frame_offset to top (cleanup locals + temps)
    int top = stack->entries.count - 1;
    while (stack->frame_offset <= top) {
        StackEntry* entry = stack->entries[top];
        free_entry(entry);
        stack->entries.remove(top);
        top--;
    }
    
    // Remove current frame marker
    int frame_idx = stack->frame_stack.count - 1;
    stack->frame_stack.remove(frame_idx);
    
    // Restore previous frame_offset
    if (frame_idx < 1) {
        stack->frame_offset = 0;
    } else {
        stack->frame_offset = stack->frame_stack[frame_idx - 1];
    }
}
```

## Variable Access by Scope

### Scope Values

| Scope | Value | Pool | Frame-Relative |
|-------|-------|------|----------------|
| GLOBAL | 0x00 | `global_vars` (+0x188) | No |
| CONST | 0x01 | `const_pool` (+0x18C) | No |
| LOCAL | 0x02 | `stack` (+0x194) | **Yes** |

### LOAD (Push Value Copy)

```c
void LOAD(ExecContext* ctx, uint encoded_ref) {
    uint scope = encoded_ref & 0xFF;
    uint index = encoded_ref >> 16;
    
    StackEntry* source;
    
    if (scope == 0x02) {  // LOCAL
        // Index is relative to current frame
        int real_index = index + ctx->frame_offset;
        source = ctx->stack->entries[real_index];
    } else {
        // GLOBAL (0) or CONST (1) - use pool directly
        void* pool = *(void**)((int)ctx + scope * 4 + 0x188);
        source = pool->entries[index];
    }
    
    // Create copy and push to stack
    StackEntry* copy = clone_entry(source);
    ctx->stack->entries.push(copy);
}
```

### PUSHREF (Push Reference)

```c
void PUSHREF(ExecContext* ctx, uint encoded_ref) {
    uint scope = encoded_ref & 0xFF;
    uint index = encoded_ref >> 16;
    
    if (scope == 0x02) {  // LOCAL
        // Convert to absolute index for reference stability
        index += ctx->frame_offset;
    }
    
    // Create reference entry (not a copy of value)
    StackEntry* ref = create_reference(scope, index);
    ctx->stack->entries.push(ref);
}
```

## Stack Switching

The VM can switch between 6 independent stacks. This is used for different execution contexts:

```c
void switch_stack(ExecContext* ctx, int stack_id) {
    // Save current stack_id
    int old_id = ctx->stack_id;
    ctx->stack_id = stack_id;
    
    // Update active stack pointer
    ctx->stack = &ctx->stacks[stack_id];
    
    // Update execution type
    switch (stack_id) {
        case 0: ctx->exec_type = 0; break;
        case 1: ctx->exec_type = 1; break;
        default: ctx->exec_type = 2; break;
    }
    
    // Sync frame_offset from new stack
    ctx->frame_offset = ctx->stack->frame_offset;
}
```

### Stack Usage (Probable)

| Stack ID | Purpose |
|----------|---------|
| 0 | Main/default execution |
| 1 | Screen INIT phase |
| 2 | Screen LINE phase |
| 3 | State machine execution |
| 4 | Menu handlers |
| 5 | Reserved |

## Call Sequence Example

```
; Before call
10: FRAME                    ; Push frame marker
    ; → frame_offset = stack_top + 1
    ; → frame_stack.push(frame_offset)

11: LOAD local #0            ; Push arg1 (copy)
    ; → push stack[frame_offset + 0]

12: PUSHREF local #1         ; Push arg2 (reference)  
    ; → push ref(LOCAL, frame_offset + 1)

13: CALL user #4             ; Call function
    ; → save return address
    ; → jump to function

; Inside function
20: LOAD local #0            ; Access first local (param)
    ; → stack[new_frame_offset + 0]

21: PUSHREF local #1         ; Reference to second local
    ; → ref uses absolute index

; Return
30: RET
    ; → ENDFRAME cleanup:
    ;   - pop all from frame_offset to top
    ;   - restore previous frame_offset from frame_stack
    ; → jump to saved return address
```

## Synchronization

The `frame_offset` in `ExecContext` (+0x198) is kept in sync with the active stack's `frame_offset` (+0x3C):

```c
void sync_frame_offset(ExecContext* ctx) {
    ctx->frame_offset = ctx->stack->frame_offset;
}
```

This is called after:
- `FRAME` - new frame established
- `ENDFRAME` - frame popped
- Stack switching - different stack may have different offset

## Implementation Notes

1. **Frame stack is separate from value stack** - stored in `+0x28`, not mixed with values
2. **Frame offsets are 16-bit** (`ushort`) - limits call depth
3. **No separate local variable pool** - everything is on the stack
4. **References use absolute indices** - `PUSHREF` adds frame_offset to make references stable across frame changes

---

*Reference: INPA.exe Ghidra analysis*
