# Long Data Type Research

> **Issue:** #64  
> **Status:** ✅ Complete  
> **Date:** 2026-02-10

## Summary

The `long` data type (32-bit signed integer) uses **type marker `0x04`**, not `0x02` as initially speculated.

**Critical correction:** The previous documentation incorrectly stated that `0x04` was the Byte type marker. The correct mapping is:

| Type | Marker | Size | Description |
|------|--------|------|-------------|
| Bool | `0x01` | 1 byte | TRUE=1, FALSE=0 |
| **Byte** | `0x02` | 1 byte | 8-bit unsigned (0-255) |
| Int | `0x03` | 2 bytes | 16-bit signed |
| **Long** | `0x04` | 4 bytes | 32-bit signed |
| Real | `0x05` | 8 bytes | IEEE-754 double |
| String | `0x06` | variable | Newline-terminated |

## Methodology

### Test File: ALLTYPES.ips

```c
bool my_bool;
byte my_byte;
int my_int;
long my_long;
real my_real;
string my_string;

inpainit()
{
    my_bool = TRUE;
    my_byte = 255;
    my_int = 1000;
    my_long = 200000;
    my_real = 3.14;
    my_string = "test";
}

inpaexit()
{
}
```

### Compiled Binary Analysis (ALLTYPES.ipo)

**Global Data Section (offset 0xE0):**
```
00 07 00 00 01 02 03 04 05 06
         ^^ ^^ ^^ ^^ ^^ ^^
         |  |  |  |  |  +-- string (0x06)
         |  |  |  |  +----- real (0x05)
         |  |  |  +-------- long (0x04)  ← CONFIRMED
         |  |  +----------- int (0x03)
         |  +-------------- byte (0x02)  ← CORRECTED
         +----------------- bool (0x01)
```

**Constant Data Section (offset 0x100):**
```
01 01           ; bool TRUE (type 0x01, value 0x01)
02 ff           ; byte 255 (type 0x02, value 0xFF)
03 e8 03        ; int 1000 (type 0x03, value 0x03E8 LE)
04 40 0d 03 00  ; long 200000 (type 0x04, value 0x00030D40 LE)
05 1f 85...     ; real 3.14 (type 0x05, IEEE-754 double LE)
06 74 65...     ; string "test\n" (type 0x06)
```

### Additional Test Files

| File | Variables | Global Data Types | Confirms |
|------|-----------|-------------------|----------|
| LONG01.ipo | long big_number | `04` | Long = 0x04 |
| LONG02.ipo | long a, b, result | `04 04 04` | Multiple longs |
| LONG03.ipo | int, long, real | `03 04 05` | Type sequence |
| LONG04.ipo | long x | `04` | Single long |
| LONG05.ipo | long x, y | `03 04` | Mixed types |
| LONG06.ipo | long x, y | `02 04` | Byte + long |

### Long Constant Format

Long constants are stored as 4-byte little-endian signed integers:

```
04 [byte0] [byte1] [byte2] [byte3]
```

Examples:
- `200000` (0x00030D40) → `04 40 0D 03 00`
- `100000` (0x000186A0) → `04 A0 86 01 00` (seen in LONG01.ipo)
- `50000` (0x0000C350) → `04 50 C3 00 00` (seen in LONG02.ipo)

## Impact

### Documentation Fix Required

The `docs/IPO_Structure.md` Type Markers section was **incorrect**:

❌ **Wrong (old):**
| Type | Byte | Description |
|------|------|-------------|
| Byte | `0x04` | 8-bit unsigned |

✅ **Correct (new):**
| Type | Byte | Description |
|------|------|-------------|
| Byte | `0x02` | 8-bit unsigned |
| Long | `0x04` | 32-bit signed |

### Parser Impact

The type-parser.ts needs to handle:
1. Type marker `0x02` → Byte
2. Type marker `0x04` → Long (new)

The constant-parser.ts needs to handle:
1. Long constants: `04 [4-byte LE value]`

## References

- Compiled with INPACOMP.exe v5.00+ batch mode
- Source: `C:\EC-APPS\INPA\SGDAT\ALLTYPES.ips`
- Binary: `ALLTYPES.ipo` (285 bytes)
