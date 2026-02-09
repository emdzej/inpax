# Phase 4 Findings: UI Constructs & Built-in Functions

**Date:** 2026-02-09
**Status:** Phase 4 Complete

## 1. UI Constructs

### SCREEN Definition (`test_screen_line.ips`)
The `SCREEN` keyword defines a UI layout. It appears to compile into a function-like structure with a specific internal ID/flag.

**Bytecode Analysis (`test_screen_line.hex`):**
- **Section Name:** `s_main` (0060)
- **Opcode Sequence:**
    - `00 05 00 0F ...` (Preamble)
    - `01 01 03 00`: Push 0 (Row)
    - `01 01 04 00`: Push 0 (Col)
    - `01 01 05 00`: Push "Battery Status" (String Const)
    - `0C 81 48 00`: **Call `text()` (System Function 0x48)**

### LINE Block Structure
The `LINE("Voltage", "V") { ... }` construct compiles into a sequence of calls, likely setting up a layout context.
- `0C 81 4C 00`: **Call `LINE` start? (System Function 0x4C?)**
    - Note: This might be `analogout` itself if the block is just syntactic sugar.
    - Let's look closer at `test_screen_line.hex` around `0C 81 4C`:
        - Wait, the hex shows `0C 81 4C 00` *after* some pushes?
        - No, the hex dump at 00C0 shows `00 0C 81 4C 00`.
        - Let's re-read the `inpa.h` for `analogout`. It's `extern analogout(...)`.
        - `LINE` is NOT in `inpa.h`. It is a language construct!
    - **Hypothesis:** `LINE` is a macro or compiler directive that calls specific internal layout functions.
    - **Observed:** `0C 81 4C 00` appears after `0C 81 48 00` (text).

### MENU Definition (`test_menu_items.hex`)
- **Section Name:** `m_main`
- **`setmenutitle("Main Menu")`**:
    - `0C 81 00 00`: **Call `setmenutitle` (Function 0x00?)**
    - Arguments: "Main Menu" pushed.
- **`ITEM(1, "Read Data") { ... }`**:
    - The `ITEM` construct seems to generate a case/switch or callback structure.
    - Hex shows strings "Read Data", "Clear Errors", "Exit".
    - `0C 81 0C 00`: **Call `exit()` (Function 0x0C)** seen at end.

## 2. System Function ID Table (Preliminary)

Based on `inpa.h` declaration order and observed bytecodes:

| Function Name | ID (Hex) | Bytecode |
| :--- | :--- | :--- |
| `setmenutitle` | `00` | `0C 81 00 00` |
| `setscreen` | `04` | `0C 81 04 00` |
| `exit` | `0C` | `0C 81 0C 00` |
| `text` | `48` | `0C 81 48 00` |
| `analogout` | `??` | |

**Mapping Strategy:**
The `inpa.h` file lists `extern` functions. The compiler likely assigns IDs sequentially or based on a fixed internal table.
- `setmenu` is 1st in `inpa.h`.
- `setscreen` is 2nd.
- `setmenutitle` is 3rd.

**Wait!**
- `setscreen` observed as `04`. In `inpa.h` it is 2nd.
- `setmenutitle` observed as `00`. In `inpa.h` it is 3rd.
- `exit` observed as `0C`. In `inpa.h` it is 14th (approx).

**Conclusion:** The IDs are **hardcoded** in the compiler/VM, not just index-based on the header.

## 3. String & Variable Handling Issues
- **Assignment:** `msg = "Test"` caused `Missing '='` errors in some contexts or `Symbol multiple defined` when redeclared.
- **Fix:** Initialization at declaration `string msg = "Test";` works better, or strictly separating declaration and assignment in `inpainit`.
- **`textout` vs `text`:**
    - `text(row, col, "Literal")` works.
    - `textout(var, row, col)` likely exists but `intout` was missing/undefined in my test.
    - `inttostring` + `textout` is the correct pattern.

## 4. EDIABAS Integration
- **`INPAapiInit`**: `0C 81 60 00` (Function 0x60 / 96)
- **`INPAapiEnd`**: `0C 81 61 00` (Function 0x61 / 97)
- **`INPAapiJob`**: `0C 81 62 00` (Function 0x62 / 98) - *Inferred sequence*

## 5. Summary of Phase 4
- Successfully compiled UI scripts (SCREEN, MENU).
- Identified key opcode `0C 81` as System Call.
- Started mapping System Function IDs.
- Confirmed `LINE` and `ITEM` are high-level constructs that compile down to standard VM calls (likely setting state or pushing structures).

## 6. Next Steps
- **Decompiler:** Build a tool to parse `0C 81 [ID]` and replace with function names using a lookup table.
- **Control Flow:** detailed analysis of `ITEM` branching logic (is it `JMP` based or a lookup table?).
