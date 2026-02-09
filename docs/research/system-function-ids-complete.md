# System Function ID Map - Complete

**Date:** 2026-02-09  
**Status:** Complete - 97/108 functions mapped  
**Method:** Automated compilation of test scripts

## Summary

Successfully extracted System Function IDs by compiling minimal test scripts for each function in `inpa.h`. The compiler generates bytecode with opcode `0C 81 XX 00` where `XX` is the function ID.

**Success Rate:** 97/108 (89.8%)

**Unmapped Functions:** Functions that could not be compiled fall into these categories:
- DTM functions (likely require WinEldi environment)
- Remaining conversion helpers with complex parameter patterns
- Input/output variants that require specialized contexts

## Complete Mapping

| ID (hex) | ID (dec) | Function Name | Signature |
|----------|----------|---------------|-----------|
| 0x00 | 0 | setmenutitle | (in: string title) |
| 0x01 | 1 | setmenu | (in: MENU handle) |
| 0x02 | 2 | setitem | (in: int ItemNum, in: string ItemText, in: bool Enabled) |
| 0x03 | 3 | settitle | (in: string title) |
| 0x07 | 7 | callstatemachine | (in: STATEMACHINE handle) |
| 0x08 | 8 | returnstatemachine | () |
| 0x09 | 9 | settimer | (in: int timernum, in: int timeval) |
| 0x0C | 12 | exit | () |
| 0x0D | 13 | exitwindows | () |
| 0x0E | 14 | scriptselect | (in: string ScriptSelectIniFile) |
| 0x0F | 15 | scriptchange | (in: string NewScriptFile) |
| 0x11 | 17 | deselect | () |
| 0x12 | 18 | control | () |
| 0x13 | 19 | start | () |
| 0x14 | 20 | stop | () |
| 0x17 | 23 | printscreen | () |
| 0x1B | 27 | delay | (in: int Time) |
| 0x1C | 28 | getdate | (out: string date) |
| 0x1D | 29 | gettime | (out: string time) |
| 0x1E | 30 | realtostring | (in: real value, in: string format, out: string result) |
| 0x1F | 31 | stringtoreal | (in: string value, out: real result) |
| 0x20 | 32 | inttostring | (in: int value, out: string result) |
| 0x21 | 33 | stringtoint | (in: string value, out: int result) |
| 0x23 | 35 | strcat | (out: string dest, in: string left, in: string right) |
| 0x24 | 36 | strlen | (out: int length, in: string str) |
| 0x25 | 37 | midstr | (out: string result, in: string str, in: int start, in: int length) |
| 0x2B | 43 | PEMInitialisiere | (out: bool Result) |
| 0x2C | 44 | PEMProtokollKopf | (out: bool Result) |
| 0x2D | 45 | PEMProtokollZeile | (out: bool Result) |
| 0x2E | 46 | PEMSGZ_Kopfzeile | (out: bool Result) |
| 0x2F | 47 | PEMTrennLinie | (out: bool Result) |
| 0x30 | 48 | PEMEndLinie | (out: bool Result) |
| 0x31 | 49 | PEMLoescheTabZeilenPuffer | (out: bool Result) |
| 0x32 | 50 | PEMUebertrageTabZeilenPuffer | (out: bool Result) |
| 0x33 | 51 | PEMProtokollAusgabe | (out: bool Result) |
| 0x34 | 52 | PEMDruckeEtikett | (out: bool Result) |
| 0x36 | 54 | PEMPrintFormular | (out: bool Result) |
| 0x37 | 55 | PEMPrinter_ff | (out: bool Result) |
| 0x38 | 56 | PEMFree_mem | (out: bool Result) |
| 0x39 | 57 | PEMLoad_formular | (out: bool Result) |
| 0x3A | 58 | PEMDefault_druckfeld | (out: bool Result) |
| 0x3B | 59 | PEMDefault_besetzen | (out: bool Result) |
| 0x3C | 60 | PEMForget_formular | (out: bool Result) |
| 0x3D | 61 | PEMWrite_druckfeld | (out: bool Result) |
| 0x3E | 62 | getinputstate | (out: int InputState) |
| 0x3F | 63 | inputtext | (out: string text, in: string Title, in: string Text) |
| 0x41 | 65 | inputhex | (out: string hex, in: string Title, in: string Text, in: string Min, in: string Max) |
| 0x42 | 66 | inputdigital | (out: int value, in: string Title, in: string Text, in: string OffText, in: string OnText) |
| 0x46 | 70 | inputint | (out: int value, in: string Title, in: string Text, in: int Min, in: int Max) |
| 0x48 | 72 | text | (in: int row, in: int col, in: string text) |
| 0x49 | 73 | textout | (in: string text, in: int row, in: int col) |
| 0x51 | 81 | blankscreen | () |
| 0x52 | 82 | messagebox | (in: string Title, in: string Text) |
| 0x53 | 83 | infobox | (in: string Title, in: string Text) |
| 0x54 | 84 | userboxopen | (in: int BoxNum, in: int Row, in: int Col, in: int Width, in: int Height, in: string Title, in: string Text) |
| 0x55 | 85 | userboxclose | (in: int BoxNum) |
| 0x56 | 86 | userboxftextout | (in: int BoxNum, in: string Text, in: int Row, in: int Col, in: int ForeColor, in: int BackColor) |
| 0x57 | 87 | userboxclear | (in: int BoxNum) |
| 0x58 | 88 | userboxsetcolor | (in: int BoxNum, in: int ForeColor, in: int BackColor) |
| 0x59 | 89 | winhelp | (in: string helpfile) |
| 0x5A | 90 | winhelpkey | (in: string helpfile, in: string key) |
| 0x5B | 91 | callwin | (in: string cmdline) |
| 0x5C | 92 | viewopen | (in: string FileNameStr, in: string TitleStr) |
| 0x5D | 93 | viewclose | () |
| 0x60 | 96 | INPAapiInit | () |
| 0x61 | 97 | INPAapiEnd | () |
| 0x62 | 98 | INPAapiJob | (in: string ecu, in: string Job, in: string Arg1, in: string Arg2) |
| 0x63 | 99 | INPAapiResultText | (out: string ResultText, in: string ApiResult, in: int ApiSet, in: string Format) |
| 0x64 | 100 | INPAapiResultInt | (out: int ResultInt, in: string ApiResult, in: int ApiSet) |
| 0x65 | 101 | INPAapiResultSets | (out: int sets) |
| 0x67 | 103 | INPAapiResultAnalog | (out: real ResultValue, in: string ApiResult, in: int ApiSet) |
| 0x68 | 104 | INPAapiResultBinary | (in: string ApiResult, in: int ApiSet) |
| 0x69 | 105 | INPAapiCheckJobStatus | (in: string RefStr) |
| 0x6A | 106 | INPAapiFsLesen2 | (in: string ecu, in: string FileName) |
| 0x6B | 107 | INPAapiFsLesen | (in: string ecu, in: string FileName) |
| 0x6D | 109 | INP1apiInit | (out: bool rc) |
| 0x6E | 110 | INP1apiEnd | () |
| 0x6F | 111 | INP1apiJob | (in: string ecu, in: string Job, in: string Arg1, in: string Arg2) |
| 0x70 | 112 | INP1apiState | (out: int ApiState) |
| 0x71 | 113 | INP1apiResultText | (out: bool rc, out: string ResultText, in: string ApiResult, in: int ApiSet, in: string Format) |
| 0x72 | 114 | INP1apiResultInt | (out: bool rc, out: int ResultInt, in: string ApiResult, in: int ApiSet) |
| 0x74 | 116 | INP1apiResultReal | (out: bool rc, out: real ResultValue, in: string ApiResult, in: int ApiSet) |
| 0x76 | 118 | INP1apiErrorCode | (out: int ErrorCode) |
| 0x77 | 119 | INP1apiErrorText | (out: string ErrorText) |
| 0x78 | 120 | GetBinaryDataString | (out: string DataString, out: int DataStringLen) |
| 0x79 | 121 | fileopen | (in: string FileName, in: string OpenMode) |
| 0x7A | 122 | fileclose | () |
| 0x7B | 123 | filewrite | (in: string str) |
| 0x7C | 124 | fileread | (out: string str, out: bool EOF) |
| 0x8C | 140 | StrArrayCreate | (out: bool rc, out: int hStrArray) |
| 0x8D | 141 | StrArrayDestroy | (in: int hStrArray) |
| 0x8E | 142 | StrArrayWrite | (in: int hStrArray, in: int index, in: string str) |
| 0x91 | 145 | StrArrayDelete | (in: int hStrArray) |
| 0x9A | 154 | chr | (out: string ch, in: int code) |
| 0x9A | 154 | asc | (out: int code, in: string ch) |
| 0x9B | 155 | SetStructureMode | (in: int ReadWrite) |
| 0xA1 | 161 | setitemrepeat | (in: int ItemNum, in: bool Enabled) |

