# BMW_STD.H Functions Analysis

Analysis of `C:\EC-APPS\INPA\SGDAT\BMW_STD.H` - BMW standard INPA library.

## Summary

BMW_STD.H contains two types of functions:
1. **Script functions** - implemented in INPA script language (no system call ID)
2. **DLL imports** - direct Windows API calls via `import32`

## Script Functions (Implemented in INPA)

These are NOT extern library calls - they're implemented directly in BMW_STD.H as INPA script code.

| Function | Signature | Notes |
|----------|-----------|-------|
| `chrinit` | `chrinit()` | Initializes global CR/LF/HT/CRLF variables |
| `chr` | `chr(in: byte b, inout: string s)` | Converts byte to string |
| `asc` | `asc(in: string s, inout: byte b)` | Converts first char of string to byte |
| `filedelete` | `filedelete(in: string FileName, inout: int ErrorCode)` | Deletes file (uses OpenFile with 0x0200) |
| `fileexist` | `fileexist(in: string FileName, inout: int ErrorCode)` | Checks if file exists (uses OpenFile with 0x4000) |
| `bytetohexstring` | `bytetohexstring(in: byte zahl, in: int laenge, out: string text)` | Byte to hex string |
| `inttohexstring` | `inttohexstring(in: int zahl, in: int laenge, out: string text)` | Int to hex string |
| `longtohexstring` | `longtohexstring(in: long zahl, in: int laenge, out: string text)` | Long to hex string (uses wvsprintf) |
| `ausgabe_formatiert` | `ausgabe_formatiert(in: string text, in: int row, in: int col, in: int textsize, in: int textattr, in: int digit, in: int step)` | Formatted text output |
| `instr` | `instr(out: int pos, in: int ab, in: string Text, in: string Suchtext)` | Find substring position |
| `trimstr` | `trimstr(inout: string Text)` | Trim whitespace |
| `space` | `space(inout: string Text, in: int nr)` | Fill string with spaces |
| `ExtraScript` | `ExtraScript(in: string Script, out: bool Flag)` | Check INPA.INI for extra scripts |

## DLL Imports (import32)

These are direct Windows DLL calls - no INPA system function ID, executed via import32 mechanism.

### kernel32.dll

| INPA Name | DLL Function | Signature |
|-----------|--------------|-----------|
| `GetPrivateProfileString` | `GetPrivateProfileStringA` | `(in: string Section, in: string Entry, in: string Default, out: string ReturnedString, in: int Size, in: string FileName) returns: int` |
| `GetPrivateProfileInt` | `GetPrivateProfileIntA` | `(in: string Section, in: string Entry, in: int Default, in: string FileName) returns: int` |
| `WritePrivateProfileString` | `WritePrivateProfileStringA` | `(in: string Section, in: string Entry, in: string String, in: string FileName) returns: bool` |
| `OpenFile` | `OpenFile` | `(in: string FileName, inout: structure ReOpenBuff, in: int Style) returns: int` |
| `GetWindowsDirectory` | `GetWindowsDirectoryA` | `(inout: string lpString, in: int nSize) returns: int` |
| `GetCurrentDirectory` | `GetCurrentDirectoryA` | `(in: long nSize, inout: string lpString) returns: int` |
| `SetCurrentDirectory` | `SetCurrentDirectoryA` | `(in: string lpString) returns: int` |

### user32.dll

| INPA Name | DLL Function | Signature |
|-----------|--------------|-----------|
| `wvsprintf` | `wvsprintfA` | `(inout: string ReturnedString, in: string Format, inout: structure ArgList) returns: int` |
| `AnsiUpper` | `CharUpperA` | `(in: string lpString) returns: string` |
| `AnsiLower` | `CharLowerA` | `(in: string lpString) returns: string` |

### XTRACT32.DLL (EDIABAS)

| INPA Name | DLL Function | Signature |
|-----------|--------------|-----------|
| `XTRACT` | `XTRACT` | `(in: string FileName, in: int Mode, inout: string Buffer, in: long Size) returns: int` |

### INPA_LIB32.DLL (BMW INPA Library)

| INPA Name | DLL Function | Signature |
|-----------|--------------|-----------|
| `SaveAsDialogBox` | `SaveAsDialogBox` | `(in: string Title, inout: string lpString, in: int Size) returns: int` |

## Global Variables

```c
long   GlobalBuffer=0;   // for structure access
string CR="?";           // carriage return (initialized by chrinit)
string LF="?";           // line feed
string CRLF="?";         // CR + LF
string HT="?";           // horizontal tab
```

## Implementation Notes

1. **Script functions** use INPA built-in functions like:
   - `CreateStructure`, `SetStructureMode`, `StructureByte`, `StructureString`, `StructureLong`, `StructureInt`
   - `strlen`, `midstr`, `ftextout`, `messagebox`
   - `bytetoint`, `inttolong`, `inttostring`

2. **DLL imports** use `import32 "C" lib "DLL::Function" INPAName (params) returns: type` syntax

3. **No system function IDs** for BMW_STD.H - these are either:
   - Pure script implementations (call other INPA system functions)
   - Direct DLL imports (bypass INPA runtime, call Windows API directly)

## InpaX Implementation Strategy

For InpaX interpreter:
- **Script functions**: Can be reimplemented in TypeScript or loaded as standard library
- **DLL imports**: Need FFI wrapper (koffi) to call Windows DLLs, or stub implementations for cross-platform
