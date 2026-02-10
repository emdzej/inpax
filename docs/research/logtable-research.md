# LOGTABLE Bytecode Research

> **Issue:** #59  
> **Status:** ✅ COMPLETE  
> **Date:** 2026-02-10

## Overview

LOGTABLE is a boolean logic mapping construct in INPA. Research completed — see `logtable-bytecode-analysis.md` for full findings.

## Key Findings

**LOGTABLE compiles to a lookup table, NOT expanded to if-else chains.**

1. **Section type 0x04** — LOGTABLE data section (prefixed with `LT_` and space)
2. **Section type 0x05** — LOGTABLE wrapper function
3. **Entry format** — 12 bytes: `[u32 input_value] [u32 input_mask] [u32 output_value]`
4. **Mask-based matching** — `(input & mask) == (input_value & mask)`
5. **OTHER case** — mask = 0x00000000 (matches any input)
6. **Don't care (X)** — partial mask covering only relevant bit positions

## Test Files

Compiled on Windows Node, analyzed on Mac:
- `~/Documents/LOGT01.ipo` — minimal (1 output, 2 inputs)
- `~/Documents/LOGT02.ipo` — with X wildcards (1 output, 3 inputs)
- `~/Documents/LOGT03.ipo` — multiple outputs (2 outputs, 2 inputs)

## Documentation Updated

- `docs/IPO_Structure.md` — Added Section 13: LOGTABLE
- `docs/research/logtable-bytecode-analysis.md` — Full analysis

## Language Syntax

From `docs/reference/language-guide.md`:

```c
LOGTABLE table_name(out: bool out1 out2, in: bool in1 in2 in3)
{
    // Output : Input
    0y00: 0y000;  // Exact match
    0y01: 0y10X;  // X = don't care
    0y10: 0y010;
    0y11: OTHER;  // All other cases
}

// Usage:
bool o1, o2;
table_name(o1, o2, TRUE, FALSE, TRUE);
```

### Key Features

1. **Binary notation** `0yXXX` — bit patterns for boolean sets
2. **Don't care** `X` — wildcard that matches both TRUE and FALSE
3. **OTHER** — catch-all default case
4. **Output-first mapping** — `outputs: inputs`

## Compilation Hypothesis

### Hypothesis A: Expanded to If-Else Chain

The compiler could expand LOGTABLE to a series of conditional branches:

```c
// LOGTABLE lt_simple(out: bool o1, in: bool i1 i2)
// { 0y0: 0y00; 0y1: OTHER; }

// Might compile to:
if (i1 == FALSE && i2 == FALSE) {
    o1 = FALSE;
} else {
    o1 = TRUE;  // OTHER case
}
```

**Bytecode pattern (if true):**
- Multiple `JMP_FALSE` and `JMP` opcodes
- No special opcode for LOGTABLE itself
- Table lookup logic inlined

### Hypothesis B: Dedicated LOGTABLE Opcode

A dedicated opcode could reference a lookup table stored in Constant Data:

```hex
0x?? [table_ref]  ; LOGTABLE_LOOKUP
```

**Bytecode pattern (if true):**
- New opcode (0x23 or 0x26+ range)
- Table data stored in Constant Data section
- More compact representation

### Hypothesis C: Section-Based (Like SCREEN/MENU)

LOGTABLE might have its own section type marker:

```hex
04 6c 74 5f 6e 61 6d 65 0a  ; Section type 0x04 + "lt_name\n"
[table data...]
```

**Evidence against:** Section type 0x04 not documented in IPO_Structure.md

## Test Plan

### Test Files (for Windows Node)

#### Test 1: Minimal LOGTABLE (2 inputs, 1 output)
```c
#include "inpa.h"

LOGTABLE lt_simple(out: bool o1, in: bool i1 i2)
{
    0y0: 0y00;
    0y1: OTHER;
}

inpainit()
{
    bool result;
    lt_simple(result, TRUE, FALSE);
}

inpaexit()
{
}
```

#### Test 2: LOGTABLE with Don't Care (X)
```c
#include "inpa.h"

LOGTABLE lt_dontcare(out: bool o1, in: bool i1 i2 i3)
{
    0y0: 0y00X;
    0y1: 0yX1X;
    0y0: OTHER;
}

inpainit()
{
    bool result;
    lt_dontcare(result, TRUE, FALSE, TRUE);
}

inpaexit()
{
}
```

#### Test 3: Multiple Outputs
```c
#include "inpa.h"

LOGTABLE lt_multi(out: bool o1 o2, in: bool i1 i2)
{
    0y00: 0y00;
    0y01: 0y01;
    0y10: 0y10;
    0y11: 0y11;
}

inpainit()
{
    bool r1, r2;
    lt_multi(r1, r2, TRUE, FALSE);
}

inpaexit()
{
}
```

#### Test 4: Multiple LOGTABLE Calls
```c
#include "inpa.h"

LOGTABLE lt_test(out: bool o1, in: bool i1 i2)
{
    0y0: 0y00;
    0y1: OTHER;
}

inpainit()
{
    bool r1, r2, r3;
    lt_test(r1, TRUE, FALSE);
    lt_test(r2, FALSE, TRUE);
    lt_test(r3, TRUE, TRUE);
}

inpaexit()
{
}
```

### Analysis Steps

1. **Compile each test** on Windows Node
2. **Copy .ipo files** to Mac via shared folder
3. **Disassemble** with `inpax disasm`
4. **Compare patterns** between tests
5. **Look for:**
   - New opcodes (check 0x23, 0x26-0x30 range)
   - New section type markers
   - Binary patterns that match input/output specs
   - How `X` and `OTHER` are encoded

## Investigation of Existing IPO Files

### Search Results

Searched all .ipo files in `~/Documents/ipo/` and `~/Documents/CFGDAT/`:

1. **No "LOGTABLE" strings found** — Expected if compiled away
2. **No "lt_" prefixed sections found** — Suggests LOGTABLE doesn't create named sections
3. **No section type 0x04 found** — Current section types are:
   - 0x01 = SCREEN
   - 0x02 = MENU  
   - 0x03 = STATEMACHINE

### Implications

LOGTABLE likely:
- Gets inlined at call site (like a macro), OR
- Uses existing opcodes without special markers, OR
- Is rarely used in production BMW scripts

### Production IPO Analysis

Analyzed `msd80n43.ipo` (307 sections, 376 globals):
- Sections: 123 functions, 117 screens, 65 menus, 0 state machines
- No LOGTABLE-related patterns detected
- No unknown section types found

## Current Blockers

- **Windows Node offline** — Cannot compile test files
- **No existing LOGTABLE examples** — Searched all .ipo files, none contain LOGTABLE usage

## Next Steps

1. Wait for Windows Node to come online
2. Create test files in `C:\EC-APPS\INPA\SGDAT\`
3. Compile with timeout handling (INPACOMP hangs after compile)
4. Copy .ipo files to `S:\` → Mac shared folder
5. Analyze bytecode with `inpax disasm`
6. Update this document with findings
7. Update `IPO_Structure.md`

## Alternative Approaches (if Windows Node unavailable)

1. Search BMW diagnostic forums for LOGTABLE examples
2. Look for .ips source files that might contain LOGTABLE usage
3. Analyze INPA compiler executable to understand LOGTABLE handling

---

*Research started 2026-02-10. Awaiting Windows Node availability.*
