# Opcode Mappings (IPS ↔ IPO)

This file documents **observed** opcode patterns from the simplest IPS/IPO pairs copied from the Windows node.
All instructions are 4 bytes long.

Sources analyzed:
- `tests/windows-samples/test_empty.ips` + `test_empty.ipo`
- `tests/windows-samples/LOCL01.ips` + `LOCL01.ipo`
- `tests/windows-samples/FUNC01.ips` + `FUNC01.ipo`

---

## 1) test_empty.ips

**IPS:**
```c
#include "inpa.h"

inpainit() {
}

inpaexit() {
}
```

**Observed blocks / IDs** (from IPO header order):
| Function name | Block ID |
|---|---|
| `__inpa_startup__` | 0x0000 |
| `__inpa_shutdown__` | 0x0001 |
| `inpainit` | 0x0002 |
| `inpaexit` | 0x0003 |

**Instruction sequences:**
- `inpainit` (len=1): `0E 00 00 00`
- `inpaexit` (len=1): `0E 00 00 00`
- `__inpa_startup__` (len=2): `0F 00 00 00` → `0C 80 02 00`
- `__inpa_shutdown__` (len=2): `0F 00 00 00` → `0C 80 03 00`

**Mapping notes:**
- `0C 80 [u16]` is confirmed **CALL_USER** (calls function ID 0x0002/0x0003).
- `0E 00 00 00` appears to be **RETURN** / function end (no explicit RET seen).
- `0F 00 00 00` appears immediately before `CALL_USER` (call prologue / stack marker?).

---

## 2) LOCL01.ips

**IPS:**
```c
// LOCL01.ips - Local variable test
inpainit() { }

inpaexit() { }

test_func() {
    int local_x;
    local_x = 42;
}
```

**Constants block (decoded):**
- Length = 1
- Entry #0: `03 2a 00` → `int 42`

**test_func instruction sequence (len=5):**
```
08 51 00 00
01 01 00 00
06 02 00 00
05 00 01 00
0E 00 00 00
```

**Tentative mapping (needs confirmation):**
- `08 51 00 00` appears **only when a local variable is declared** → likely local var alloc / stack frame setup.
- `01 01 00 00` appears before assignment → likely **PUSH_VAR_ADDR** or **PUSH_VAR_REF**.
- `06 02 00 00` appears to push the constant `42` → likely **PUSH_CONST** (index mapping still unclear).
- `05 00 01 00` appears after address+value push → likely **STORE** (assign).
- `0E 00 00 00` → **RETURN**.

**Note:** Constant index encoding still unclear. The only defined constant is `#0 = 42`, but the instruction uses `06 02 00 00`.

---

## 3) FUNC01.ips

**IPS:**
```c
#include "inpa.h"

helper()
{
    int x;
    x = 1;
}

inpainit()
{
    helper();
}

inpaexit()
{
}
```

**Constants block (decoded):**
- Length = 2
- Entry #0: `06 69 6e 70 61 2e 68 0a` → string `"inpa.h"`
- Entry #1: `03 01 00` → `int 1`

**helper instruction sequence (len=5):**
```
08 51 00 00
01 01 01 00
06 02 00 00
05 00 01 00
0E 00 00 00
```

**inpainit instruction sequence (len=3):**
```
0F 00 00 00
0C 80 04 00   ; CALL_USER helper (ID 0x0004)
0E 00 00 00
```

**Mapping notes:**
- `0C 80 04 00` confirms **CALL_USER** with target function ID `0x0004` (`helper`).
- `0F 00 00 00` appears immediately before the call (likely call-prologue).
- `0E 00 00 00` returns.
- The `helper` body shows same assignment pattern as LOCL01.

---

## 4) T04_arithmetic_ops.ips

**IPS:**
```c
x = a + b;
x = a - b;
x = a * b;
x = a / b;
```

**Observed 4-byte ALU ops (from hex, `inpainit`):**
- `09 60 00 00` → `a + b`
- `09 61 00 00` → `a - b`
- `09 62 00 00` → `a * b`
- `09 63 00 00` → `a / b`

## 5) T05_comparison_logic.ips

**IPS:**
```c
r = (a == b);
r = (a != b);
r = (a < b);
r = (a > b);
r = (a <= b);
r = (a >= b);
r = (a < b) && (b > 0);
r = (a < b) || (b > 0);
r = !(a == b);
```

