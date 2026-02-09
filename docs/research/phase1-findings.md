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

All valid `.ipo` files begin with the following signature:
```hex
05 00 54 45 53 54 2d 49 6e 66 6f 74 65 78 74 0a  |..TEST-Infotext.|
```
- `05 00`: Likely length of the following string (5).
- `TEST-Infotext`: Signature string.
- `0a`: Section terminator (Newline).

## 3. Variable Types (Global Data)

The **Global Data** section lists the *types* of all global variables. Variable names are not preserved in this section (likely referenced by index in bytecode).

**Section Marker:** `Global Data` followed by `0a`.

**Structure:**
The section ends with a sequence of bytes defining the variables.
Pattern: `00 [Count] 00 00 [Type1] [Type2] ...`

*Note: The count seems to include an implicit 0-th element or the global scope itself.*

### Identified Type Bytes:

| Type | Byte Code | Example Hex Dump (Global Data Tail) |
| :--- | :--- | :--- |
| **Bool** | `01` | `00 02 00 00 01` (Count 2: Implied + Bool) |
| **Int** | `03` | `00 02 00 00 03` (Count 2: Implied + Int) |
| **Real** | `05` | `00 02 00 00 05` (Count 2: Implied + Real) |
| **String** | `06` | `00 02 00 00 06` (Count 2: Implied + String) |

**Example (Two Integers):**
`00 03 00 00 03 03` (Count 3: Implied, Int, Int)

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
