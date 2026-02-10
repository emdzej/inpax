# IPO File Format Specification

> **Status:** Definitive Reference  
> **Version:** 1.1  
> **Date:** 2026-02-10  
> **Validation:** 96% confirmed against production files

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
13. [LOGTABLE](#13-logtable)
14. [User-Defined Function Calls](#14-user-defined-function-calls)
15. [Examples](#15-examples)
16. [Appendix: Unresolved Items](#appendix-unresolved-items)

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
| `<logtable_name>` | LOGTABLE wrapper function (type 0x05) |
| `LT_<logtable_name>` | LOGTABLE lookup data (type 0x04) |

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
| **Bool** | `01 [value]` | `TRUE` → `01 01`, `FALSE` → `01 00` |
| **Byte** | `02 [u8 value]` | `255` → `02 ff` |
| **Int** | `03 [u16 LE value]` | `1000` → `03 e8 03` |
| **Long** | `04 [u32 LE value]` | `200000` → `04 40 0d 03 00` |
| **Real** | `05 [8-byte IEEE-754 LE]` | `3.14` → `05 1f 85 eb 51 b8 1e 09 40` |
| **String** | `06 [chars...] 0a` | `"Hello"` → `06 48 65 6c 6c 6f 0a` |

**Note:** Constants are referenced by index in bytecode via `PUSH_CONST (00 06 [idx])`.

---

## 6. Type Markers

Used in both Global Data (variable types) and Constant Data (value prefixes).

| Type | Byte | Size | Description |
|------|------|------|-------------|
| **Bool** | `0x01` | 1 byte | Boolean (TRUE=1, FALSE=0) |
| **Byte** | `0x02` | 1 byte | 8-bit unsigned integer (0-255) |
| **Int** | `0x03` | 2 bytes | 16-bit signed integer |
| **Long** | `0x04` | 4 bytes | 32-bit signed integer |
| **Real** | `0x05` | 8 bytes | IEEE-754 double (64-bit float, little-endian) |
| **String** | `0x06` | variable | Null-terminated or newline-delimited string |

> **Note:** The complete type marker sequence was confirmed on 2026-02-10 by compiling `ALLTYPES.ips` containing all six types. See `docs/research/long-type-research.md` for details.

### Constant Data Formats

| Type | Format | Example |
|------|--------|---------|
| Bool | `01 [value]` | `01 01` (TRUE), `01 00` (FALSE) |
| Byte | `02 [value]` | `02 ff` (255) |
| Int | `03 [u16 LE]` | `03 e8 03` (1000 = 0x03E8) |
| Long | `04 [u32 LE]` | `04 40 0d 03 00` (200000 = 0x00030D40) |
| Real | `05 [8-byte IEEE-754 LE]` | `05 1f 85 eb 51 b8 1e 09 40` (3.14) |
| String | `06 [chars...] 0a` | `06 74 65 73 74 0a` ("test") |

### Production Distribution (msd80n43.ipo, first 100 vars)

- String (0x06): 56 occurrences
- Bool (0x01): 24 occurrences
- Int (0x03): 12 occurrences
- Real (0x05): 5 occurrences
- Long (0x04): 3 occurrences (previously mislabeled as Byte)

---

## 7. Opcode Reference

The INPA VM is stack-based. Instructions are variable-length.

### Core Opcodes

| Opcode | Arguments | Mnemonic | Description |
|--------|-----------|----------|-------------|
| `01 [scope] [idx] 00` | Scope+Index | `PUSH_VAR_ADDR` | Push address of variable (for assignment) |
| `07 [scope] [idx] 00` | Scope+Index | `PUSH_VAR_VAL` | Push value of variable (for reading) |
| `00 06 [u16]` | Index | `PUSH_CONST` | Push constant from constant table |
| `00 05` | — | `STORE` | Pop value, pop address, write value to address |
| `00 09 [u8]` | Op | `ALU_OP` | Binary arithmetic/comparison operation |
| `00 0B [s16]` | Offset | `JMP_FALSE` | Pop condition; if false, jump by offset |
| `00 0E [s16]` | Offset | `JMP` | Unconditional relative jump |
| `02 [u16] 00` | Offset | `PUSH_UI_HANDLE` | Push handle to SCREEN/MENU/STATEMACHINE/STATE |
| `08 51 00 00` | — | `FUNC_PROLOGUE` | Function entry marker (follows frame info) |

#### Variable Scope Encoding (Issue #63)

Variable access opcodes (`01` and `07`) use a scope-based addressing scheme:

| Scope Byte | Meaning | Example |
|------------|---------|---------|
| `0x00` | Global variable | `01 00 01 00` = global var #1 address |
| `0x01` | Local variable | `01 01 01 00` = local var #1 address |
| `0x02` | Function parameter | `01 02 00 00` = param #0 address |

**Opcode Format:** `[01|07] [scope] [index] 00`
- `01` = PUSH_VAR_ADDR (for assignment LHS)
- `07` = PUSH_VAR_VAL (for reading)

**Index Conventions:**
- **Global:** 0-indexed, matches Global Data section order
- **Local:** 1-indexed (LOCAL[0] is reserved, first declared local is LOCAL[1])
- **Param:** 0-indexed, `in` params first, then `out` params (gaps may exist)

**Note:** This replaces the earlier understanding that `01 [u16]` was only for globals. The third byte is the index within that scope, and the fourth byte is always `00`.

#### Function Frame Structure

User-defined functions have a header structure before bytecode:

```
[func_name]\n [func_id u16] [type u16] 0a 0a 00 [frame_size u16] 08 51 00 00 [bytecode...]
```

- **func_id:** Unique function identifier (used in CALL_USER)
- **type:** Always 0x0000 for user functions
- **frame_size:** Stack frame size in bytes

**Frame Size Calculation:**
```
frame_size ≈ 3 (base) + 2×locals + 2×params + 2×(has_calls ? 1 : 0)
```

Where:
- Base (3 bytes): Return address + frame pointer
- Each local variable: 2 bytes (int = 16-bit)
- Each parameter slot: 2 bytes
- Call overhead: +2 bytes if function calls other functions

**Example Frame Sizes:**
| Function | Locals | Params | Calls | Frame |
|----------|--------|--------|-------|-------|
| `f()` with 1 local | 1 | 0 | N | 5 |
| `f()` with 1 local, calls | 1 | 0 | Y | 7 |
| `f(in: int, out: int)` + 1 local | 1 | 2 | N | 10 |

#### Function Prologue

User-defined functions begin with `FUNC_PROLOGUE` marker:

```
08 51 00 00
```

System functions (`inpainit`, `inpaexit`) may omit prologue if they have no locals.

See `docs/research/local-variables-research.md` for complete analysis.

### UI Construct Markers

| Opcode | Mnemonic | Description |
|--------|----------|-------------|
| `0x21` | `SCREEN_START` | SCREEN section marker |
| `0x22` | `LINE` | LINE construct marker |
| `0x23` | `CONTROL` | ✅ CONTROL block marker (confirmed via compilation test) |
| `0x24` | `ITEM` | MENU ITEM marker |
| `0x25` | `STATE` | STATE definition marker |

> **Note:** The `CONTROL` opcode (0x23) was confirmed on 2026-02-10 by compiling test files with INPACOMP.exe on Windows. The CONTROL block code is compiled into a separate internal function named `#` (or `!` for the first LINE body), and the `0x23` opcode marks the CONTROL block boundary within a LINE. See `docs/research/control-block-research.md` for details.

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

### Complete Mapping (159 functions)

| ID (hex) | Function | Signature |
|----------|----------|-----------|
| `0x00` | `setmenutitle` | `(in: string title)` |
| `0x01` | `setmenu` | `(in: MENU handle)` |
| `0x02` | `setitem` | `(in: int ItemNum, in: string ItemText, in: bool Enabled)` |
| `0x03` | `settitle` | `(in: string title)` |
| `0x04` | `setscreen` | `(in: SCREEN handle, in: bool cyclic)` |
| `0x05` | `setstatemachine` | `(in: STATEMACHINE handle)` |
| `0x06` | `setstate` | `(in: STATE handle)` |
| `0x07` | `callstatemachine` | `(in: STATEMACHINE handle)` |
| `0x08` | `returnstatemachine` | `()` |
| `0x09` | `settimer` | `(in: int timernum, in: int timeval)` |
| `0x0A` | `testtimer` | `(in: int timernum, out: bool expiredflag)` |
| `0x0B` | `setjobstatus` | `(in: int JobStatus)` |
| `0x0C` | `exit` | `()` |
| `0x0D` | `exitwindows` | `()` |
| `0x0E` | `scriptselect` | `(in: string ScriptSelectIniFile)` |
| `0x0F` | `scriptchange` | `(in: string NewScriptFile)` |
| `0x10` | `select` | `(in: bool MultipleSelectFlag)` |
| `0x11` | `deselect` | `()` |
| `0x12` | `control` | `()` |
| `0x13` | `start` | `()` |
| `0x14` | `stop` | `()` |
| `0x15` | `getapistring` | `(in: bool ArgNumFlag, in: bool FullScreenFlag, out: string ApiString)` |
| `0x16` | `togglelist` | `(in: bool MultipleSelectFlag, in: bool ArgNumFlag, out: string ApiToggleString)` |
| `0x17` | `printscreen` | `()` |
| `0x18` | `printfile` | `(out: int ErrorCode, in: string FileName, in: string PrinterName, in: string PrinterPort, in: bool ErrorMsgFlag)` |
| `0x1A` | `setcolor` | `(in: int ForeColor, in: int BackColor)` |
| `0x1B` | `delay` | `(in: int Time)` |
| `0x1C` | `getdate` | `(out: string date)` |
| `0x1D` | `gettime` | `(out: string time)` |
| `0x1E` | `realtostring` | `(in: real value, in: string format, out: string result)` |
| `0x1F` | `stringtoreal` | `(in: string value, out: real result)` |
| `0x20` | `inttostring` | `(in: int value, out: string result)` |
| `0x21` | `stringtoint` | `(in: string value, out: int result)` |
| `0x22` | `hexconvert` | `(in: string HexString, out: int high, out: int mid, out: int low, out: int seg)` |
| `0x23` | `strcat` | `(out: string dest, in: string left, in: string right)` |
| `0x24` | `strlen` | `(out: int length, in: string str)` |
| `0x25` | `midstr` | `(out: string result, in: string str, in: int start, in: int length)` |
| `0x26` | `realtoint` | `(in: real value, out: int result)` |
| `0x27` | `inttoreal` | `(in: int value, out: real result)` |
| `0x28` | `bytetoint` | `(in: byte value, out: int result)` |
| `0x29` | `inttolong` | `(in: int value, out: long result)` |
| `0x2A` | `longtoreal` | `(in: long value, out: real result)` |
| `0x2B` | `PEMInitialisiere` | `(out: bool Result)` |
| `0x2C` | `PEMProtokollKopf` | `(out: bool Result)` |
| `0x2D` | `PEMProtokollZeile` | `(out: bool Result)` |
| `0x2E` | `PEMSGZ_Kopfzeile` | `(out: bool Result)` |
| `0x2F` | `PEMTrennLinie` | `(out: bool Result)` |
| `0x30` | `PEMEndLinie` | `(out: bool Result)` |
| `0x31` | `PEMLoescheTabZeilenPuffer` | `(out: bool Result)` |
| `0x32` | `PEMUebertrageTabZeilenPuffer` | `(out: bool Result)` |
| `0x33` | `PEMProtokollAusgabe` | `(out: bool Result)` |
| `0x34` | `PEMDruckeEtikett` | `(out: bool Result)` |
| `0x36` | `PEMPrintFormular` | `(out: bool Result)` |
| `0x37` | `PEMPrinter_ff` | `(out: bool Result)` |
| `0x38` | `PEMFree_mem` | `(out: bool Result)` |
| `0x39` | `PEMLoad_formular` | `(out: bool Result)` |
| `0x3A` | `PEMDefault_druckfeld` | `(out: bool Result)` |
| `0x3B` | `PEMDefault_besetzen` | `(out: bool Result)` |
| `0x3C` | `PEMForget_formular` | `(out: bool Result)` |
| `0x3D` | `PEMWrite_druckfeld` | `(out: bool Result)` |
| `0x3E` | `getinputstate` | `(out: int InputState)` |
| `0x3F` | `inputtext` | `(out: string text, in: string Title, in: string Text)` |
| `0x40` | `inputnum` | `(out: real val, in: string BoxTitle, in: string BoxText, in: real minval, in: real maxval)` |
| `0x41` | `inputhex` | `(out: string hex, in: string Title, in: string Text, in: string Min, in: string Max)` |
| `0x42` | `inputdigital` | `(out: int value, in: string Title, in: string Text, in: string OffText, in: string OnText)` |
| `0x43` | `input2text` | `(out: string str1, out: string str2, in: string BoxTitle, in: string BoxText, in: string BoxStr1, in: string BoxStr2)` |
| `0x44` | `input2hexnum` | `(out: string hexstr, out: int num, in: string BoxTitle, in: string BoxText, in: string BoxStr1, in: string BoxStr2, in: string MinHexStr, in: string MaxHexStr, in: int minnum, in: int maxnum)` |
| `0x45` | `input2hex` | `(out: string hexstr1, out: string hexstr2, in: string BoxTitle, in: string BoxText, in: string BoxStr1, in: string BoxStr2, in: string MinHexStr1, in: string MaxHexStr1, in: string MinHexStr2, in: string MaxHexStr2)` |
| `0x46` | `inputint` | `(out: int value, in: string Title, in: string Text, in: int Min, in: int Max)` |
| `0x47` | `input2int` | `(out: int val1, out: int val2, in: string BoxTitle, in: string BoxText, in: string BoxStr1, in: string BoxStr2, in: int min1, in: int max1, in: int min2, in: int max2)` |
| `0x48` | `text` | `(in: int row, in: int col, in: string text)` |
| `0x49` | `textout` | `(in: string text, in: int row, in: int col)` |
| `0x4A` | `ftextout` | `(in: string text, in: int row, in: int col, in: int fgcolor, in: int bgcolor, in: int fontsize, in: int fontattr)` |
| `0x4B` | `digitalout` | `(in: bool val, in: int row, in: int col, in: string TrueText, in: string FalseText)` |
| `0x4C` | `analogout` | `(in: real val, in: int row, in: int col, in: real min, in: real max, in: real minvalid, in: real maxvalid, in: string format)` |
| `0x4D` | `multianalogout` | `(in: int row, in: int col, ...)` |
| `0x4E` | `hexdump` | `(in: int row, in: int col, in: string data, in: int len)` |
| `0x4F` | `ftextclear` | `(in: string text, in: int row, in: int col, in: int textsize, in: int textattr)` |
| `0x50` | `clearrect` | `(in: int row, in: int col, in: int width, in: int height)` |
| `0x51` | `blankscreen` | `()` |
| `0x52` | `messagebox` | `(in: string Title, in: string Text)` |
| `0x53` | `infobox` | `(in: string Title, in: string Text)` |
| `0x54` | `userboxopen` | `(in: int BoxNum, in: int row, in: int col, in: int height, in: int width, in: string TitleStr, in: string TextStr)` |
| `0x55` | `userboxclose` | `(in: int BoxNum)` |
| `0x56` | `userboxftextout` | `(in: int BoxNum, in: string Text, in: int Row, in: int Col, in: int ForeColor, in: int BackColor)` |
| `0x57` | `userboxclear` | `(in: int BoxNum)` |
| `0x58` | `userboxsetcolor` | `(in: int BoxNum, in: int ForeColor, in: int BackColor)` |
| `0x59` | `winhelp` | `(in: string helpfile)` |
| `0x5A` | `winhelpkey` | `(in: string helpfile, in: string key)` |
| `0x5B` | `callwin` | `(in: string cmdline)` |
| `0x5C` | `viewopen` | `(in: string FileNameStr, in: string TitleStr)` |
| `0x5D` | `viewclose` | `()` |
| `0x5E` | `simnum` | `(out: real val, in: string BoxTitle, in: string BoxText, in: real minval, in: real maxval)` |
| `0x5F` | `simdigital` | `(out: bool val, in: string BoxTitle, in: string BoxText, in: string FalseStr, in: string TrueStr)` |
| `0x60` | `INPAapiInit` | `()` |
| `0x61` | `INPAapiEnd` | `()` |
| `0x62` | `INPAapiJob` | `(in: string ecu, in: string Job, in: string Arg1, in: string Arg2)` |
| `0x63` | `INPAapiResultText` | `(out: string ResultText, in: string ApiResult, in: int ApiSet, in: string Format)` |
| `0x64` | `INPAapiResultInt` | `(out: int ResultInt, in: string ApiResult, in: int ApiSet)` |
| `0x65` | `INPAapiResultSets` | `(out: int sets)` |
| `0x66` | `INPAapiResultDigital` | `(out: bool ResultValue, in: string ApiResult, in: int ApiSet)` |
| `0x67` | `INPAapiResultAnalog` | `(out: real ResultValue, in: string ApiResult, in: int ApiSet)` |
| `0x68` | `INPAapiResultBinary` | `(in: string ApiResult, in: int ApiSet)` |
| `0x69` | `INPAapiCheckJobStatus` | `(in: string RefStr)` |
| `0x6A` | `INPAapiFsLesen2` | `(in: string ecu, in: string FileName)` |
| `0x6B` | `INPAapiFsLesen` | `(in: string ecu, in: string FileName)` |
| `0x6C` | `INPAapiFsMode` | `(in: int FsMode, in: string FsFileMode, in: string PreInfoFile, in: string PostInfoFile, in: string ApiFsJobName)` |
| `0x6D` | `INP1apiInit` | `(out: bool rc)` |
| `0x6E` | `INP1apiEnd` | `()` |
| `0x6F` | `INP1apiJob` | `(in: string ecu, in: string Job, in: string Arg1, in: string Arg2)` |
| `0x70` | `INP1apiState` | `(out: int ApiState)` |
| `0x71` | `INP1apiResultText` | `(out: bool rc, out: string ResultText, in: string ApiResult, in: int ApiSet, in: string Format)` |
| `0x72` | `INP1apiResultInt` | `(out: bool rc, out: int ResultInt, in: string ApiResult, in: int ApiSet)` |
| `0x73` | `INP1apiResultSets` | `(out: bool rc, out: int sets)` |
| `0x74` | `INP1apiResultReal` | `(out: bool rc, out: real ResultValue, in: string ApiResult, in: int ApiSet)` |
| `0x75` | `INP1apiResultBinary` | `(out: bool rc, in: string ApiResult, in: int ApiSet)` |
| `0x76` | `INP1apiErrorCode` | `(out: int ErrorCode)` |
| `0x77` | `INP1apiErrorText` | `(out: string ErrorText)` |
| `0x78` | `GetBinaryDataString` | `(out: string DataString, out: int DataStringLen)` |
| `0x79` | `fileopen` | `(in: string FileName, in: string OpenMode)` |
| `0x7A` | `fileclose` | `()` |
| `0x7B` | `filewrite` | `(in: string str)` |
| `0x7C` | `fileread` | `(out: string str, out: bool EOF)` |
| `0x7D` | `DTMFindLogUnit` | `(out: bool rc, in: string LogUnit)` |
| `0x7E` | `DTMGetSGVar` | `(out: string SGVar, in: string SGArt)` |
| `0x7F` | `DTMGetSGArt` | `(out: string SGArt, in: string SGVar)` |
| `0x80` | `DTMGetVarWert` | `(out: string VarWert, in: string VarName)` |
| `0x81` | `DTMSetupGetVarWert` | `(out: string VarWert, in: string VarName)` |
| `0x82` | `DTMSetupGetStartPosition` | `()` |
| `0x83` | `DTMSetupGetNextAssoc` | `(out: bool rc, inout: string VarName, inout: string VarWert)` |
| `0x84` | `DTMLogUnitEintragen` | `(in: string LogUnit)` |
| `0x85` | `DTMSGEintragen` | `(in: string SGArt, in: string SGVar)` |
| `0x86` | `DTMLoescheAuftrag` | `()` |
| `0x87` | `DTMVariableEintragen` | `(in: string VarName, in: string VarWert)` |
| `0x88` | `DTMVariableLoeschen` | `(out: bool rc, in: string VarName)` |
| `0x89` | `DTMLoescheAlleVariablen` | `()` |
| `0x8A` | `DTMSetupVariableEintragen` | `(in: string VarName, in: string VarWert)` |
| `0x8B` | `DTMSetupVariableLoeschen` | `(out: bool rc, in: string VarName)` |
| `0x8C` | `StrArrayCreate` | `(out: bool rc, out: int hStrArray)` |
| `0x8D` | `StrArrayDestroy` | `(in: int hStrArray)` |
| `0x8E` | `StrArrayWrite` | `(in: int hStrArray, in: int index, in: string str)` |
| `0x8F` | `StrArrayRead` | `(in: int hStrArray, in: int index, out: string str)` |
| `0x90` | `StrArrayGetElementCount` | `(in: int hStrArray, out: int ElementCount)` |
| `0x91` | `StrArrayDelete` | `(in: int hStrArray)` |
| `0x92` | `SPSInit` | `()` |
| `0x93` | `SPSEnd` | `()` |
| `0x94` | `SPSLeseVonSPS` | `(...)` |
| `0x95` | `SPSSendeAnSPS` | `(...)` |
| `0x96` | `SPSLeseVakWerte` | `(...)` |
| `0x97` | `ApiJobFsLesenFAB` | `(out: int rc, in: string sgvar, out: int edifehler, out: string jobstatus, out: int fehler, out: int saetze)` |
| `0x98` | `ApiResultFsLesenFAB` | `(out: int rc, out: int ausgeblendet, in: int satz)` |
| `0x99` | `ELDIOpenStartDialog` | `(in: string CommandParameter, out: int ResultCode)` |
| `0x9A` | `CreateStructure` | `(out: long handle, in: int length)` |
| `0x9B` | `SetStructureMode` | `(in: int ReadWrite)` |
| `0x9C` | `StructureByte` | `(in: long handle, in: int Offset, inout: byte value)` |
| `0x9D` | `StructureInt` | `(in: long handle, in: int Offset, inout: int value)` |
| `0x9E` | `StructureLong` | `(in: long handle, in: int Offset, inout: long value)` |
| `0x9F` | `StructureString` | `(in: long handle, in: int Offset, in: int length, inout: string value)` |
| `0xA1` | `setitemrepeat` | `(in: int ItemNum, in: bool Enabled)` |

**Notes:**
- `setjobstatus` (0x0B) inferred from sequential IDs — INPACOMP reports "no longer supported"
- DTM functions (0x7D-0x8B) — WinEldi-only, "no longer supported"
- SPS functions (0x92-0x96) — IDs inferred from sequential range
- API/ELDI functions (0x97-0x99) — "no longer supported"

---

## 9. Import32 / DLL Calls

External DLL functions are imported using `import32` (32-bit) or `import` (16-bit) syntax and stored as signature strings in the IPO.

### Source Syntax

```c
// 32-bit DLLs
import32 "Convention" lib "DLL::Function" Alias(parameters);

// 16-bit DLLs (legacy, same bytecode format)
import "Convention" lib "DLL::Function" Alias(parameters);
```

### Binary Format

Both `import` and `import32` produce **identical bytecode format**. The IPO contains import strings in format:
```
DLL::Function:convention.signature
```

### 16-bit vs 32-bit Differences

The only difference between `import` and `import32` is the **case of the calling convention letter**:

| Convention | 16-bit (`import`) | 32-bit (`import32`) |
|------------|-------------------|---------------------|
| Pascal | `P` | `p` |
| C/cdecl | `C` | `c` |
| Stdcall | `S` | `s` |

**Parser recommendation:** Treat calling convention case-insensitively.

**Research:** See `docs/research/import16-research.md` for detailed analysis (issue #65).

### Examples from Production Files

```
kernel32::GetPrivateProfileStringA:c.sssSis%I
api32.DLL::__apiGetConfig:c.lsS%I
INPA_LIB32.DLL::SaveAsDialogBox:c.sSi%I
XTRACT32.DLL::XTRACT:c.siSl%I
kernel32::OpenFile:c.stLi%I
user.exe::MessageBox:P.issi%I          (16-bit example)
```

### Signature Decoding

| Char | Meaning | Direction |
|------|---------|-----------|
| `c`/`C` | Calling convention: cdecl | — |
| `p`/`P` | Calling convention: pascal | — |
| `s`/`S` (in params) | string (LPCSTR) | input |
| `S` (in params) | String buffer (LPSTR) | output |
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
| `0x04` | LOGTABLE data | Lookup table entries (`LT_` prefix) |
| `0x05` | LOGTABLE wrapper | Parameter handling function |

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

## 13. LOGTABLE

LOGTABLE is a boolean logic mapping construct that compiles to a **lookup table**, not if-else chains.

### Source Syntax

```c
LOGTABLE table_name(out: bool out1 out2, in: bool in1 in2 in3)
{
    // Output : Input
    0y00: 0y000;  // Exact match
    0y01: 0y10X;  // X = don't care
    0y10: 0y010;
    0y11: OTHER;  // Default case
}

// Usage:
bool o1, o2;
table_name(o1, o2, TRUE, FALSE, TRUE);
```

### Compilation Output

The compiler generates **two sections** for each LOGTABLE:

| Section | Type | Purpose |
|---------|------|---------|
| `lt_name` | `0x05` | Wrapper function (parameter handling) |
| `LT_lt_name` | `0x04` | Lookup table data (space before `LT_`) |

### Lookup Table Binary Format

After the section header and preamble:

```
[u32 LE: entry_count]
[entry × entry_count]
```

Each **entry is 12 bytes**:

```c
struct LogtableEntry {
    u32 input_value;    // Input bit pattern to match
    u32 input_mask;     // Bitmask for comparison
    u32 output_value;   // Output bit pattern
}
```

### Mask Encoding

| Pattern | Mask Value | Meaning |
|---------|------------|---------|
| Exact match | `0xFFFFFFFF` | All bits must match |
| Don't care (X) | Partial mask | Only masked bits checked |
| OTHER | `0x00000000` | Matches any input (default) |

### Runtime Evaluation

```
for entry in table:
    if (input & entry.mask) == (entry.input_value & entry.mask):
        return entry.output_value
```

### Example: Don't Care (X)

**Source:**
```c
LOGTABLE lt_test(out: bool o1, in: bool i1 i2 i3)
{
    0y0: 0y00X;   // output=0 when i1=0, i2=0, i3=any
    0y1: 0yX1X;   // output=1 when i2=1 (i1,i3=any)
    0y0: OTHER;
}
```

**Compiled entries:**
```
Entry 0: input=0b000, mask=0b110 (0x06), output=0  ; 0y00X
Entry 1: input=0b010, mask=0b010 (0x02), output=1  ; 0yX1X  
Entry 2: input=0,     mask=0 (OTHER),    output=0  ; default
```

### Multiple Outputs

Multiple output bits are packed into a single integer:

```c
LOGTABLE lt_multi(out: bool o1 o2, in: bool i1 i2)
{
    0y00: 0y00;  // o1=0, o2=0 → output=0b00
    0y01: 0y01;  // o1=0, o2=1 → output=0b01
    0y10: 0y10;  // o1=1, o2=0 → output=0b10
    0y11: 0y11;  // o1=1, o2=1 → output=0b11
}
```

---

## 14. User-Defined Function Calls

### Mechanism: CALL Opcode (Not Inline Expansion)

**INPA uses explicit CALL opcodes for user-defined functions**, not inline expansion. This was confirmed by analyzing production `.ipo` files.

### Evidence

1. **`CALL_USER` opcode exists:** `0C 80 [u16 funcID]`
2. **Same function called multiple times:**
   - In `startus.ipo`: function 0x20 is called 49 times
   - In `startus.ipo`: function 0x05 (`bytetohexstring`) is called 3 times
3. **File size is small:** `startus.ipo` is only 13KB with 21 functions called many times
4. **If inlined:** calling function 0x20 (49 times) would bloat the file ~49x

### Function ID Assignment

Function IDs are 0-indexed section numbers within the IPO file:

```
Section 0: inpainit      → CALL_USER 0x00
Section 1: inpaexit      → CALL_USER 0x01
Section 2: __inpa_startup__ → CALL_USER 0x02
...
```

**Example from `S_FUNK_I.IPO`:**
```hex
0c 80 02 00        ; CALL_USER 0x02 (calls __inpa_startup__)
0c 80 03 00        ; CALL_USER 0x03 (calls __inpa_shutdown__)
```

### Return Mechanism

**No explicit RET opcode was found.** Functions appear to return implicitly at section end.

The pattern `0E 00 00 00` (or similar padding) appears before section boundaries, which may serve as a function terminator/alignment, but this is not a dedicated RET instruction.

### Parameter Passing

Parameters are passed via the stack. Arguments are pushed before `CALL_USER`:

**Source:**
```c
add(in: int a, in: int b, out: int c)
{
    c = a + b;
}

// Call
int result;
add(1, 2, result);
```

**Bytecode (conceptual):**
```hex
00 06 [const_1]    ; PUSH_CONST (1)
00 06 [const_2]    ; PUSH_CONST (2)
01 [result_idx]    ; PUSH_VAR_ADDR (result - for out param)
0C 80 [funcID] 00  ; CALL_USER (add function)
```

### Implications for Interpreter Design

1. **Call stack required:** The interpreter must maintain a call stack for return addresses
2. **Section index table:** Function IDs map to section indices, requiring a section lookup table
3. **No recursion depth check:** Without explicit RET tracking, stack overflow protection may be needed
4. **Parameter convention:** `in` params by value, `out`/`inout` params by reference (address)

---

## 15. Examples

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
| RET/function return opcode | ⚠️ Unknown | No explicit RET found; functions may return at section boundary |
| Complete system function IDs | ⚠️ 97/108 | 11 functions unmapped |
| Constant Data complex entries | ⚠️ Partial | Multi-type sequences unclear |

### Resolved (formerly unresolved)

| Item | Resolution |
|------|------------|
| Local variables in functions | ✅ **Scope-based addressing** — `01 [scope] [idx] 00` format; scope: 0x00=global, 0x01=local, 0x02=param; see `docs/research/local-variables-research.md` (issue #63) |
| Function prologue opcode | ✅ **`08 51 00 00`** — FUNC_PROLOGUE marker at start of function body; preceded by frame info u16 |
| CONTROL block opcode | ✅ **Opcode 0x23** — Confirmed via INPACOMP.exe test compilation; CONTROL code compiled to `#` function; see `docs/research/control-block-research.md` |
| LOGTABLE bytecode | ✅ **Lookup table** — Section types 0x04 (data) + 0x05 (wrapper); entries are 12-byte [input, mask, output] |
| User-defined function mechanism | ✅ **CALL opcode** — `0C 80 [funcID]` calls functions by section index; no inline expansion |
| Opcode `0x02` semantics | ✅ PUSH_UI_HANDLE — pushes section offset for SCREEN/MENU/STATE |
| State machine bytecode | ✅ Validated — section type 0x03, opcode 0x25 for states |
| LINE/ITEM bytecode | ✅ Validated — opcodes 0x22 and 0x24 respectively |
| UI setter function IDs | ✅ setmenu=0x01, setscreen=0x04, setstatemachine=0x05, setstate=0x06 |
| Long type marker | ✅ **`0x04`** — 32-bit signed integer; Byte corrected to `0x02`; see `docs/research/long-type-research.md` (issue #64) |
| setitemrepeat bytecode | ✅ **System function 0xA1** — Standard `CALL_API` call, no ITEM structure changes; see `docs/research/itemrepeat-research.md` (issue #66) |

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
- `docs/research/logtable-bytecode-analysis.md` — LOGTABLE research (issue #59)
- `docs/research/control-block-research.md` — CONTROL block research (issue #60)
- `docs/research/local-variables-research.md` — Local variables research (issue #63)
- `docs/research/long-type-research.md` — Long type marker research (issue #64)
- `docs/research/itemrepeat-research.md` — setitemrepeat bytecode research (issue #66)

---

*Document updated 2026-02-10. Added setitemrepeat system function ID 0xA1 (issue #66).*