**Observed 4-byte ALU ops (from hex, `inpainit`):**
- `09 68 00 00` → `==`
- `09 69 00 00` → `!=`
- `09 64 00 00` → `<`
- `09 65 00 00` → `>`
- `09 66 00 00` → `<=`
- `09 67 00 00` → `>=`
- `09 6A 00 00` → `&&`
- `09 6B 00 00` → `||`
- `09 6E 00 00` → `!`

## 6) T06_if_else.ips / 7) T07_while_loop.ips

**Observed branch opcodes (4 bytes):**
- `0B [s16] 00` → conditional jump (if/while)
- `0E [s16] 00` → unconditional jump (loop back)

## 10) T10_string_ops.ips

**Observed API calls (4 bytes):**
- `0C 81 23 00` → `strcat` (API id `0x23`)
- `0C 81 24 00` → `strlen` (API id `0x24`)
- `0C 81 25 00` → `midstr` (API id `0x25`)

---

## Provisional Opcode Table (Observed)

| Opcode (4B) | Meaning | Evidence |
|---|---|---|
| `0C 80 [u16]` | **CALL_USER** | `__inpa_startup__` → `inpainit`; `inpainit` → `helper` |
| `0C 81 [u16]` | **CALL_API** | `T10_string_ops` calls `strcat/strlen/midstr` via IDs `0x23/0x24/0x25` |
| `0E 00 00 00` | **RETURN / end-of-function** | Single-instruction bodies (`inpainit`, `inpaexit`) |
| `0F 00 00 00` | **Call prologue / marker** | Always appears immediately before `CALL_USER` |
| `08 51 00 00` | **Local var alloc / frame setup?** | Present only when local variable declared |
| `01 01 00 00` / `01 01 01 00` | **PUSH_VAR_ADDR?** | Appears before assignment |
| `06 02 00 00` | **PUSH_CONST?** | Appears before `STORE` in assignments |
| `05 00 01 00` | **STORE / assign?** | Appears after addr+value push |
| `09 60 00 00` | **ALU_ADD** | `T04_arithmetic_ops` (`x = a + b`) |
| `09 61 00 00` | **ALU_SUB** | `T04_arithmetic_ops` (`x = a - b`) |
| `09 62 00 00` | **ALU_MUL** | `T04_arithmetic_ops` (`x = a * b`) |
| `09 63 00 00` | **ALU_DIV** | `T04_arithmetic_ops` (`x = a / b`) |
| `09 64 00 00` | **ALU_LT** | `T05_comparison_logic` (`a < b`) |
| `09 65 00 00` | **ALU_GT** | `T05_comparison_logic` (`a > b`) |
| `09 66 00 00` | **ALU_LE** | `T05_comparison_logic` (`a <= b`) |
| `09 67 00 00` | **ALU_GE** | `T05_comparison_logic` (`a >= b`) |
| `09 68 00 00` | **ALU_EQ** | `T05_comparison_logic` (`a == b`) |
| `09 69 00 00` | **ALU_NE** | `T05_comparison_logic` (`a != b`) |
| `09 6A 00 00` | **ALU_AND** | `T05_comparison_logic` (`(a<b)&&(b>0)`) |
| `09 6B 00 00` | **ALU_OR** | `T05_comparison_logic` (`(a<b)||(b>0)`) |
| `09 6E 00 00` | **ALU_NOT** | `T05_comparison_logic` (`!(a==b)`) |
| `0B [s16] 00` | **JMP_FALSE** | `T06_if_else`, `T07_while_loop` (conditional branches) |
| `0E [s16] 00` | **JMP** | `T07_while_loop` (loop backjump) |

---

## Open Questions / Next Steps

- Confirm constant index encoding (LOCL01/FUNC01 suggest hidden offset or implicit constants).
- Disambiguate `01` vs `06` (push var vs push const) using additional samples.
- Identify exact meaning of `08 51` and `05 00 01` using more local/global variable examples.

---

## 2026-02-13 — Tests T11–T25

No new opcodes were observed in the compiled IPOs for T11, T12, T13, T17, T19–T25. The disassembler output only showed already-known constructs (e.g., `CALL_API`, `CALL_USER`, `PUSH_UI_HANDLE`, `ALU_OP`, `JMP`, `LINE`, `ITEM`, `SCREEN_START`).

Unsupported constructs (T14–T16, T18) were removed from the test set.
