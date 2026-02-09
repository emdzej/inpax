# Language Construct Bytecode Analysis

> **Research Phase:** Issue #29 - Language Construct Function IDs  
> **Date:** 2026-02-09  
> **Method:** Minimal .ips compilation + bytecode diffing

This document maps INPA language constructs (SCREEN, MENU, STATEMACHINE) to their compiled bytecode representations.

---

## Table of Contents

1. [Overview](#overview)
2. [SCREEN Constructs](#screen-constructs)
3. [MENU Constructs](#menu-constructs)
4. [STATEMACHINE Constructs](#statemachine-constructs)
5. [Opcode Reference](#opcode-reference)
6. [System Function IDs](#system-function-ids)

---

## 1. Overview

### Research Method

Minimal test files compiled with:
```batch
cd C:\EC-APPS\INPA\SGDAT
C:\EC-APPS\INPA\BIN\INPACOMP.exe test_name.ips -B test_name.log
```

Each test incrementally adds complexity to isolate specific opcodes.

### Key Findings

1. **UI Handle System**: Unified mechanism for all UI constructs
2. **Opcode 0x02**: Pushes handles to SCREEN/MENU/STATEMACHINE/STATE
3. **Section Markers**: Type bytes identify construct categories
4. **LINE**: Compiler directive, not a runtime function

---

## 2. SCREEN Constructs

### 2.1 Empty SCREEN

**Source:**
```c
SCREEN s_empty() {
}
```

**Bytecode:**
```hex
01 73 5f 65 6d 70 74 79 0a  ; Section name "s_empty"
00 00 00 00 0a 0a 00         ; Preamble
00 00 21 0a                  ; Opcode 0x21 (SCREEN_START)
00 00 00 00 0a 0a 00         ; Terminator
```

**Findings:**
- Section marker: `0x01` (SCREEN type)
- Opcode `0x21` present even in empty SCREEN
- Minimal overhead: ~20 bytes

### 2.2 SCREEN with LINE

**Source:**
```c
SCREEN s_line() {
    LINE("Label", "Unit") {
    }
}
```

**Bytecode:**
```hex
01 73 5f 6c 69 6e 65 0a      ; "s_line"
00 00 00 00 0a 0a 00
00 00 21 0a                  ; SCREEN_START
00 00 00 00 0a 0a 00
00 00 22 0a                  ; Opcode 0x22 (LINE marker)
00 00 00 00 4c 61 62 65 6c 0a  ; "Label\n"
55 6e 69 74 0a               ; "Unit\n"
```

**Findings:**
- Opcode `0x22`: LINE construct marker
- LINE parameters stored inline as newline-terminated strings
- Empty LINE body = no additional bytecode

### 2.3 LINE with Content

**Source:**
```c
SCREEN s_content() {
    LINE("Voltage", "V") {
        text(0, 0, "test");
    }
}
```

**Bytecode (LINE body):**
```hex
00 05 00 0f 00 00 00         ; Header/padding
01 01 03 00                  ; PUSH_CONST idx=3 (0)
01 01 04 00                  ; PUSH_CONST idx=4 (0)
01 01 05 00                  ; PUSH_CONST idx=5 ("test")
0c 81 48 00                  ; CALL_API text (ID=0x48)
```

**Findings:**
- LINE body contains normal bytecode
- Parameters pushed left-to-right
- Function calls work normally inside LINE

### 2.4 setscreen Function

**Source:**
```c
inpainit() {
    setscreen(s_main, TRUE);
}
```

**Bytecode:**
```hex
02 40 00 00     ; PUSH_UI_HANDLE (SCREEN @ offset 0x0040)
01 01 01 00     ; PUSH_CONST idx=1 (TRUE)
0c 81 04 00     ; CALL_API setscreen (ID=0x04)
```

**Findings:**
- **Function ID: `setscreen` = 0x04**
- Opcode `0x02 [u16 LE]`: Push UI handle (section offset)
- Handle points to target SCREEN section header
- Second parameter: boolean (cyclic refresh flag)

---

## 3. MENU Constructs

### 3.1 Empty MENU (Compilation Error)

**Source:**
```c
MENU m_empty() {
}
```

**Result:** ❌ `error I224: Error in local definitions`

**Conclusion:** MENU requires INIT block.

### 3.2 MENU with INIT

**Source:**
```c
MENU m_init() {
    INIT {
    }
}
```

**Bytecode:**
```hex
02 6d 5f 69 6e 69 74 0a      ; "m_init"
00 00 00 00 0a 0a 00         ; Preamble
00 00                        ; Empty INIT block
```

**Findings:**
- Section marker: `0x02` (MENU type)
- INIT block is mandatory (can be empty)
- No special opcode for INIT — just section structure

### 3.3 MENU with ITEM

**Source:**
```c
MENU m_item() {
    INIT {
    }
    ITEM(1, "Exit") {
        exit();
    }
}
```

**Bytecode:**
```hex
02 6d 5f 69 74 65 6d 0a      ; "m_item"
00 00 00 00 0a 0a 00
00 00 24 0a                  ; Opcode 0x24 (ITEM marker)
00 00 01 00                  ; ITEM key = 1
45 78 69 74 0a               ; "Exit\n"
0a 00 02 00 0f 00 00 00      ; Separator
0c 81 0c 00                  ; CALL_API exit (ID=0x0C)
```

**Findings:**
- Opcode `0x24`: ITEM marker
- ITEM key stored as `u16 LE` after marker
- Label string follows key
- ITEM body contains normal bytecode

### 3.4 setmenu Function

**Source:**
```c
inpainit() {
    setmenu(m_main);
}
```

**Bytecode:**
```hex
02 41 00 00     ; PUSH_UI_HANDLE (MENU @ offset 0x0041)
0c 81 01 00     ; CALL_API setmenu (ID=0x01)
```

**Findings:**
- **Function ID: `setmenu` = 0x01**
- Same `0x02` opcode pattern as setscreen
- Single parameter: menu handle

---

## 4. STATEMACHINE Constructs

### 4.1 Empty STATEMACHINE

**Source:**
```c
STATEMACHINE sm_empty() {
    INIT {
    }
    idle {
    }
}
```

**Bytecode:**
```hex
03 73 6d 5f 65 6d 70 74 79 0a  ; "sm_empty"
00 00 00 00 0a 0a 00
01 00 0f 00 00 00            ; INIT block header
25 69 64 6c 65 0a            ; Opcode 0x25 + "idle\n"
00 00 00 00 0a 0a 00
```

**Findings:**
- Section marker: `0x03` (STATEMACHINE type)
- Opcode `0x25`: STATE marker
- States are named subsections
- STATEMACHINE requires INIT + at least one state

### 4.2 State Transitions (setstate)

**Source:**
```c
STATEMACHINE sm_trans() {
    INIT {
        setstate(state_one);
    }
    state_one {
        setstate(state_two);
    }
    state_two {
    }
}
```

**Bytecode (INIT block):**
```hex
02 43 00 00     ; PUSH_UI_HANDLE (STATE state_one @ offset 0x0043)
0c 81 06 00     ; CALL_API setstate (ID=0x06)
```

**Bytecode (state_one block):**
```hex
02 43 01 00     ; PUSH_UI_HANDLE (STATE state_two @ offset 0x0143)
0c 81 06 00     ; CALL_API setstate (ID=0x06)
```

**Findings:**
- **Function ID: `setstate` = 0x06**
- State handles use same `0x02` opcode
- Handles point to target STATE section offset
- Enables runtime state switching

### 4.3 setstatemachine Function

**Source:**
```c
inpainit() {
    setstatemachine(sm_main);
}
```

**Bytecode:**
```hex
02 42 00 00     ; PUSH_UI_HANDLE (STATEMACHINE @ offset 0x0042)
0c 81 05 00     ; CALL_API setstatemachine (ID=0x05)
```

**Findings:**
- **Function ID: `setstatemachine` = 0x05**
- Registers state machine for background execution
- Same handle mechanism as setscreen/setmenu

---

## 5. Opcode Reference

### Core Opcodes

| Opcode | Mnemonic | Args | Description |
|--------|----------|------|-------------|
| `0x02 [u16]` | `PUSH_UI_HANDLE` | Offset | Push handle to SCREEN/MENU/STATEMACHINE/STATE |
| `0x21` | `SCREEN_START` | — | SCREEN section marker |
| `0x22` | `LINE` | — | LINE construct marker |
| `0x24` | `ITEM` | — | MENU ITEM marker |
| `0x25` | `STATE` | — | STATE definition marker |
| `01 01 [u16]` | `PUSH_CONST` | Index | Push constant (variant encoding) |
| `0C 81 [u16]` | `CALL_API` | FuncID | Call system function |

### Handle Format

Handles are **section offsets** (u16 LE) pointing to:
- SCREEN section header (for setscreen)
- MENU section header (for setmenu)
- STATEMACHINE section header (for setstatemachine)
- STATE subsection (for setstate)

**Example:**
```hex
02 40 00 00     ; Push handle to section @ file offset 0x0040
```

---

## 6. System Function IDs

### UI Setter Functions

| Function | ID (hex) | Signature |
|----------|----------|-----------|
| `setmenu` | `0x01` | `(in: MENU handle)` |
| `setscreen` | `0x04` | `(in: SCREEN handle, in: bool cyclic)` |
| `setstatemachine` | `0x05` | `(in: STATEMACHINE handle)` |
| `setstate` | `0x06` | `(in: STATE handle)` |

### Related Functions (from IPO_Structure.md)

| Function | ID (hex) | Signature |
|----------|----------|-----------|
| `setmenutitle` | `0x00` | `(in: string title)` |
| `settitle` | `0x03` | `(in: string title)` |
| `returnstatemachine` | `0x08` | `()` |
| `exit` | `0x0C` | `()` |
| `text` | `0x48` | `(in: int row, in: int col, in: string text)` |

---

## Section Type Summary

| Type Byte | Construct | Required Elements |
|-----------|-----------|-------------------|
| `0x01` | SCREEN | Opcode 0x21 marker |
| `0x02` | MENU | INIT block |
| `0x03` | STATEMACHINE | INIT block + states |

---

## Compilation Notes

### Required Elements

1. **All scripts MUST have:**
   - `#include "inpa.h"`
   - `inpainit()` function
   - `inpaexit()` function

2. **MENU-specific:**
   - INIT block is mandatory (can be empty)
   - ITEM/ITEMREPEAT require INIT to be defined first

3. **STATEMACHINE-specific:**
   - INIT block + at least one state required
   - State names are identifiers (no `STATE` keyword)

### Compilation Command

```batch
cd C:\EC-APPS\INPA\SGDAT
INPACOMP.exe test.ips -B test.log
```

**Critical:** `-B` flag enables batch mode (no GUI dialogs).

---

## References

- Issue #29: https://github.com/emdzej/inpax/issues/29
- `docs/IPO_Structure.md` section 11-12
- `docs/research/system-function-ids-complete.md`
- Test files: `C:\EC-APPS\INPA\SGDAT\test_*.ips` (Windows Node)

---

*Document generated from 10 minimal compilation tests. All findings validated against actual bytecode.*