## Key Findings

### System Call Opcode Pattern
All system function calls use the opcode sequence:
```
0C 81 [ID] 00
```
Where `[ID]` is the function ID from the table above.

### ID Assignment
Function IDs are **hardcoded** in the INPA compiler/VM, not sequentially assigned based on `inpa.h` order. Examples:
- `setmenutitle` (3rd in header) → ID 0x00
- `settitle` (4th in header) → ID 0x03  
- `exit` (14th in header) → ID 0x0C

This confirms IDs are part of the VM's internal function table.

### EDIABAS Integration
Complete mapping of EDIABAS API functions:
- **INPA API:** 0x60-0x6B (Init, End, Job, Results, File System)
- **INP1 API:** 0x6D-0x77 (1:1 mode with error handling)
- **Binary Data:** 0x78 (GetBinaryDataString)

### Missing Functions
11 functions could not be mapped due to:
1. **Environment Dependencies**:
   - DTM functions (WinEldi-only)

2. **Complex Signatures / Variants**:
   - Conversion helpers like `hexconvert`, `inttoreal`, `realtoint`, `bytetoint`, `inttolong`, `longtoreal`
   - Remaining input/output variants (`inputnum`, `input2*`, `sim*` helpers)

## Methodology

### Compilation Approach
1. Parse `inpa.h` to extract all `extern` function declarations
2. Generate minimal `.ips` test script for each function:
   ```c
   #include "inpa.h"
   
   inpainit() {
       [declare out/inout variables]
       function_name(arguments);
   }
   
   inpaexit() {
   }
   ```
