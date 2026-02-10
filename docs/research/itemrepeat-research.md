# ITEMREPEAT Bytecode Research

> **Issue:** #66  
> **Date:** 2026-02-10  
> **Status:** ✅ RESOLVED

## Summary

`setitemrepeat()` is a **standard system function call** with ID `0xA1` (161 decimal). It does **not** modify ITEM structure or introduce new opcodes.

## Test Files

### REPEAT01.ips — Baseline (no itemrepeat)
```c
#include "inpa.h"

int x;

MENU m_normal()
{
    INIT
    {
        setmenutitle("Normal");
    }
    
    ITEM(1, "F1")
    {
        x = 1;
    }
}

inpainit()
{
    setmenu(m_normal);
}

inpaexit()
{
}
```

### REPEAT02.ips — With setitemrepeat
```c
#include "inpa.h"

int x;

MENU m_repeat()
{
    INIT
    {
        setmenutitle("Repeat");
        setitemrepeat(1, TRUE);
    }
    
    ITEM(1, "F1")
    {
        x = 1;
    }
}

inpainit()
{
    setmenu(m_repeat);
}

inpaexit()
{
}
```

## Bytecode Comparison

### INIT Block in REPEAT01 (baseline)
```hex
00000020: 0003 000f 0000 0001 0101 000c 8100 00
                            ^^^^^^^^^^^^^ CALL_API 0x00 (setmenutitle)
```

Decoded:
```
00 01 01 01      ; PUSH_CONST idx=1 ("Normal")
0C 81 00 00      ; CALL_API setmenutitle (0x00)
```

### INIT Block in REPEAT02 (with setitemrepeat)
```hex
00000020: 0007 000f 0000 0001 0101 000c 8100 000f
00000030: 0000 0001 0102 0001 0103 000c 81a1 00
                                  ^^^^^^^^^^^^^ CALL_API 0xA1 (setitemrepeat)
```

Decoded:
```
00 01 01 01      ; PUSH_CONST idx=1 ("Repeat")
0C 81 00 00      ; CALL_API setmenutitle (0x00)
00 0F 00 00      ; (alignment/padding)
00 01 01 02      ; PUSH_CONST idx=2 (int 1 - ItemNum)
00 01 01 03      ; PUSH_CONST idx=3 (TRUE - RepeatFlag)
0C 81 A1 00      ; CALL_API setitemrepeat (0xA1)
```

### ITEM Structure — Identical
Both files have the same ITEM marker:
```hex
24 0a 00 00 01 00 46 31 0a
^^ ITEM opcode (0x24)
         ^^^^^ Item key = 1 (u16 LE)
               ^^^^^^^^^ "F1\n"
```

**No change in ITEM structure when repeat is enabled.**

## Findings

### 1. setitemrepeat is System Function 0xA1

| ID (hex) | ID (dec) | Function | Signature |
|----------|----------|----------|-----------|
| `0xA1` | 161 | `setitemrepeat` | `(in: int ItemNum, in: bool RepeatFlag)` |

### 2. Standard Call Sequence

Arguments pushed to stack in order, then `CALL_API`:
```
PUSH_CONST (ItemNum = 1)
PUSH_CONST (RepeatFlag = TRUE)
CALL_API 0xA1
```

### 3. No Special Bytecode

- No new opcodes
- No modification to ITEM structure (opcode 0x24)
- No flags in ITEM arguments
- Runtime state only (VM tracks which items repeat)

### 4. File Size Difference

| File | Size | INIT bytecode |
|------|------|---------------|
| REPEAT01.ipo | 275 bytes | 3 bytes |
| REPEAT02.ipo | 296 bytes | 7 bytes |

Difference: 21 bytes (exactly the setitemrepeat call + padding)

## Constant Data Comparison

### REPEAT01
```hex
Constant Data:
  idx=0: inpa.h (string)
  idx=1: "Normal" (string)
  idx=2: 1 (int) — for ITEM key
  idx=3: 1 (int) — for x = 1
```

### REPEAT02
```hex
Constant Data:
  idx=0: inpa.h (string)
  idx=1: "Repeat" (string)
  idx=2: 1 (int) — for ITEM key / setitemrepeat ItemNum
  idx=3: 1 (bool TRUE) — for setitemrepeat RepeatFlag
  idx=4: 1 (int) — for x = 1
  idx=5: "F1" (string)
```

## Conclusion

`setitemrepeat()` is implemented as a **simple system function call** (ID 0xA1). The repeat behavior is tracked by the VM at runtime — there is no compile-time modification to the ITEM structure.

This is consistent with the INPA design pattern where UI state functions (like `setitem`, `setmenutitle`) configure behavior without changing bytecode structure.

## Implementation Notes

For EdiabasX interpreter:
1. Add `setitemrepeat` to system function table with ID 0xA1
2. Signature: `(in: int ItemNum, in: bool RepeatFlag)`
3. Store repeat state in MENU runtime context
4. When processing key events, check repeat flag and implement hold-to-repeat logic

## References

- `docs/IPO_Structure.md` — Section 8 (System Function IDs)
- `docs/reference/ui-system.md` — UI system documentation
- Issue #66 — Original research task
