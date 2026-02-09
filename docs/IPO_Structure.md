# IPO File Format Specification

> **Status:** Definitive Reference  
> **Version:** 1.0  
> **Date:** 2026-02-09  
> **Validation:** 95% confirmed against production files

This document is the authoritative specification for the `.ipo` binary format — compiled INPA scripts used in BMW diagnostic systems.

---

## Table of Contents

1. [Overview](#1-overview)
2. [File Header](#2-file-header)
3. [Section Structure](#3-section-structure)
4. [Global Data Section](#4-global-data-section)
5. [Constant Data Section](#5-constant-data-section)
6. [Type Markers](#6-type-markers)
7. [Opcode Reference](#7-opcode-reference)
8. [System Function IDs](#8-system-function-ids)
9. [Import32 / DLL Calls](#9-import32--dll-calls)
10. [Control Flow](#10-control-flow)
11. [UI Constructs](#11-ui-constructs)
12. [State Machines](#12-state-machines)
13. [Examples](#13-examples)
14. [Appendix: Unresolved Items](#appendix-unresolved-items)

---

## 1. Overview

The `.ipo` format is a compiled bytecode format for INPA scripts (`.ips` source files). It contains:

- **Header** with magic signature and version info
- **Named sections** for functions, screens, menus
- **Global Data** — type definitions for all global variables
- **Constant Data** — string literals, numbers, and other constants
- **Bytecode** — stack-based virtual machine instructions

The INPA VM executes these files for ECU diagnostics in BMW vehicles.

---

## 2. File Header

### Structure

```
[Version Bytes] [Magic String "TEST-Infotext\n"]
```

### Header Variants

| Variant | Hex Signature | Version Bytes | Notes |
|---------|---------------|---------------|-------|
| **A** | `05 00 54 45 53 54...` | `05 00` | Common in newer files |
| **B** | `01 02 54 45 53 54...` | `01 02` | Older format |
| **C** | `01 03 54 45 53 54...` | `01 03` | Alternative format |

**Full header hex (Variant A):**
```
05 00 54 45 53 54 2d 49 6e 66 6f 74 65 78 74 0a
      T  E  S  T  -  I  n  f  o  t  e  x  t \n
```

- **Bytes 0-1:** Version/format indicator (meaning: ⚠️ *unconfirmed*)
- **Bytes 2-15:** Magic string `"TEST-Infotext"` + newline (`0x0A`)

**Implementation note:** Do not hardcode `05 00` — check for the magic string `"TEST-Infotext\n"` at offset 2.

---

## 3. Section Structure

IPO files are organized into named sections. Section names are ASCII strings terminated by `0x0A` (newline).

### Known Section Types

| Section | Purpose |
|---------|---------|
| `Global Data` | Variable type definitions |
| `Constant Data` | String and numeric literals |
| `inpainit` | Initialization function (required) |
| `inpaexit` | Cleanup function (required) |
| `<function_name>` | User-defined functions |
| `<screen_name>` | SCREEN definitions |
| `<menu_name>` | MENU definitions |
| `<statemachine_name>` | State machine definitions |

### Section Detection

Sections are identified by their name string followed by `0x0A`. The preamble `00 00 00 00 0a 0a 00` appears after special sections like `Global Data` and `Constant Data`.

---

## 4. Global Data Section

Defines the types of all global variables. Variable **names are not stored** — they are referenced by index in bytecode.

### Structure

```
"Global Data\n"                      ; Section marker
00 00 00 00 0a 0a 00                 ; Preamble (7 bytes)
[u16 LE: variable_count]             ; Number of variables (little-endian)
01 00                                ; Unknown field (always 01 00)
04                                   ; Separator
[type_byte × variable_count]         ; One type byte per variable
```

### Example (376 variables)

```hex
47 6c 6f 62 61 6c 20 44 61 74 61 0a  ; "Global Data\n"
00 00 00 00 0a 0a 00                 ; Preamble
78 01                                ; Count = 0x0178 = 376 (LE)
01 00                                ; Unknown
04                                   ; Separator
06 06 06 06 06 06 06 05 03 01 ...    ; 376 type bytes follow
```

### Variable Indexing

- Variables are 0-indexed
- Index used in bytecode opcodes: `PUSH_VAR_ADDR (01 [idx])`, `PUSH_VAR_VAL (00 01 [idx])`

---

## 5. Constant Data Section

Stores literal values: strings, integers, reals, and booleans.

### Structure

```
"Constant Data\n"                    ; Section marker
00 00 00 00 0a 0a 00                 ; Preamble
[constant entries...]                 ; Type-prefixed values
```

### Constant Formats

| Type | Format | Example |
|------|--------|---------|
| **String** | `06 [chars...] 0a` | `"Hello"` → `06 48 65 6c 6c 6f 0a` |
| **Int** | `03 [u16 LE value]` | `42` → `03 2a 00` |
| **Real** | `05 [8-byte IEEE-754 LE]` | `3.14` → `05 1f 85 eb 51 b8 1e 09 40` |
| **Bool** | `01 [value]` | `TRUE` → `01 01`, `FALSE` → `01 00` |

**Note:** Constants are referenced by index in bytecode via `PUSH_CONST (00 06 [idx])`.

---

## 6. Type Markers

Used in both Global Data (variable types) and Constant Data (value prefixes).

| Type | Byte | Description |
|------|------|-------------|
| **Bool** | `0x01` | Boolean (TRUE=1, FALSE=0) |
| **Int** | `0x03` | 16-bit signed integer |
| **Byte** | `0x04` | 8-bit unsigned integer |
| **Real** | `0x05` | IEEE-754 double (64-bit float, little-endian) |
| **String** | `0x06` | Null-terminated or newline-delimited string |

### Production Distribution (msd80n43.ipo, first 100 vars)

- String (0x06): 56 occurrences
- Bool (0x01): 24 occurrences
- Int (0x03): 12 occurrences
- Real (0x05): 5 occurrences
- Byte (0x04): 3 occurrences

---

## 7. Opcode Reference

The INPA VM is stack-based. Instructions are variable-length.

### Core Opcodes

| Opcode | Arguments | Mnemonic | Description |
|--------|-----------|----------|-------------|
| `01 [u16]` | Index | `PUSH_VAR_ADDR` | Push address of global variable (for assignment) |
| `00 01 [u16]` | Index | `PUSH_VAR_VAL` | Push value of global variable |
| `00 06 [u16]` | Index | `PUSH_CONST` | Push constant from constant table |
| `00 05` | — | `STORE` | Pop value, pop address, write value to address |
| `00 09 [u8]` | Op | `ALU_OP` | Binary arithmetic/comparison operation |
| `00 0B [s16]` | Offset | `JMP_FALSE` | Pop condition; if false, jump by offset |
| `00 0E [s16]` | Offset | `JMP` | Unconditional relative jump |
| `02 [u16] 00` | Offset | `PUSH_UI_HANDLE` | Push handle to SCREEN/MENU/STATEMACHINE/STATE |

### UI Construct Markers

| Opcode | Mnemonic | Description |
|--------|----------|-------------|
| `0x21` | `SCREEN_START` | SCREEN section marker |
| `0x22` | `LINE` | LINE construct marker |
| `0x24` | `ITEM` | MENU ITEM marker |
| `0x25` | `STATE` | STATE definition marker |

### Function Call Opcodes

| Opcode | Arguments | Mnemonic | Description |
|--------|-----------|----------|-------------|
| `0C 80 [u16]` | FuncID | `CALL_USER` | Call user-defined function |
| `0C 81 [u16]` | FuncID | `CALL_API` | Call system/API function |

### ALU Operations (`00 09 [op]`)

| Sub-Op | Symbol | Operation |
|--------|--------|-----------|
| `0x60` | `+` | Addition |
| `0x61` | `-` | Subtraction |
| `0x62` | `*` | Multiplication |
| `0x64` | `<` | Less than |
| `0x65` | `>` | Greater than |
| `0x68` | `==` | Equality |

### Index Encoding

All indices are **16-bit little-endian unsigned integers**.

### Handle Format (Opcode 0x02)

Handles are **section offsets** (u16 LE) pointing to:
- SCREEN section header (for `setscreen`)
- MENU section header (for `setmenu`)
- STATEMACHINE section header (for `setstatemachine`)
- STATE subsection (for `setstate`)

**Example:**
```hex
02 40 00 00     ; Push handle to section @ file offset 0x0040
```

---

## 8. System Function IDs

System functions are called via `0C 81 [ID] 00`. IDs are **hardcoded** in the VM, not sequential.

### UI Setter Functions (from Language Constructs research)

| ID (hex) | Function | Signature |
|----------|----------|-----------|
| `0x01` | `setmenu` | `(in: MENU handle)` |
| `0x04` | `setscreen` | `(in: SCREEN handle, in: bool cyclic)` |
| `0x05` | `setstatemachine` | `(in: STATEMACHINE handle)` |
| `0x06` | `setstate` | `(in: STATE handle)` |

### Complete Mapping (62 functions)

| ID (hex) | Function | Signature |
|----------|----------|-----------|
| `0x00` | `setmenutitle` | `(in: string title)` |
| `0x03` | `settitle` | `(in: string title)` |
| `0x08` | `returnstatemachine` | `()` |
| `0x09` | `settimer` | `(in: int timernum, in: int timeval)` |
| `0x0C` | `exit` | `()` |
| `0x0D` | `exitwindows` | `()` |
| `0x0E` | `scriptselect` | `(in: string ScriptSelectIniFile)` |
| `0x0F` | `scriptchange` | `(in: string NewScriptFile)` |
| `0x11` | `deselect` | `()` |
| `0x12` | `control` | `()` |
| `0x13` | `start` | `()` |
| `0x14` | `stop` | `()` |
| `0x17` | `printscreen` | `()` |
| `0x1B` | `delay` | `(in: int Time)` |
| `0x1C` | `getdate` | `(out: string date)` |
| `0x1D` | `gettime` | `(out: string time)` |
| `0x2F` | `PEMTrennLinie` | `(out: bool Result)` |
| `0x30` | `PEMEndLinie` | `(out: bool Result)` |
| `0x31` | `PEMLoescheTabZeilenPuffer` | `(out: bool Result)` |
| `0x32` | `PEMUebertrageTabZeilenPuffer` | `(out: bool Result)` |
| `0x33` | `PEMProtokollAusgabe` | `(out: bool Result)` |
| `0x37` | `PEMPrinter_ff` | `(out: bool Result)` |
| `0x38` | `PEMFree_mem` | `(out: bool Result)` |
| `0x3E` | `getinputstate` | `(out: int InputState)` |
| `0x48` | `text` | `(in: int row, in: int col, in: string text)` |
| `0x49` | `textout` | `(in: string text, in: int row, in: int col)` |
| `0x51` | `blankscreen` | `()` |
| `0x52` | `messagebox` | `(in: string Title, in: string Text)` |
| `0x53` | `infobox` | `(in: string Title, in: string Text)` |
| `0x55` | `userboxclose` | `(in: int BoxNum)` |
| `0x57` | `userboxclear` | `(in: int BoxNum)` |
| `0x59` | `winhelp` | `(in: string helpfile)` |
| `0x5A` | `winhelpkey` | `(in: string helpfile, in: string key)` |
| `0x5B` | `callwin` | `(in: string cmdline)` |
| `0x5C` | `viewopen` | `(in: string FileNameStr, in: string TitleStr)` |
| `0x5D` | `viewclose` | `()` |
| `0x60` | `INPAapiInit` | `()` |
| `0x61` | `INPAapiEnd` | `()` |
| `0x65` | `INPAapiResultSets` | `(out: int sets)` |
| `0x68` | `INPAapiResultBinary` | `(in: string ApiResult, in: int ApiSet)` |
| `0x69` | `INPAapiCheckJobStatus` | `(in: string RefStr)` |
| `0x6A` | `INPAapiFsLesen2` | `(in: string ecu, in: string FileName)` |
| `0x6B` | `INPAapiFsLesen` | `(in: string ecu, in: string FileName)` |
| `0x6D` | `INP1apiInit` | `(out: bool rc)` |
| `0x6E` | `INP1apiEnd` | `()` |
| `0x70` | `INP1apiState` | `(out: int ApiState)` |
| `0x76` | `INP1apiErrorCode` | `(out: int ErrorCode)` |
| `0x77` | `INP1apiErrorText` | `(out: string ErrorText)` |
| `0x78` | `GetBinaryDataString` | `(out: string DataString, out: int DataStringLen)` |
| `0x79` | `fileopen` | `(in: string FileName, in: string OpenMode)` |
| `0x7A` | `fileclose` | `()` |
| `0x7B` | `filewrite` | `(in: string str)` |
| `0x7C` | `fileread` | `(out: string str, out: bool EOF)` |
| `0x8C` | `StrArrayCreate` | `(out: bool rc, out: int hStrArray)` |
| `0x8D` | `StrArrayDestroy` | `(in: int hStrArray)` |
| `0x8E` | `StrArrayWrite` | `(in: int hStrArray, in: int index, in: string str)` |
| `0x91` | `StrArrayDelete` | `(in: int hStrArray)` |
| `0x9B` | `SetStructureMode` | `(in: int ReadWrite)` |

### Unmapped Functions

Functions requiring MENU/SCREEN/STATE contexts could not be mapped via simple compilation:
- `setmenu`, `setscreen`, `setitem`, `setitemrepeat`
- `setstate`, `setstatemachine`, `callstatemachine`
- Various conversion and DTM functions

See `docs/research/system-function-ids-complete.md` for full details.

---

## 9. Import32 / DLL Calls

External DLL functions are imported using `import32` syntax and stored as signature strings in the IPO.

### Source Syntax

```c
import32 "Convention" lib "DLL::Function" Alias(parameters);
```

### Binary Format

The IPO contains import strings in format:
```
DLL::Function:convention.signature
```

### Examples from Production Files

```
kernel32::GetPrivateProfileStringA:c.sssSis%I
api32.DLL::__apiGetConfig:c.lsS%I
INPA_LIB32.DLL::SaveAsDialogBox:c.sSi%I
XTRACT32.DLL::XTRACT:c.siSl%I
kernel32::OpenFile:c.stLi%I
```

### Signature Decoding

| Char | Meaning | Direction |
|------|---------|-----------|
| `c` | Calling convention: cdecl | — |
| `s` | string (LPCSTR) | input |
| `S` | String buffer (LPSTR) | output |
| `i` | int (32-bit) | input |
| `l` | long (32-bit) | input |
| `%I` | Returns int | return value |
| `t` | ⚠️ Unknown (struct?) | — |
| `L` | ⚠️ Unknown (LPARAM?) | — |

### Key DLLs

| DLL | Purpose |
|-----|---------|
| `api32.DLL` | EDIABAS bridge (`__apiGetConfig`, `__apiSetConfig`) |
| `INPA_LIB32.DLL` | INPA utilities (dialogs, file ops) |
| `kernel32` | Windows system calls |
| `XTRACT32.DLL` | Data extraction utilities |

---

## 10. Control Flow

### If Statement

**Source:**
```c
if (x > 5) {
    // body
}
```

**Bytecode pattern:**
```
00 01 [x_idx]      ; PUSH_VAR_VAL (x)
00 06 [const_5]    ; PUSH_CONST (5)
00 09 65           ; ALU_OP (>)
00 0B [offset]     ; JMP_FALSE (skip body if false)
[body bytecode]
```

### While Loop

**Source:**
```c
while (i < 5) {
    // body
}
```

**Bytecode pattern:**
```
[LOOP_START:]
00 01 [i_idx]      ; PUSH_VAR_VAL (i)
00 06 [const_5]    ; PUSH_CONST (5)
00 09 64           ; ALU_OP (<)
00 0B [exit_offset]; JMP_FALSE (exit loop)
[body bytecode]
00 0E [back_offset]; JMP (negative, to LOOP_START)
```

### Jump Offsets

- `s16` signed little-endian
- Relative to **next instruction** after the jump opcode
- Negative values for backward jumps (loops)

---

## 11. UI Constructs

### Section Type Identifiers

| Type Byte | Construct | Required Elements |
|-----------|-----------|-------------------|
| `0x01` | SCREEN | Opcode `0x21` marker |
| `0x02` | MENU | INIT block (mandatory) |
| `0x03` | STATEMACHINE | INIT block + states |

### SCREEN Definition

Screens are named sections containing layout calls.

**Source:**
```c
SCREEN s_main() {
    LINE("Voltage", "V") {
        text(0, 0, "Battery Status");
    }
}
```

**Bytecode structure:**
```hex
01 73 5f 6d 61 69 6e 0a      ; Section type (0x01) + name "s_main\n"
00 00 00 00 0a 0a 00         ; Preamble
00 00 21 0a                  ; Opcode 0x21 (SCREEN_START)
00 00 00 00 0a 0a 00         ; ...
00 00 22 0a                  ; Opcode 0x22 (LINE marker)
00 00 00 00 56 6f 6c...      ; "Voltage\n"
56 0a                        ; "V\n"
[LINE body bytecode]         ; Normal opcodes (text calls etc)
```

**Activating a screen:**
```c
setscreen(s_main, TRUE);
```

**Bytecode:**
```hex
02 40 00 00        ; PUSH_UI_HANDLE (SCREEN @ offset 0x0040)
01 01 01 00        ; PUSH_CONST idx=1 (TRUE)
0C 81 04 00        ; CALL_API setscreen (ID=0x04)
```

### LINE Construct

LINE is a compiler directive that generates inline bytecode, not a runtime function.

**Source:**
```c
LINE("Label", "Unit") {
    text(0, 0, "value");
}
```

**Bytecode:**
```hex
22                           ; LINE marker opcode
0a 00 00 00 00              ; Padding
4c 61 62 65 6c 0a           ; "Label\n" (inline string)
55 6e 69 74 0a              ; "Unit\n" (inline string)
[body bytecode]             ; Normal function calls
```

### MENU Definition

Menus contain items that trigger actions. INIT block is **mandatory**.

**Source:**
```c
MENU m_main() {
    INIT {
        setmenutitle("Main Menu");
    }
    ITEM(1, "Exit") {
        exit();
    }
}
```

**Bytecode structure:**
```hex
02 6d 5f 6d 61 69 6e 0a      ; Section type (0x02) + name "m_main\n"
00 00 00 00 0a 0a 00         ; Preamble
[INIT block bytecode]        ; setmenutitle etc
24                           ; Opcode 0x24 (ITEM marker)
01 00                        ; ITEM key = 1 (u16 LE)
45 78 69 74 0a               ; "Exit\n"
[ITEM body bytecode]         ; exit() etc
```

**Activating a menu:**
```c
setmenu(m_main);
```

**Bytecode:**
```hex
02 41 00 00        ; PUSH_UI_HANDLE (MENU @ offset 0x0041)
0C 81 01 00        ; CALL_API setmenu (ID=0x01)
```

### Menu-related system functions

| ID (hex) | Function | Signature |
|----------|----------|-----------|
| `0x00` | `setmenutitle` | `(in: string title)` |
| `0x01` | `setmenu` | `(in: MENU handle)` |
| `0x0C` | `exit` | `()` |

---

## 12. State Machines

### Syntax

```c
STATEMACHINE sm_name() {
    INIT {
        setstate(state_one);
    }

    state_one {
        if (condition) {
            setstate(state_two);
        }
    }

    state_two {
        // logic
    }
}
```

### Bytecode Structure

**Section header:**
```hex
03 73 6d 5f 6e 61 6d 65 0a   ; Section type (0x03) + name "sm_name\n"
00 00 00 00 0a 0a 00         ; Preamble
[INIT block header]
[INIT bytecode]
25 73 74 61 74 65 5f 6f 6e 65 0a  ; Opcode 0x25 (STATE) + "state_one\n"
00 00 00 00 0a 0a 00         ; State preamble
[state_one bytecode]
25 ...                       ; Next state
```

### State Transitions (setstate)

**Source:**
```c
INIT {
    setstate(state_one);
}
```

**Bytecode:**
```hex
02 43 00 00        ; PUSH_UI_HANDLE (STATE state_one @ offset 0x0043)
0C 81 06 00        ; CALL_API setstate (ID=0x06)
```

### Activating State Machine (setstatemachine)

**Source:**
```c
inpainit() {
    setstatemachine(sm_main);
}
```

**Bytecode:**
```hex
02 42 00 00        ; PUSH_UI_HANDLE (STATEMACHINE @ offset 0x0042)
0C 81 05 00        ; CALL_API setstatemachine (ID=0x05)
```

### Key Points

- Keyword is `STATEMACHINE` (one word)
- States are **identifiers only** — no `STATE` keyword before them
- Opcode `0x25` marks each state definition
- State handles use same `0x02` opcode pattern as SCREEN/MENU
- Transitions via `setstate(state_identifier)` (ID=0x06)
- Register in init: `setstatemachine(sm_name)` (ID=0x05)
- Return from nested: `returnstatemachine()` (ID=0x08)

### State Machine Functions

| ID (hex) | Function | Signature |
|----------|----------|-----------|
| `0x05` | `setstatemachine` | `(in: STATEMACHINE handle)` |
| `0x06` | `setstate` | `(in: STATE handle)` |
| `0x08` | `returnstatemachine` | `()` |

---

## 13. Examples

### Example 1: Variable Assignment

**Source:** `x = 10;`

**Bytecode:**
```hex
01 01 00           ; PUSH_VAR_ADDR (Variable #1 = x)
00 06 00 00        ; PUSH_CONST (Constant #0 = 10)
00 05              ; STORE
```

### Example 2: Conditional Branch

**Source:** `if (x > 5) { ... }`

**Bytecode:**
```hex
00 01 01 00        ; PUSH_VAR_VAL (x at index 1)
00 06 01 00        ; PUSH_CONST (5 at index 1)
00 09 65           ; ALU_OP (> = 0x65)
00 0B 0E 00        ; JMP_FALSE +14 bytes (skip body)
[body: 14 bytes]
```

### Example 3: System Function Call

**Source:** `text(0, 0, "Hello");`

**Bytecode:**
```hex
00 06 00 00        ; PUSH_CONST (0)
00 06 00 00        ; PUSH_CONST (0)  
00 06 02 00        ; PUSH_CONST ("Hello" at index 2)
0C 81 48 00        ; CALL_API (text, ID=0x48)
```

### Example 4: Global Data Section

**Hex dump (3 variables: string, int, bool):**
```hex
47 6c 6f 62 61 6c 20 44 61 74 61 0a  ; "Global Data\n"
00 00 00 00 0a 0a 00                 ; Preamble
03 00                                ; Count = 3
01 00 04                             ; Header + separator
06 03 01                             ; Types: String, Int, Bool
```

### Example 5: Import32 Signature

**Source:**
```c
import32 "c" lib "kernel32::GetPrivateProfileStringA"
    GetIniString(in: string Section, in: string Key, in: string Default,
                 out: string Buffer, in: int BufSize, in: string FileName,
                 out: int Result);
```

**Binary string:**
```
kernel32::GetPrivateProfileStringA:c.sssSis%I
```

---

## Appendix: Unresolved Items

Items requiring further research:

### High Priority

| Item | Status | Notes |
|------|--------|-------|
| Header version bytes meaning | ⚠️ Unknown | `05 00`, `01 02`, `01 03` observed |
| Import signature `t` type | ⚠️ Unknown | Seen in `OpenFile` |
| Import signature `L` type | ⚠️ Unknown | Possibly LPARAM |

### Medium Priority

| Item | Status | Notes |
|------|--------|-------|
| Complete system function IDs | ⚠️ 62/108 | ~46 functions unmapped |
| Constant Data complex entries | ⚠️ Partial | Multi-type sequences unclear |
| ITEMREPEAT bytecode | ⚠️ Unknown | Dynamic menu items |

### Resolved (formerly unresolved)

| Item | Resolution |
|------|------------|
| Opcode `0x02` semantics | ✅ PUSH_UI_HANDLE — pushes section offset for SCREEN/MENU/STATE |
| State machine bytecode | ✅ Validated — section type 0x03, opcode 0x25 for states |
| LINE/ITEM bytecode | ✅ Validated — opcodes 0x22 and 0x24 respectively |
| UI setter function IDs | ✅ setmenu=0x01, setscreen=0x04, setstatemachine=0x05, setstate=0x06 |

---

## References

- `docs/research/phase1-findings.md` — Initial structure analysis
- `docs/research/phase2-findings.md` — Opcode discovery
- `docs/research/phase3-findings.md` — Function calls
- `docs/research/phase4-findings.md` — UI constructs
- `docs/research/phase5-findings.md` — State machines
- `docs/research/validation-findings-phase6.md` — Import32 analysis
- `docs/research/VALIDATION-REPORT.md` — Production validation
- `docs/research/system-function-ids-complete.md` — System function mapping
- `docs/research/language-constructs.md` — SCREEN/MENU/STATE bytecode analysis
- `docs/research/api32-exports.md` — api32.dll FFI analysis

---

*Document updated 2026-02-09. Integrated language construct research findings.*
