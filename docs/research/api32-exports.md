# api32.dll Export Analysis

**Date:** 2026-02-09  
**Location:** `C:\EDIABAS\BIN\api32.dll`  
**Architecture:** 32-bit x86 (i386)  
**Type:** Windows DLL  

## Summary

The EDIABAS `api32.dll` exports **74 functions** implementing the EDIABAS API. Analysis reveals:

- **Dual naming convention**: Functions exported with both stdcall (`___apiFunctionName@N`) and cdecl (`_apiFunctionName`) decorations
- **Calling convention**: Primarily stdcall (indicated by `@N` suffix where N = bytes of parameters)
- **Core API**: Standard EDIABAS API functions matching documented interface
- **Server functions**: Additional server/threading support functions

## Complete Export List

### Core EDIABAS API Functions (stdcall decorated)

| Function | Decoration | Params (bytes) | Description |
|----------|-----------|----------------|-------------|
| `___apiBreak@4` | stdcall | 4 | Break/interrupt API operation |
| `___apiCheckVersion@8` | stdcall | 8 | Version compatibility check |
| `___apiEnd@4` | stdcall | 4 | End API session |
| `___apiErrorCode@4` | stdcall | 4 | Get last error code |
| `___apiErrorText@12` | stdcall | 12 | Get error description text |
| `___apiGetConfig@12` | stdcall | 12 | Retrieve configuration value |
| `___apiInit@4` | stdcall | 4 | Initialize API |
| `___apiInitExt@20` | stdcall | 20 | Extended initialization |
| `___apiJob@20` | stdcall | 20 | Execute diagnostic job |
| `___apiJobData@24` | stdcall | 24 | Execute job with data |
| `___apiJobExt@36` | stdcall | 36 | Extended job execution |
| `___apiJobInfo@8` | stdcall | 8 | Get job information |
| `___apiResultBinary@20` | stdcall | 20 | Binary result retrieval |
| `___apiResultBinaryExt@24` | stdcall | 24 | Extended binary result |
| `___apiResultByte@16` | stdcall | 16 | Byte result |
| `___apiResultChar@16` | stdcall | 16 | Character result |
| `___apiResultDWord@16` | stdcall | 16 | DWORD (32-bit) result |
| `___apiResultFormat@16` | stdcall | 16 | Get result format info |
| `___apiResultInt@16` | stdcall | 16 | Integer result |
| `___apiResultLong@16` | stdcall | 16 | Long integer result |
| `___apiResultName@16` | stdcall | 16 | Get result name |
| `___apiResultNumber@12` | stdcall | 12 | Numeric result (generic) |
| `___apiResultReal@16` | stdcall | 16 | Floating-point result |
| `___apiResultSets@8` | stdcall | 8 | Get number of result sets |
| `___apiResultText@20` | stdcall | 20 | Text/string result |
| `___apiResultVar@8` | stdcall | 8 | Variant result |
| `___apiResultWord@16` | stdcall | 16 | WORD (16-bit) result |
| `___apiResultsDelete@8` | stdcall | 8 | Delete result set |
| `___apiResultsNew@4` | stdcall | 4 | Create new result set |
| `___apiResultsScope@8` | stdcall | 8 | Set result scope |
| `___apiSetConfig@12` | stdcall | 12 | Set configuration value |
| `___apiState@4` | stdcall | 4 | Get API state |
| `___apiStateExt@8` | stdcall | 8 | Extended state query |
| `___apiSwitchDevice@12` | stdcall | 12 | Switch communication device |
| `___apiTrace@8` | stdcall | 8 | Enable/configure tracing |
| `___apiXSysSetConfig@8` | stdcall | 8 | Extended system config |

### Core EDIABAS API Functions (cdecl decorated)

Same functions with cdecl calling convention (no parameter cleanup by callee):

```
__apiBreak
__apiCheckVersion
__apiEnd
__apiErrorCode
__apiErrorText
__apiGetConfig
__apiInit
__apiInitExt
__apiJob
__apiJobData
__apiJobExt
__apiJobInfo
__apiResultBinary
__apiResultBinaryExt
__apiResultByte
__apiResultChar
__apiResultDWord
__apiResultFormat
__apiResultInt
__apiResultLong
__apiResultName
__apiResultNumber
__apiResultReal
__apiResultSets
__apiResultText
__apiResultVar
__apiResultWord
__apiResultsDelete
__apiResultsNew
__apiResultsScope
__apiSetConfig
__apiState
__apiStateExt
__apiSwitchDevice
__apiTrace
```

### Server/Threading Functions

| Function | Decoration | Params | Description |
|----------|-----------|--------|-------------|
| `_closeServer@0` | stdcall | 0 | Close EDIABAS server |
| `_enableMultiThreading@4` | stdcall | 4 | Enable multi-threaded operation |
| `_enableServer@4` | stdcall | 4 | Start EDIABAS server mode |

