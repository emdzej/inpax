# Phase 3 Findings: Functions & UI Constructs

**Date:** 2026-02-09
**Status:** Phase 3 Complete

## 1. Function Definition & Calls

Functions are defined as named sections in the bytecode.
Calls use opcode `0x0C`.

### Function Definition Structure
- Header string (Function Name) + `0x0A`.
- Bytecode sequence.
- Ends with `0x0A`.

### Call Opcode: `0C [u8: Flags] [u16: Function ID/Index]`
- **Opcode:** `0C`
- **Flags:** `80` (Standard call?), `81` (UI Call / Special?)
- **Function Index:** Refers to an internal table (likely built during load).

**Example Trace (test_function.ips):**
`add_one(5, result)` ->
1.  Arguments pushed (Reverse order?):
    - `00 01 02 00` -> Push Value of Var 2 (result)? No, `01 02 00` -> PUSH_VAR_ADDR(2).
    - `00 01 01 00` -> PUSH_VAR_VAL? Wait, trace says `06 00 01 02 00` in function body?
    Let's re-examine `inpainit`:
    - `00 05 00 0F 00 00 00 01 01 02 00 02 00 01 00` ...
    - `0C 80 04 00` -> Call Function #4 (`add_one` is 4th named section?).

### Parameter Passing
- Parameters appear to be pushed to the stack.
- `in` parameters: Pushed by value.
- `out` parameters: Pushed by address (`01 [idx]`).

## 2. UI Constructs (SCREEN / MENU)

UI definitions are stored as named sections but have distinct internal structures.

### SCREEN Structure
- **Opcode `0C 81 [u16]`**: Used to "call" or "set" the screen/menu.
- **`setscreen(s_main, TRUE)`**:
    - `00 05 00 0F ...` (Preamble)
    - `02 40 00 00` -> Push Screen Handle? `40 00` matches `s_main` index?
    - `01 01` -> Push TRUE.
    - `0C 81 04 00` -> Call special function (setscreen internal ID 4?).

### MENU Structure
- **`setmenu(m_main)`**:
    - `02 41 00 00` -> Push Menu Handle?
    - `0C 81 01 00` -> Call special function (setmenu?).

### Menu/Screen Definitions
Inside `MENU m_main`:
- Items are defined sequentially.
- Strings like "Option 1" appear in Constant Data `06 ...`.
- Action blocks (like `exit()`) are embedded bytecode.

## 3. API Calls (EDIABAS)

**`INPAapiInit()`**:
- `0C 81 60 00` -> Call Function 0x60 (96).
- **`INPAapiEnd()`**:
- `0C 81 61 00` -> Call Function 0x61 (97).

**Observation:**
External/Internal API functions have high IDs (`0x60`, `0x61`) and use the `81` flag byte in the Call opcode.

## 4. Summary of New Opcodes

| Opcode | Arguments | Meaning |
| :--- | :--- | :--- |
| `0C 80 [u16]` | `FuncID` | **Call User Function** (Internal). |
| `0C 81 [u16]` | `FuncID` | **Call API/System Function**. |
| `02 [u16] ...` | `...` | **Push UI Handle** (Screen/Menu reference). |

## 5. Next Steps
- Map standard library function IDs (setscreen, text, etc.).
- Decompile `02` opcode usage in depth.