3. Compile from `C:\EC-APPS\INPA\SGDAT\` using:
   ```cmd
   cd C:\EC-APPS\INPA\SGDAT
   C:\EC-APPS\INPA\BIN\INPACOMP.exe test_func.ips -B test_func.log
   ```
4. Extract opcode `0C 81 XX 00` from resulting `.ipo` file
5. Map `XX` → function name

### Critical Requirements
- **Both `inpainit()` and `inpaexit()` required** - compiler fails without them
- **Working directory must be SGDAT** - compiler expects relative paths
- **ASCII encoding for `.ips` files** - UTF-8 may cause issues
- **Batch mode flag `-B`** - prevents interactive prompts

## Tools

### Extraction Script
`inpax/tools/extract-system-function-ids-v2.js` - Node.js script that automates the entire process:
- Parses `inpa.h`
- Generates test scripts
- Compiles with INPACOMP.exe  
- Extracts IDs from bytecode
- Outputs JSON, Markdown, and TypeScript definitions

### Generated Files
- `system-function-ids-complete.json` - Machine-readable complete mapping
- `system-function-ids-complete.md` - This document
- `system-function-ids.ts` - TypeScript enum and lookup table

## Usage in Decompiler

This mapping enables the decompiler to replace system call opcodes with function names:

**Bytecode:**
```
0C 81 48 00
```

**Decompiled:**
```c
text(0, 0, "");  // ID 0x48 → text()
```

## Future Work

### Completing the Map
To map remaining functions:
1. **Manual compilation** of complex cases (MENU/SCREEN contexts)
2. **Binary analysis** of existing `.ipo` files for missing IDs
3. **Reverse engineering** of INPACOMP.exe to extract complete ID table
4. **Runtime instrumentation** of INPA.exe to capture function calls

### Missing IDs from Binary Scan
From previous Phase 4 scan of E46_*.ipo files, these IDs were found but not yet named:
- 0x01, 0x02, 0x04, 0x05, 0x07, 0x0B, 0x10, 0x15, 0x16, 0x18-0x1A, 0x1E-0x2E
- 0x34-0x36, 0x39-0x3D, 0x3F-0x47, 0x4A-0x50, 0x54, 0x56, 0x58, 0x5E, 0x5F
- 0x62-0x64, 0x66, 0x67, 0x6C, 0x6F, 0x71-0x75, 0x7D-0x8B, 0x8F, 0x90
- 0x92-0x9A, 0x9C-0xFF

These likely correspond to the unmapped functions or internal/undocumented functions.

## References

- `C:\EC-APPS\INPA\BIN\inpa.h` - Official function declarations
- `inpax/docs/research/phase4-findings.md` - Initial discoveries
- E46_*.ipo files - Real-world bytecode examples
- `S:\inpax-tests\sysfunction-map-v3\` - Generated test data
