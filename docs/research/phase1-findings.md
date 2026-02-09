# IPO File Structure & Variables - Phase 1 Findings

**Date:** 2026-02-09
**Status:** Phase 1 Complete

## 1. General File Structure

The `.ipo` binary format (compiled INPA script) appears to be section-based, containing header information, function bytecode, global variable definitions, and constant data.

### Sections Observed:
1.  **Header:** File signature and metadata.
2.  **Code Sections:** Named functions (e.g., `inpainit`, `inpaexit`) with bytecode.
3.  **Global Data:** Definitions of global variable types.
4.  **Constant Data:** Storage for string literals and numerical constants used in the script.

## 2. Header Analysis

Valid `.ipo` files begin with a signature followed by "TEST-Infotext\n". Multiple header variants exist:

### Header Variants

| Variant | Hex Signature | First 2 Bytes | Notes |
|---------|---------------|---------------|-------|
| **A** | `05 00 54 45 53 54 2d 49 6e 66 6f 74 65 78 74 0a` | `05 00` | Common in newer files (e.g., msd80n43.ipo, zgw_01.ipo) |
| **B** | `01 02 54 45 53 54 2d 49 6e 66 6f 74 65 78 74 0a` | `01 02` | Older format (various ECU scripts) |
| **C** | `01 03 54 45 53 54 2d 49 6e 66 6f 74 65 78 74 0a` | `01 03` | Alternative format |

- First 2 bytes likely encode **compiler version** or **file format version**.
- All variants share `"TEST-Infotext\n"` magic string at offset +2.
- `0a`: Newline terminator.

## 3. Variable Types (Global Data)

The **Global Data** section lists the *types* of all global variables. Variable names are not preserved in this section (likely referenced by index in bytecode).

**Section Marker:** `Global Data` followed by `0a`.

**Structure:**
```
"Global Data\n"
00 00 00 00 0a 0a 00    <- Preamble (7 bytes)
[u16 LE: count]         <- Variable count (little-endian)
01 00                   <- Unknown field (always 01 00?)
04                      <- Separator
[type bytes...]         <- One type byte per variable (count matches)
```

**Example (from msd80n43.ipo, 376 variables):**
```hex
47 6c 6f 62 61 6c 20 44 61 74 61 0a  "Global Data\n"
00 00 00 00 0a 0a 00                 Preamble
78 01                                Count = 0x0178 (376 in decimal)
01 00 04                             Header + separator
06 06 06 06 06 06 06 05 03 01 ...   Type list (376 bytes follow)
```

### Identified Type Bytes:

| Type | Byte Code | Notes |
| :--- | :--- | :--- |
| **Bool** | `01` | Boolean (TRUE/FALSE) |
| **Int** | `03` | 16-bit signed integer |
| **Byte** | `04` | 8-bit unsigned integer (found in production files) |
| **Real** | `05` | IEEE-754 double (64-bit float) |
| **String** | `06` | Null-terminated string |

**Production example (msd80n43.ipo type distribution in first 100 variables):**
- String (0x06): 56 occurrences
- Bool (0x01): 24 occurrences
- Int (0x03): 12 occurrences
- Real (0x05): 5 occurrences
- Byte (0x04): 3 occurrences

## 4. Constant Data

The **Constant Data** section stores values. Strings and numbers are stored differently.

**Section Marker:** `Constant Data` followed by `0a`.

### String Constants
- **Format:** `06 [Characters] 0a`
- **Example:** "Hello" -> `06 48 65 6c 6c 6f 0a`
- The byte `06` matches the String type code.
- `0a` (newline) appears to serve as a delimiter.

### Integer Constants
- **Format:** `03 [Value] 00` ? (Needs verification on larger numbers)
- **Example:** 42 (0x2A) -> `03 2a 00`
- **Example:** 255 (0xFF) -> `03 ff 00`
- The byte `03` matches the Int type code.
- Values appear to be little-endian (though single byte examples are ambiguous).

### Real (Double) Constants
- **Format:** `05 [8-byte IEEE-754 Double]`
- **Example:** 3.14 -> `05 1f 85 eb 51 b8 1e 09 40`
- The byte `05` matches the Real type code.
- `1f 85 eb 51 b8 1e 09 40` is the little-endian representation of `3.14`.

### Bool Constants
- **Format:** `01 [Value]`
- **Example:** TRUE -> `01 01`
- The byte `01` matches the Bool type code.

## 5. Bytecode Observations (Preliminary)

- Variables and Constants appear to be referenced by index.
- Assignment logic seems to involve pushing target variable index and source constant index.
- Function bodies are delimited by `0a`.

## 6. Next Steps (Phase 2)
- Analyze bytecode instructions (OpCodes) for assignment, arithmetic, and function calls.
- Determine how variable names are mapped (if at all, or if `Symbol Table` exists elsewhere).
- Investigate control flow (if/else) binary structure.

---

## Validation Status

✅ **Validated against production IPO files** (2026-02-09)
- Tested with 20+ real-world files from BMW diagnostic suite
- See [VALIDATION-REPORT.md](VALIDATION-REPORT.md) for detailed analysis
- Corrections applied: Header variants, type 0x04, Global Data count format