## Comparison with INPA Script Functions

Based on analysis of IPO bytecode (see `system-function-ids.md`), INPA scripts call these functions via system function IDs:

| IPO Function ID | IPO Function Name | api32.dll Export | Status |
|-----------------|-------------------|------------------|--------|
| 0x60 (96) | `INPAapiInit` | `__apiInit` | ✓ Match |
| 0x61 (97) | `INPAapiEnd` | `__apiEnd` | ✓ Match |
| 0x62 (98) | `INPAapiJob` | `__apiJob` | ✓ Match |
| 0x63 (99) | `INPAapiResultText` | `__apiResultText` | ✓ Match |
| 0x64 (100) | `INPAapiResultDigital` | `__apiResultInt` / `__apiResultByte` | ⚠️ Likely |
| 0x65 (101) | `INPAapiResultInt` | `__apiResultInt` | ✓ Match |
| 0x68 (104) | `INPAapiResultBinary` | `__apiResultBinary` | ✓ Match |
| 0x69 (105) | `INPAapiCheckJobStatus` | `__apiState` / `__apiJobInfo` | ⚠️ Likely |
| 0x6A (106) | `INPAapiFsLesen2` | N/A | ❌ Not in api32.dll |
| 0x6B (107) | `INPAapiFsLesen` | N/A | ❌ Not in api32.dll |

**Key findings:**

1. **Direct mapping**: Most INPA API functions map directly to api32.dll exports
2. **Missing functions**: `INPAapiFsLesen` and `INPAapiFsLesen2` are **not** in api32.dll - these are likely implemented in INPA runtime (file system operations)
3. **Wrapper layer**: INPA's `INPAapi*` functions are thin wrappers calling api32.dll functions

## Calling Convention Analysis

### Stdcall vs Cdecl Exports

The DLL exports each function twice:

- **`___apiFunctionName@N`** → stdcall (Windows API convention, callee cleans stack)
- **`_apiFunctionName`** → cdecl (C convention, caller cleans stack)

This dual export allows compatibility with:
- Visual Basic / VBA → uses stdcall
- Standard C/C++ → can use either
- .NET P/Invoke → typically expects stdcall on Windows

### Parameter Size Inference

Examples:
- `___apiInit@4` → 1 pointer parameter (4 bytes on x86)
- `___apiJob@20` → 5 parameters (e.g., 5 pointers or mix of int/pointer)
- `___apiResultText@20` → 5 parameters

This matches expected signatures like:
```c
int __stdcall __apiJob(
    const char* ecu,      // 4 bytes
    const char* job,      // 4 bytes
    const char* params,   // 4 bytes
    const char* result,   // 4 bytes
    void* reserved        // 4 bytes
);  // Total: 20 bytes
```

## Integration Notes for InpaX

### TypeScript FFI Bindings

For `node-ffi-napi` or `koffi`:

```typescript
const api32 = Library('api32.dll', {
  // Use stdcall versions for Windows compatibility
  '__apiInit@4': ['int32', ['pointer']],
  '__apiEnd@4': ['int32', ['pointer']],
  '__apiJob@20': ['int32', ['string', 'string', 'string', 'string', 'pointer']],
  '__apiResultText@20': ['int32', ['pointer', 'string', 'uint16', 'pointer', 'int32']],
  // ... etc
});
```

### Reverse Engineering Next Steps

1. **Function signatures**: Use IDA Pro / Ghidra to extract exact parameter types
2. **String analysis**: Look for format strings, error messages to understand behavior
3. **Cross-reference**: Compare with EDIABAS SDK documentation (if available)
4. **Dynamic analysis**: Use API Monitor or Frida to trace calls from INPA.exe

## Files Referenced

- `docs/research/system-function-ids.md` - IPO bytecode function mapping
- `docs/research/system-function-ids-complete.md` - Complete function catalog
- `docs/research/phase4-findings.md` - test_api.hex analysis results

## Tools Used

- **PE Parser**: PowerShell script for parsing PE32 export table
- **RVA to File Offset mapping**: Manual section table traversal
- **Export name extraction**: Direct byte reading from DLL file

## Conclusion

The api32.dll provides a comprehensive C API for EDIABAS diagnostic operations. INPA scripts bridge to this API through a thin wrapper layer implemented in the INPA bytecode VM. The next phase of InpaX development should focus on:

1. Creating TypeScript FFI bindings for core functions
2. Reverse engineering exact function signatures
3. Implementing the missing `INPAapiFsLesen*` functions in the InpaX runtime
4. Testing against real EDIABAS installation

---

**Analysis performed by:** OpenClaw Agent (Marek)  
**Issue:** #28  
**Repository:** emdzej/inpax
