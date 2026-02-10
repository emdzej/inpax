# LOGTABLE Bytecode Analysis

> **Issue:** #59  
> **Date:** 2026-02-10  
> **Status:** ✅ COMPLETE

## Summary

**LOGTABLE compiles to a lookup table in a dedicated section, NOT expanded to if-else chains.**

The compiler generates:
1. A **wrapper function** (`lt_name`) that sets up parameters
2. A **data section** (`LT_lt_name`) containing the lookup table

## Section Types

| Type | Purpose | Marker Pattern |
|------|---------|----------------|
| `0x04` | LOGTABLE data section (`LT_` prefix) | Space before name: `04 20 4c 54 5f...` |
| `0x05` | LOGTABLE wrapper function | `05 6c 74 5f...` |

**Note:** Section type `0x04` was previously undocumented. It stores the actual lookup table data.

## Lookup Table Structure

After the section header and preamble (`00 00 00 00 0a 0a 00`), the data format is:

```
[u32 LE: entry_count]
[entry × entry_count]
```

Each entry is **12 bytes**:

```
struct LogtableEntry {
    u32 input_value;    // Input bit pattern to match
    u32 input_mask;     // Bitmask (0xFFFFFFFF = exact match)
    u32 output_value;   // Output bit pattern
}
```

### Bitmask Encoding

| Mask Value | Meaning |
|------------|---------|
| `0xFFFFFFFF` | Exact match required (no wildcards) |
| Other values | Bitmask for don't care (X) positions |
| `0x00000000` | Match anything (OTHER case) |

The runtime evaluates: `(input & mask) == (input_value & mask)`

## Test Cases Analysis

### Test 1: LOGT01 — Minimal (2 inputs, 1 output)

**Source:**
```c
LOGTABLE lt_simple(out: bool o1, in: bool i1 i2)
{
    0y0: 0y00;    // output=0 when i1=0, i2=0
    0y1: OTHER;   // output=1 for all other inputs
}
```

**Table data (2 entries):**
```hex
02 00 00 00                    ; entry_count = 2
00 00 00 00  ff ff ff ff  00 00 00 00   ; Entry 0: in=0b00, mask=all, out=0
00 00 00 00  00 00 00 00  01 00 00 00   ; Entry 1: in=any, mask=0, out=1 (OTHER)
```

### Test 2: LOGT02 — Don't Care (X)

**Source:**
```c
LOGTABLE lt_dontcare(out: bool o1, in: bool i1 i2 i3)
{
    0y0: 0y00X;   // output=0 when i1=0, i2=0, i3=any
    0y1: 0yX1X;   // output=1 when i2=1 (i1,i3=any)
    0y0: OTHER;   // output=0 for all other inputs
}
```

**Table data (3 entries):**
```hex
03 00 00 00                    ; entry_count = 3
00 00 00 00  06 00 00 00  00 00 00 00   ; Entry 0: in=0, mask=0b110, out=0
02 00 00 00  02 00 00 00  01 00 00 00   ; Entry 1: in=0b010, mask=0b010, out=1
00 00 00 00  00 00 00 00  00 00 00 00   ; Entry 2: OTHER (mask=0, out=0)
```

**Mask interpretation:**
- `0y00X` → mask = `0b110` (0x06) — check bits 1 and 2, ignore bit 0
- `0yX1X` → mask = `0b010` (0x02) — only check bit 1

### Test 3: LOGT03 — Multiple Outputs

**Source:**
```c
LOGTABLE lt_multi(out: bool o1 o2, in: bool i1 i2)
{
    0y00: 0y00;   // outputs=00 when inputs=00
    0y01: 0y01;   // outputs=01 when inputs=01
    0y10: 0y10;   // outputs=10 when inputs=10
    0y11: 0y11;   // outputs=11 when inputs=11
}
```

**Table data (4 entries):**
```hex
04 00 00 00                    ; entry_count = 4
00 00 00 00  ff ff ff ff  00 00 00 00   ; Entry 0: in=0, mask=all, out=0
01 00 00 00  ff ff ff ff  01 00 00 00   ; Entry 1: in=1, mask=all, out=1
02 00 00 00  ff ff ff ff  02 00 00 00   ; Entry 2: in=2, mask=all, out=2
03 00 00 00  ff ff ff ff  03 00 00 00   ; Entry 3: in=3, mask=all, out=3
```

**Note:** Multiple outputs are packed into a single integer (bit pattern).

## Wrapper Function Analysis

The wrapper function (`lt_name`) contains bytecode that:
1. Reads input parameters
2. Pushes them onto the stack
3. Calls the lookup mechanism (likely internal VM instruction)
4. Stores result to output variable(s)

The wrapper appears to contain opcode sequences including:
- `0x11 51` patterns — possibly related to parameter handling
- `0x10 44` — possibly lookup/table access instruction
- Standard `JMP` and `STORE` opcodes

## Runtime Evaluation

The VM evaluates LOGTABLE at runtime as:

```
for entry in table:
    if (input_bits & entry.mask) == (entry.input_value & entry.mask):
        return entry.output_value
```

The **OTHER** case is represented with `mask = 0x00000000`, which matches any input.

## Implications for Interpreter

1. **New section type 0x04** must be parsed as LOGTABLE data
2. **Lookup table format** is fixed 12-byte entries
3. **Mask-based matching** — implement bitwise AND comparison
4. **Multiple outputs** — unpack bit pattern to individual booleans
5. **Evaluation order** — first match wins; OTHER should be last

## Open Questions

1. What are the unknown opcodes (`0x11 51`, `0x10 44`) in the wrapper function?
2. Is there a dedicated VM instruction for table lookup, or is it implemented in bytecode?
3. How are input/output parameters mapped to bit positions?

## Files

Test IPO files saved to:
- `~/Documents/LOGT01.ipo` — minimal LOGTABLE
- `~/Documents/LOGT02.ipo` — with don't care (X)
- `~/Documents/LOGT03.ipo` — multiple outputs
