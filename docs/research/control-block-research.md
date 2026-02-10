# CONTROL Block Bytecode Research

> **Status:** ✅ Confirmed  
> **Date:** 2026-02-10  
> **Issue:** #60

## Summary

The CONTROL block opcode **0x23** has been confirmed through compilation testing on Windows Node using INPACOMP.exe.

## Background

CONTROL blocks are special sections within SCREEN/LINE that execute only when `control()` is called:

```c
SCREEN s_control_demo()
{
    LINE("Motor Control", "") {
        textout("Motor Status:", 0, 1);
        
        CONTROL {
            // This runs when user activates control for this line
            INPAapiJob("ecu", "toggle_motor", "", "");
        }
    }
}

MENU m_control()
{
    ITEM(1, "Activate") {
        control();  // Triggers CONTROL blocks in current screen
    }
}
```

## Test Methodology

### Test Files Created

**CTRL01.ips** — Screen WITHOUT CONTROL (baseline):
```c
#include "inpa.h"

SCREEN s_nocontrol()
{
    LINE("Test", "")
    {
        textout("Hello", 0, 0);
    }
}

inpainit()
{
    setscreen(s_nocontrol, TRUE);
}

inpaexit()
{
}
```

**CTRL02.ips** — Screen WITH CONTROL block:
```c
#include "inpa.h"

SCREEN s_control()
{
    LINE("Test", "")
    {
        textout("Hello", 0, 0);
        
        CONTROL
        {
            text(0, 10, "Active");
        }
    }
}

inpainit()
{
    setscreen(s_control, TRUE);
}

inpaexit()
{
}
```

**CTRL03.ips** — Multiple CONTROL blocks:
```c
#include "inpa.h"

SCREEN s_multi()
{
    LINE("Line1", "")
    {
        textout("First", 0, 0);
        
        CONTROL
        {
            text(0, 10, "Ctrl1");
        }
    }
    
    LINE("Line2", "")
    {
        textout("Second", 0, 0);
        
        CONTROL
        {
            text(0, 10, "Ctrl2");
        }
    }
}

inpainit()
{
    setscreen(s_multi, TRUE);
}

inpaexit()
{
}
```

### Compilation

Files were compiled on Windows Node using:
```
cd C:\EC-APPS\INPA\SGDAT
..\BIN\INPACOMP.exe CTRLxx.ips -B compile.log
```

### Results

| File | Size | Contains CONTROL |
|------|------|------------------|
| CTRL01.ipo | 295 bytes | No |
| CTRL02.ipo | 338 bytes | Yes (1 block) |
| CTRL03.ipo | 440 bytes | Yes (2 blocks) |

## Bytecode Analysis

### Key Finding: Opcode 0x23 = CONTROL

In CTRL02.ipo, the CONTROL marker appears at offset 0x52:

```hex
# At boundary after CALL_API textout:
0x4E: 0c 81 49 00  # CALL_API textout (0x49)
0x52: 23 0a        # CONTROL marker + newline
0x54: 00 00 00 00  # Section header
0x58: 0a 0a 00     # Preamble
0x5B: [bytecode]   # CONTROL block body (function "#")
```

### CONTROL Block Compilation Pattern

The compiler generates the following structure:

1. **LINE body bytecode** — regular display code (textout, etc.)
2. **CONTROL marker (0x23)** — signals start of CONTROL section
3. **Newline (0x0A)** — terminates marker
4. **Internal function** — CONTROL code as named function

### Function Naming Convention

CONTROL block code is compiled into internal functions:

| Position | Function Name | Purpose |
|----------|---------------|---------|
| First LINE body | `!` | Main LINE display code |
| First CONTROL | `#` | CONTROL block code |
| Second LINE body | (inline) | Part of screen |
| Second CONTROL | (second `#` section) | Second CONTROL code |

### Bytecode Comparison

**CTRL01 (no CONTROL):**
```hex
0x4E: 0c 81 49 00   # CALL_API textout
0x52: 05 69 6e 70   # "inpainit" section starts immediately
```

**CTRL02 (with CONTROL):**
```hex
0x4E: 0c 81 49 00   # CALL_API textout
0x52: 23 0a         # CONTROL marker
0x54: 00 00 00 00   # Section header for "#" function
0x58: 0a 0a 00      # Preamble
0x5B: [bytecode]    # text(0, 10, "Active")
```

**CTRL03 (multiple CONTROLs):**
```hex
0x4D: 0c 81 49 00   # CALL_API textout (first)
0x51: 23 0a         # First CONTROL marker
...
0x70: 22 0a         # Second LINE marker
...
0x93: 0c 81 49 00   # CALL_API textout (second)
0x97: 23 0a         # Second CONTROL marker
```

## Compilation Notes

### Variable Declarations in CONTROL

Local variable declarations inside CONTROL blocks are NOT supported by INPACOMP.exe:

```c
// This FAILS to compile:
CONTROL
{
    int x;    // Error I225: Error in statement
    x = 1;
}

// This WORKS:
CONTROL
{
    text(0, 10, "Active");
}
```

Variables must be declared at function/screen scope, not inside CONTROL blocks.

## Conclusions

1. **Opcode 0x23 = CONTROL** ✅ Confirmed
2. CONTROL blocks are compiled as internal functions named `#`
3. The `0x23 0x0A` sequence marks the CONTROL block boundary
4. Multiple CONTROL blocks generate multiple `#` sections
5. CONTROL code is NOT inlined — it's a separate callable unit
6. The `control()` system function (ID 0x12) triggers these blocks

## Impact on Implementation

The `inpax disasm` tool correctly recognizes the 0x23 opcode as CONTROL. The bytecode decoder in `packages/core/src/parser/opcode-decoder.ts` has been updated to mark this as confirmed.

For a full interpreter implementation:
- When LINE bytecode hits 0x23, skip to next section (the CONTROL function)
- When `control()` is called (system function 0x12), execute the associated `#` function
- Track which LINE is active to call the correct CONTROL block

## References

- Issue #60: Research: CONTROL block bytecode representation
- `docs/IPO_Structure.md` — Main bytecode specification
- `docs/reference/ui-system.md` — CONTROL block usage documentation
