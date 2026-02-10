# Section Type Markers Research

> **Issue:** #72  
> **Date:** 2026-02-10  
> **Status:** ✅ RESOLVED (validated with TEST_LT01.ipo, TEST_LT02.ipo)  

## Problem Statement

The disassembler was labeling `inpaexit` as `logtable-func` in files that don't have LOGTABLE sections (like `E46_NEW.ipo`). This suggested that section type markers `0x04`/`0x05` might not be LOGTABLE-specific.

## Research Findings

### Section Header Structure

Each section in an IPO file has this structure:
```
[4 bytes: previous section data or padding] [1 byte: type marker] [name bytes] 0x0A [4 bytes: section ID] 0x0A 0x0A 0x00 [content]
```

The type marker byte immediately precedes the section name.

### Confirmed Section Type Markers

| Marker | Type | Description |
|--------|------|-------------|
| 0x01 | SCREEN | Screen definitions (`s_name`) |
| 0x02 | MENU | Menu definitions (`m_name`) |
| 0x03 | STATEMACHINE | State machine definitions (`sm_name`) |
| 0x04 | LOGTABLE Data | Lookup table entries (` LT_name` with leading space) |
| 0x05 | Function | **Any function** (user-defined, inpainit, inpaexit, __inpa_startup__, __inpa_shutdown__, LOGTABLE wrapper) |

### Key Discovery

**Marker `0x05` is NOT specific to LOGTABLE!** It's used for ALL functions:
- User-defined functions (e.g., `helper`, `chr`, `asc`)
- System entry points (`inpainit`, `inpaexit`)
- Internal functions (`__inpa_startup__`, `__inpa_shutdown__`)
- LOGTABLE wrapper functions (e.g., `lt_simple`)

### Evidence

#### LOGT01.ipo (has LOGTABLE)
```hex
0x0010: 05 6c 74 5f 73 69 6d 70 6c 65 0a  ; 05 lt_simple (wrapper function)
0x0034: 04 20 4c 54 5f...                  ; 04 [space]LT_... (lookup data)
0x0064: 05 69 6e 70 61 69 6e 69 74 0a     ; 05 inpainit
0x0094: 05 69 6e 70 61 65 78 69 74 0a     ; 05 inpaexit
```

#### FUNC01.ipo (NO LOGTABLE, just user functions)
```hex
0x0010: 05 68 65 6c 70 65 72 0a           ; 05 helper (user function)
0x0036: 05 69 6e 70 61 69 6e 69 74 0a     ; 05 inpainit
0x0056: 05 69 6e 70 61 65 78 69 74 0a     ; 05 inpaexit
```

#### E46_NEW.ipo (NO LOGTABLE, functions from BMW_STD.H)
```hex
0x0010: 05 63 68 72 69 6e 69 74 0a        ; 05 chrinit (user function from include)
0x006c: 05 63 68 72 0a                    ; 05 chr (user function)
0x0122: 05 61 73 63 0a                    ; 05 asc (user function)
0x0ace: 02 6d 5f 6d 61 69 6e 0a           ; 02 m_main (MENU)
0x0c4e: 01 73 5f 6d 61 69 6e 0a           ; 01 s_main (SCREEN)
```

### How to Distinguish LOGTABLE Wrapper from Regular Function

Since marker `0x05` is used for both regular functions and LOGTABLE wrappers, the only way to identify a LOGTABLE wrapper is:

1. **By naming convention:** Functions named `lt_*` or `LT_*` are LOGTABLE wrappers
2. **By presence of matching data section:** If there's a marker `0x04` section named ` LT_<same_name>`, then the `0x05` section is a LOGTABLE wrapper

### Recommended Disassembler Changes

1. **Rename marker types:**
   - `0x04` → `logtable-data` (unchanged)
   - `0x05` → `function` (NOT `logtable-func`)

2. **Use inference for LOGTABLE wrappers:**
   - If name matches `lt_*` pattern AND there's a corresponding `LT_*` data section → `logtable-func`
   - Otherwise → `function`

3. **Remove marker-based logtable-func detection:**
   - Don't assume `0x05` means LOGTABLE wrapper

## Updated Type Marker Table for IPO_Structure.md

| Marker | Type | Notes |
|--------|------|-------|
| 0x01 | SCREEN | Screen UI definition |
| 0x02 | MENU | Menu UI definition |
| 0x03 | STATEMACHINE | State machine definition |
| 0x04 | LOGTABLE Data | Lookup table (name prefixed with space + `LT_`) |
| 0x05 | Function | All functions (user, system, LOGTABLE wrapper) |

## Files Analyzed

- `/Users/emdzej/Documents/LOGT01.ipo` - LOGTABLE test file
- `/Users/emdzej/Documents/LOGT02.ipo` - LOGTABLE with don't-care
- `/Users/emdzej/Documents/FUNC01.ipo` - User function without LOGTABLE
- `/Users/emdzej/Documents/ipo/E46_NEW.ipo` - Production file with BMW_STD.H functions
- `/Users/emdzej/Documents/TEST_LT01.ipo` - LOGTABLE + user function test
- `/Users/emdzej/Documents/TEST_LT02.ipo` - User functions only (no LOGTABLE)

### Additional Test Data (issue #72 validation)

#### TEST_LT01.ipo (LOGTABLE + user function)
```
Source: my_func(), lt_test(LOGTABLE), inpainit, inpaexit
```
```hex
0x0010: 05 my_func      ; marker 0x05 = function
0x0037: 05 lt_test      ; marker 0x05 = function (LOGTABLE wrapper)
0x0058: 04  LT_lt_test  ; marker 0x04 = logtable-data (space prefix)
0x0093: 05 inpainit     ; marker 0x05 = function
0x00b0: 05 inpaexit     ; marker 0x05 = function
```

#### TEST_LT02.ipo (user functions only, NO LOGTABLE)
```
Source: func_a(), func_b(), inpainit, inpaexit
```
```hex
0x0010: 05 func_a       ; marker 0x05 = function
0x0033: 05 func_b       ; marker 0x05 = function
0x005a: 05 inpainit     ; marker 0x05 = function
0x0080: 05 inpaexit     ; marker 0x05 = function
```

**Key observation:** Both files use marker `0x05` for ALL functions regardless of whether LOGTABLE exists.

## Conclusion

The bug was caused by incorrectly interpreting section marker `0x05` as "LOGTABLE function". In reality, `0x05` marks ANY function. The disassembler should be updated to use marker `0x05` as generic "function" type and rely on naming conventions to identify LOGTABLE wrappers.
