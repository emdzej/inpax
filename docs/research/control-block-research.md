# CONTROL Block Bytecode Research

> **Research Phase:** Issue #60 - CONTROL block representation  
> **Date:** 2026-02-10  
> **Status:** PRELIMINARY - Windows Node offline

## Goal

Determine how INPA represents CONTROL blocks in bytecode.

## Background

From `docs/reference/ui-system.md`, CONTROL blocks are special sections within SCREEN/LINE that execute only when `control()` is called:

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

---

## Research Findings

### 1. UI Marker Opcode Pattern

The existing UI construct markers follow a sequential pattern:

| Opcode | Hex | Construct | Location |
|--------|-----|-----------|----------|
| `0x21` | `21` | SCREEN_START | SCREEN section header |
| `0x22` | `22` | LINE | Within SCREEN, inline strings |
| `0x23` | `23` | **CONTROL?** | ⚠️ Hypothesized, not yet confirmed |
| `0x24` | `24` | ITEM | Within MENU section |
| `0x25` | `25` | STATE | Within STATEMACHINE section |

**Hypothesis:** Opcode `0x23` is the CONTROL marker, following the sequential UI marker pattern.

### 2. Production File Analysis

Analyzed production `.ipo` files in `~/Documents/ipo/`:

| Check | Result |
|-------|--------|
| `control()` call (0x0c 0x81 0x12 0x00) | ❌ Not found in any file |
| Opcode `0x23 0x0a 0x00` pattern | ❌ Not found |
| LINE structures with embedded blocks | ✅ Found normal LINE structures |

**Conclusion:** None of the analyzed production files contain CONTROL blocks.

### 3. LINE Structure Analysis

LINE markers follow this pattern:

```
22 0a              ; LINE opcode + newline
00 00 00 00        ; Padding (4 bytes)
[line_name] 0a     ; Line name string + newline
[api_params] 0a    ; API parameters string + newline
[body bytecode]    ; Normal instructions
```

If CONTROL exists, it would likely appear after the LINE body:

```
22 0a 00 00 00 00  ; LINE marker
[line_name] 0a
[api_params] 0a
[display bytecode] ; Code that runs during screen refresh
23 0a 00 00 00 00  ; CONTROL marker (hypothesized)
[control bytecode] ; Code that runs when control() is called
```

Or it could use a different mechanism with jump offsets.

### 4. control() System Function

From `docs/IPO_Structure.md`:

| ID | Function | Signature |
|----|----------|-----------|
| `0x12` | `control` | `()` |

The `control()` function (ID 0x12) triggers CONTROL blocks in the current screen. Its bytecode signature would be:

```hex
0c 81 12 00  ; CALL_API control (ID=0x12)
```

---

## Hypotheses

### Hypothesis A: Opcode 0x23 Marker

CONTROL blocks use opcode `0x23` as a marker, following the UI construct pattern:

```
23 0a              ; CONTROL marker
00 00 00 00        ; Padding
[control bytecode] ; Code executed on control()
```

**Evidence for:**
- Sequential opcode pattern (21, 22, 23, 24, 25)
- Consistent with other UI markers

**Evidence against:**
- Not found in production files
- Production files may not use CONTROL

### Hypothesis B: Inline Jump Structure

CONTROL blocks could be implemented using jump offsets:

```
22 0a ...          ; LINE marker
[display code]
00 0e [offset]     ; JMP past CONTROL block (during display)
[control code]     ; Executed only by control() function
```

**Evidence for:**
- Many jump instructions found in LINE bodies
- Would allow control() to jump directly to CONTROL code

**Evidence against:**
- Jump targets seem to point outside section boundaries
- Complex runtime handling required

### Hypothesis C: Separate Section

CONTROL blocks could be compiled into separate function sections with naming convention:

```
s_screen_name_control_0  ; CONTROL block for LINE 0
s_screen_name_control_1  ; CONTROL block for LINE 1
```

**Evidence for:**
- Would simplify control() implementation
- Function call mechanism already exists

**Evidence against:**
- No naming pattern found in production files
- Would require LINE indexing

---

## Required Testing (Windows Node)

To confirm CONTROL representation, compile these test files:

### Test 1: CTRL01.ips (Baseline - No CONTROL)
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

### Test 2: CTRL02.ips (Single CONTROL)
```c
#include "inpa.h"

SCREEN s_control()
{
    LINE("Test", "")
    {
        textout("Hello", 0, 0);
        
        CONTROL
        {
            int x;
            x = 1;
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

### Test 3: CTRL03.ips (Multiple CONTROL)
```c
#include "inpa.h"

SCREEN s_multi()
{
    LINE("Line1", "")
    {
        textout("First", 0, 0);
        
        CONTROL
        {
            int a;
            a = 1;
        }
    }
    
    LINE("Line2", "")
    {
        textout("Second", 0, 0);
        
        CONTROL
        {
            int b;
            b = 2;
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

### Test 4: CTRL04.ips (CONTROL with control() call)
```c
#include "inpa.h"

SCREEN s_test()
{
    LINE("Test", "")
    {
        textout("Value", 0, 0);
        
        CONTROL
        {
            int x;
            x = 42;
        }
    }
}

MENU m_test()
{
    INIT {}
    ITEM(1, "Activate")
    {
        control();
    }
}

inpainit()
{
    setmenu(m_test);
    setscreen(s_test, TRUE);
}

inpaexit()
{
}
```

---

## Analysis Plan

1. Compile CTRL01-CTRL04 on Windows Node
2. Copy .ipo files to Mac
3. Compare CTRL01 vs CTRL02 to identify CONTROL marker
4. Compare CTRL02 vs CTRL03 to understand multiple CONTROL handling
5. Verify control() call generates expected bytecode in CTRL04

---

## Next Steps

1. ⏸️ **Blocked:** Windows Node offline
2. When online:
   - Create test files in `C:\EC-APPS\INPA\SGDAT\`
   - Compile with `INPACOMP.exe -B`
   - Transfer .ipo files via `S:\` share

---

## References

- Issue #60: https://github.com/emdzej/inpax/issues/60
- `docs/reference/ui-system.md` - CONTROL syntax
- `docs/research/language-constructs.md` - UI marker patterns
- `docs/IPO_Structure.md` - control() function ID (0x12)

---

*Document created 2026-02-10. Research paused pending Windows Node availability.*
