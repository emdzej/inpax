# IPO File Format — Version Generations

Compiled INPA / NCSEXPERT `.IPO` files come in **two main generations**
with materially different constant-block encodings, plus a small number
of outlier versions. Our parser at
[`packages/parser/src/parser/ipo-parser.ts`](../packages/parser/src/parser/ipo-parser.ts)
currently only handles the v5.x generation; v1.x files disassemble with
mis-aligned constants ("unknown = null" entries cascading after the
first constant).

## Version distribution (one full BMW install, 5,428 `.ipo` files)

| Version | Count | Generation |
|---|---:|---|
| v1.0 | 121 | **Old** |
| v1.1 | 78 | **Old** |
| v1.2 | 1,546 | **Old** |
| v1.3 | 1,000 | **Old** |
| v1.4 | 30 | **Old** |
| **v4.4** | **393** | **New (same as v5.x)** |
| **v5.0** | **2,251** | **New** |
| v5.5, v13.10, v49.50 | tiny | Outliers — no `Constant Data` block; possibly stubs or a third variant |

About **53%** of any real install is the Old generation. We've been
mostly working with v5.0 test scripts (`MS43`, `EHC2RR`, `FZD_70` are
all v5.0), so the format gap has flown under the radar.

The **format break is between v1.4 and v4.4**, not between v4.4 and
v5.0 as the version numbers might suggest. v4.4 already uses the
"new" type table.

## What's the same across generations

These do **not** vary by version:

- **File header layout.** `u8 versionHi` + `u8 versionLo` + ASCII magic
  `TEST-Infotext` + `\n` terminator. We already read this correctly
  for both generations.
- **Block headers.** `u8 type` + `\n`-terminated name + `u16 blockId` +
  `u16 flags` + `\n`-terminated arg1 + `\n`-terminated arg2 + `u8 marker`
  + `u16 size`. Verified against NCSEXPERT's writer (`FUN_0046b160` in
  NCSEXPERT.exe @ 0x0046b160).
- **Block type IDs.** `0x05` = Function, `0x11` = Global Data, `0x12` =
  Constant Data, `0x01` = Screen, `0x02` = Menu, `0x03` = State
  Machine, `0x04` = Logic Table, `0x21`–`0x25` = sub-function variants.
- **Bytecode instruction layout.** 4 bytes per instruction —
  `u8 opcode` + `u8 operand1` + `u16 operand2` (little-endian). All
  inspected opcodes (`LOAD`, `PUSHR`, `MOVE`, `CALL`, `ALU`, `JMPNZ`)
  decode coherently with the v5.x opcode table in v1.x files. **No
  observed opcode renumbering** between generations.
- **Constant-block payload count.** The `size` field on the
  `Constant Data` block header is the number of entries in both
  generations.

## What differs — constant-block type bytes

The `.IPO` file's value-type vocabulary was **completely reshuffled**
between Old (v1.x) and New (v4.4+). Source: the constants-block
writer inside NCSEXPERT.exe (`FUN_0046b240` @ 0x0046b240). Its switch
on the in-memory type tag tells us exactly which byte represents
which type in the Old format:

```c
// NCSEXPERT.exe FUN_0046b240 — Old (v1.x) constants writer
switch (in_memory_type_u32) {
  case 1: bytes_written = 2; /* Bool — type byte + 1 byte payload */
  case 2: bytes_written = 3; /* Int (s16) — type byte + 2 bytes LE */
  case 3: bytes_written = 9; /* Real (f64) — type byte + 8 bytes LE */
  case 4:                    /* String — type byte + bytes... + 0x0a terminator */
  case 5: bytes_written = 5; /* Long (s32) — type byte + 4 bytes LE */
}
```

Compared with our v5.x mapping (matches `ValueType` in
[`packages/core/src/types/enums.ts`](../packages/core/src/types/enums.ts)):

| File byte | **Old (v1.x)** | bytes consumed | **New (v4.4 / v5.x)** | bytes consumed |
|---|---|---|---|---|
| `0x01` | Bool | 1+1 | Bool | 1+1 |
| `0x02` | **Int (s16 LE)** | 1+2 | Byte | 1+1 |
| `0x03` | **Real (f64)** | 1+8 | Int (s16 LE) | 1+2 |
| `0x04` | **String (`\n`-terminated)** | variable | Long (s32 LE) | 1+4 |
| `0x05` | **Long (s32 LE)** | 1+4 | Real (f64) | 1+8 |
| `0x06` | *(not used)* | — | String (`\n`-terminated) | variable |
| `0x07` | *(not used)* | — | ULong (u32 LE) | 1+4 |
| `0x08` | *(not used)* | — | Numeric (4 bytes) | 1+4 |
| `0x09` | *(not used)* | — | Object | 1+4 |

**Old has no `Byte` and no `ULong/Numeric/Object` types.** The smallest integer
in Old is `Int (s16)`. The new generation added `Byte` as type `0x02`
and shifted everything else down — that's why `Int` moved from `0x02`
to `0x03`, `Real` from `0x03` to `0x05`, etc.

### Cascading mis-read

Our current parser reads an Old-format `0x04 "cabi.h\n"` as
`Long` (s32 = 4 bytes), consuming 4 bytes of the string and emerging
mid-stream. Then the leftover `.`, `h`, `\n` bytes get read as type
tags that aren't in our `ValueType` enum → value `null`, no payload
consumed, cumulative drift. Eventually the parser re-aligns by
accident (8 bytes consumed for what should've been an 8-byte string
entry), but the constant indices are wrong relative to what the
bytecode loads.

## What differs — sample sniff

Raw bytes at the start of each version's `Constant Data` block:

```
v1.0  EC-APPS/INPA/SGDAT/A_ACC.IPO  (295 entries)
  04 63 61 62 69 2e 68 0a 02 e8 03 02 e9 03 02 ea  | .cabi.h.........
  03 02 fc 03 02 fd 03 02 fe 03 02 ff 03 02 10 04  | ................

v1.2  NCSEXPER/SGDAT/A_AKMB46.ipo   (551 entries)
  04 63 61 62 69 2e 68 0a 02 e8 03 02 e9 03 02 ea  | .cabi.h.........
  03 02 eb 03 02 fc 03 02 fd 03 02 fe 03 02 ff 03  | ................

v1.2  EC-APPS/INPA/SGDAT/001MVD1722.ipo (1673 entries)
  04 30 36 46 6c 61 73 68 0a 04 36 2e 30 30 0a 04  | .06Flash..6.00..
  42 4d 57 20 45 45 20 31 31 20 4a 75 73 6b 6f 2c  | BMW EE 11 Jusko,

v1.4  EC-APPS/INPA/SGDAT/01DDE608.IPO (1889 entries)
  04 30 31 44 44 45 36 30 38 0a 04 30 2e 30 31 0a  | .01DDE608..0.01.
  04 5a 4d 2d 45 2d 33 32 20 53 63 68 6d 69 74 74  | .ZM-E-32 Schmitt

v4.4  EC-APPS/INPA/SGDAT/ABGAS.IPO   (809 entries)
  06 69 6e 70 61 2e 68 0a 06 62 6d 77 6c 69 62 2e  | .inpa.h..bmwlib.
  68 0a 04 00 00 00 00 06 3f 0a 06 3f 0a 06 3f 0a  | h.......?..?..?.

v5.0  EC-APPS/INPA/CFGDAT/startger.ipo (724 entries)
  06 69 6e 70 61 2e 68 0a 06 42 4d 57 5f 53 54 44  | .inpa.h..BMW_STD
  2e 68 0a 04 00 00 00 00 06 3f 0a 06 3f 0a 06 3f  | .H.......?..?..?
```

Old: starts with `0x04` (string) for the include filename.
New: starts with `0x06` (string) — `0x04` only appears later as a 4-byte
Long (`04 00 00 00 00` = Long 0).

## Outlier versions (v5.5, v13.10, v49.50)

A small handful of files declare versions outside the known-good
range and our scan finds no `Constant Data` block in them — they may
be:

- Auto-generated stub `.IPO` files (no constants needed).
- A third format variant we haven't characterised.
- Files that were renamed `.ipo` but aren't actually IPO bytecode.

Counts are small (~tens of files). Recommend flagging via a clear
error message rather than mis-parsing.

## Why the embedded interpreter matters

**NCSEXPERT.exe contains an embedded IPO interpreter** — it does not
load `INPA.DLL` or any external INPA library. Confirmed by inspecting
NCSEXPERT.exe's import table:

- Only ECU communication imports (`__api*` family from `api32.dll`).
- No INPA-specific imports.
- The bytecode loader / executor is `FUN_00464c50` @ 0x00464c50 (LALR-
  style table-driven state machine; semantic actions execute BEST2 ops
  inline).
- The constants writer that gave us the Old type-byte table is
  `FUN_0046b240` @ 0x0046b240 — confirmed via Ghidra decompilation.

NCSEXPERT writes v1.x format files (the version bytes `01 02` are at
`DAT_007a9b10`, written by `FUN_0046af40`). The fact that v4.4+
INPA files don't use the v1.x format means **INPA itself was updated
at some point** to a new on-disk format and the embedded interpreter
in INPA.exe presumably handles both generations. Cross-referencing
this against INPA.exe's reader (when available) would confirm the
exact bytecode-level v1.x/v5.x compatibility story.

## INPA.exe verification (2026-05-19)

INPA.exe was loaded in Ghidra and the debug-output constants reader
**`FUN_00463bd7`** was decompiled. It uses **type bytes 1–8 unconditionally**
with no `versionHi == 1` branch — same v5.x table as our parser:

| Type | INPA.exe name | Payload | Error string at |
|---|---|---|---|
| 0x01 | BOOL | 1 byte | 0x49a7a4 |
| 0x02 | BYTE | 1 byte | 0x49a8a0 |
| 0x03 | INT | 2 bytes LE | 0x49a804 |
| 0x04 | LONG | 4 bytes LE | 0x49a850 |
| 0x05 | REAL | 8 bytes LE | 0x49a8f0 |
| 0x06 | STRING | NL-terminated, max 1023 | 0x49a95c |
| 0x07 | **ULONG** | 4 bytes LE | 0x49a990 |
| 0x08 | **NUMERIC** | 4 bytes LE | 0x49a9e0 |
| default | "Error reading constant data value (undefined data)" | — | 0x49aa24 |

**Corrections to our `ValueType` enum** (in
[`packages/core/src/types/enums.ts`](../packages/core/src/types/enums.ts)):

- **Type `0x07` is `ULONG`** — we had `Handle1`. Wrong.
- **Type `0x08` is `NUMERIC`** — we had `Handle2`. Wrong. The runtime
  converts NUMERIC values via "TryConversion from both ASCII-LONG"
  (referenced at `INPA.exe!0x0049a6c8` from `FUN_0045ffdc`).
- **Type `0x09` is `OBJECT`** — we had `Handle3`. Wrong. Confirmed
  via the type-name table at `FUN_0046456b`:

  ```
  0=NONE, 1=BOOL, 2=BYTE, 3=INT, 4=LONG, 5=REAL,
  6=STRING, 7=ULONG, 8=NUMERIC, 9=OBJECT, else=UNDEFINED
  ```

Our enum should be:

```typescript
export enum ValueType {
  Void    = 0x00,
  Bool    = 0x01,
  Byte    = 0x02,
  Int     = 0x03,  // s16
  Long    = 0x04,  // s32
  Real    = 0x05,  // f64
  String  = 0x06,
  ULong   = 0x07,  // u32
  Numeric = 0x08,  // 32-bit, ASCII-convertible
  Object  = 0x09,
}
```

## Question still open: does INPA.exe natively load v1.x files?

The debug-path reader (`FUN_00463bd7`) is **shared** between the
debug-dump mode and the regular parse — no version dispatch visible.
This means:

- **Either** INPA.exe has a separate v1.x reader buried inside the
  runtime loader `FUN_00457594` (21 KB of x86 code, too large to
  decompile in one shot — would need a chunked / per-block-handler
  follow-up).
- **Or** INPA.exe simply **doesn't read v1.x files correctly** — the
  3,251 v1.x scripts in `EC-APPS/INPA/SGDAT/` may not load in modern
  INPA installs at all, and the format generation gap is older than
  INPA's current binary expects.

**Empirical verification path** that doesn't require more Ghidra
work: pick one of the v1.x scripts in `EC-APPS/INPA/SGDAT/`, run it
through `INPA.exe`, and observe whether it loads cleanly, errors out,
or silently mis-parses. If INPA.exe handles them, the runtime loader
has version dispatch deep inside. If it errors, then **NCSEXPERT.exe
is the only binary that natively reads v1.x — and our parser would
need to mirror it** (rather than mirror INPA.exe).

## Open questions / verification needed

Before writing a parser fix, verify these against INPA.exe's reader
(the runtime path, not the debug printer):

1. **Whether the runtime loader `FUN_00457594` @ 0x00457594 has any
   v1.x-specific branches.** This is the 21 KB function that owns the
   actual parse. Chunked decompile or symbol-naming pass would resolve
   it. If it doesn't, v1.x files are NCSEXPERT-only and our parser
   should mirror NCSEXPERT's writer (the table at the top of this
   doc).
2. **Global-block type bytes.** I'm inferring v1.x uses the same
   reduced type table as constants (no Byte, no Handle, types
   `0x01`–`0x05`). The global block in `A_AKMB46.ipo` is 67 bytes —
   the byte values should all be in 0x01–0x05. If we see other values,
   there's more vocabulary to learn.
3. **CAST opcode type markers.** v5.x uses `TypeMarker` 0x50–0x57 for
   inline type casts in bytecode. v1.x may use a smaller range.
4. **Whether `LogicTable` (block type `0x04`) data uses the v1.x or
   v5.x value types for its lookup keys.** Logic tables read constants
   indirectly, so the type semantics matter there too.
5. **Outliers v5.5, v13.10, v49.50.** What are they? Real format
   variants, stubs, or mis-extensioned files?

## Suggested parser changes (after verification)

`parseConstant()` in `packages/parser/src/parser/ipo-parser.ts:191`
should dispatch on the file's version:

```typescript
private parseConstant(): StackEntry {
  return this.header.versionHi === 1 ? this.parseConstantV1() : this.parseConstantV5();
}

private parseConstantV1(): StackEntry {
  const type = this.readU8();
  switch (type) {
    case 0x01: return { type, flags: 1, value: this.readU8() !== 0 }; // Bool
    case 0x02: return { type, flags: 1, value: this.readS16LE() };    // Int
    case 0x03: return { type, flags: 1, value: this.readF64LE() };    // Real
    case 0x04: return { type, flags: 1, value: this.readStringUntil(0x0a) }; // String
    case 0x05: return { type, flags: 1, value: this.readS32LE() };    // Long
    default:   return { type, flags: 1, value: null };
  }
}
```

`parseGlobals()` should also need version-aware handling if the type-
byte vocabulary differs there too — to confirm before changing.

`ValueType` enum should grow a canonical representation that abstracts
across versions (e.g. `CanonicalType = "bool" | "byte" | "int" | "long"
| "real" | "string" | "handle"`), so consumers like the disassembler
can label values consistently regardless of which on-disk type byte
they came from. The raw `type` byte stays on `StackEntry` for round-
tripping; a derived `canonicalType` field is what UIs render.

## Tools used for this analysis

- **Ghidra** with the `ghidra` MCP server — for decompiling NCSEXPERT.exe
  (`FUN_004677c0`, `FUN_0046b240`, `FUN_0046b160`, `FUN_0046af40` etc.).
- Raw byte dumpers under `/tmp/dump-*.mjs` — version histograms +
  per-version constants-block byte sampling.

## INPA.exe VM dispatcher — CAST and ALU type behavior (2026-05-19)

Decompiled `INPA_VM_Interpret` @ `0x004607d7`, the main opcode dispatcher.
All findings below are from the v5.x runtime path only.

### Opcode 0x04 is a NOP, not CAST

The dispatcher's `case 4` body is literally `*ip += 1` — no work. Our
enum already reflects this (`Opcode.NOP = 0x04, // was CAST`). There is
**no separate CAST opcode** in the VM. Type coercion is performed in two
places, neither of which is opcode 0x04:

1. **Inline immediate / variable init** via TypeMarker bytes (`0x50`–
   `0x57`) carried in `ALLOC` (opcode `0x08`) and `PUSHIMM` (opcode
   `0x11`). Verified via `FUN_00460f29` — the marker→ValueType mapper:

   | TypeMarker | → ValueType | Used by                    |
   |---|---|---|
   | `0x50` BOOL    | 1 BOOL      | ALLOC, PUSHIMM (inline byte)|
   | `0x51` INT     | 3 INT       | ALLOC, PUSHIMM (inline s16) |
   | `0x52` BYTE    | 2 BYTE      | ALLOC, PUSHIMM (inline u8)  |
   | `0x53` LONG    | 4 LONG      | ALLOC, PUSHIMM (inline s32) |
   | `0x54` REAL    | 5 REAL      | ALLOC only                  |
   | `0x55` STRING  | 6 STRING    | ALLOC only                  |
   | `0x56` **OBJECT**  | 9 OBJECT    | ALLOC only                  |
   | `0x57` **ULONG**   | 7 ULONG     | ALLOC only                  |

   Note: there is **no marker for `NUMERIC` (ValueType 8)**. NUMERIC
   exists only as a constant-pool entry type; it cannot be declared.

2. **NUMERIC→concrete coercion** via `FUN_0045ffdc` (which calls
   `FUN_0046014a`). Called once from inside `FUN_00457594` (the 21 KB
   runtime loader) — i.e. at script-load time, not during opcode
   dispatch. The coercion rules in `FUN_0046014a`:

   | Source type | Target type | Behavior |
   |---|---|---|
   | NUMERIC (8) | BOOL (1)   | only if source already typed BOOL  |
   | NUMERIC (8) | BYTE (2)   | succeeds iff value fits in s8  |
   | NUMERIC (8) | INT (3)    | succeeds iff value fits in s16 |
   | NUMERIC (8) | LONG (4)   | succeeds iff value fits in s32 |
   | NUMERIC (8) | NUMERIC (8)| MessageBox `"Linker typ ist NUMERIC..."` then forces LONG |
   | NUMERIC (8) | any other  | error 0x149 (`FUN_0045d573`)   |
   | both sides NUMERIC | —    | MessageBox `"TryConversion from both ASCII-LONG"`, then both forced to LONG |

   So by the time control reaches the ALU dispatcher, NUMERIC has
   already been resolved to BOOL/BYTE/INT/LONG (or errored out at
   load).

**Bytecode `TypeMarker` correction** in
[`packages/core/src/types/enums.ts`](../packages/core/src/types/enums.ts):

- `TypeMarker.Handle1 = 0x56` was wrong → **`Object = 0x56`**.
- `TypeMarker.Handle2 = 0x57` was wrong → **`ULong = 0x57`**.

`opAlloc` in
[`packages/interpreter/src/vm/interpreter.ts`](../packages/interpreter/src/vm/interpreter.ts)
was also returning the swapped ValueTypes for `0x56`/`0x57` and
initializing them to `null`. INPA inits to `0` for all numeric/handle
types (`STRING` → empty, `REAL` → `0.0`). Both fixed.

### ALU dispatcher — supported types per op

`FUN_00460faf(this, alu_op)` is invoked by opcode `0x09` (`ALU`). For
each binary op it pops two stack entries via `FUN_0045fa38(&pool, &lhs,
&rhs)` and switches on `*lhs` (the destination's ValueType). The
supported types per AluOp:

| AluOp | Name | Types supported            | Notes |
|---|---|---|---|
| `0x60` | ADD  | BYTE, INT, LONG, REAL, **STRING** | String case calls `FUN_00470810` (concat). REAL has overflow→`±DBL_MAX` saturation. |
| `0x61` | SUB  | BYTE, INT, LONG, REAL      | REAL overflow saturated. |
| `0x62` | MUL  | BYTE, INT, LONG, REAL      | REAL overflow saturated. |
| `0x63` | DIV  | BYTE, INT, LONG, REAL, **NUMERIC**→error | Divide-by-zero calls `FUN_0045d76e(0,400)` when `DAT_004a0024 == 0`. NUMERIC case calls `FUN_0045d76e(this_00, 0x195)` — runtime error. |
| `0x64` | LT   | BYTE, INT, LONG, REAL, **NUMERIC**→error | Same NUMERIC error path. Switch indexed by `*lhs - 2` so index 6 (= type 8 NUMERIC) hits the error case. |
| `0x65` | GT   | BYTE, INT, LONG, REAL      | |
| `0x66` | LE   | BYTE, INT, LONG, REAL      | |
| `0x67` | GE   | BYTE, INT, LONG, REAL      | |
| `0x68` | EQ   | BOOL, BYTE, INT, LONG, REAL, **STRING** | String case calls `FUN_004251f0` (string-equal). |
| `0x69` | NE   | BOOL, BYTE, INT, LONG, REAL, **STRING** | String case calls `FUN_00462120` (string-not-equal). |
| `0x6a` | AND  | **BOOL only**              | logical && |
| `0x6b` | OR   | **BOOL only**              | logical \|\| |
| `0x6c` | XOR  | **BOOL only**              | implemented as `lhs != rhs` |
| `0x6d` | NEG  | BYTE, INT, LONG, REAL      | unary minus |
| `0x6e` | NOT  | **BOOL only**              | `result = (operand == 0)` |
| `0x6f` | BAND | BYTE, INT, LONG            | bitwise; widths 8/16/32 |
| `0x70` | BOR  | BYTE, INT, LONG            | bitwise |
| `0x71` | BXOR | BYTE, INT, LONG            | bitwise |

### Behavior on `ULONG` (7), `NUMERIC` (8), `OBJECT` (9)

- **`ULONG`** is **never** in any ALU switch. The dispatcher's switch
  falls out with no case match, leaving the LHS stack entry unchanged.
  So `ulong + ulong`, `ulong < ulong`, etc. are **silent no-ops**. The
  result is whatever value was in `lhs` before the op. This is almost
  certainly intentional — ULONG values come from `import32` returns,
  ECU job results, and similar opaque-handle slots that the script
  language is never expected to do arithmetic on.
- **`OBJECT`** — same story: never in any switch, silent no-op. OBJECT
  is even more opaque than ULONG.
- **`NUMERIC`** — almost never reaches the ALU because of the load-time
  coercion path described above. The two ops that do have explicit
  NUMERIC cases (DIV, LT) both report runtime error `0x195`. All other
  ops with a stray NUMERIC LHS are silent no-ops.

### What this means for our interpreter

1. We do **not** need to implement arithmetic for `ValueType.ULong` or
   `ValueType.Object` — INPA itself doesn't. Treating those operands
   as no-op (and logging a warning) matches INPA.exe behavior.
2. We **do** need to implement the NUMERIC→concrete coercion at
   constant-load time, mirroring `FUN_0046014a`. Right now our parser
   reads type-8 entries as raw `s32`. Once the variable holding the
   constant has a declared type, the value should be widened/narrowed
   into that type (BOOL/BYTE/INT/LONG) with the range check INPA does.
   For other targets, we should emit the same load-time error INPA
   does, rather than silently letting NUMERIC reach an ALU dispatcher
   that can't handle it.
3. Opcode `0x04` should stay `NOP` in our enum — there is no `CAST`
   opcode to implement. The `TypeMarker` enum (currently consumed by
   `opAlloc` only) is a static byte-→-type lookup, not a runtime cast.
4. String `+` (concat) and string `==`/`!=` are first-class ALU ops in
   INPA. Our interpreter should support those types for ADD/EQ/NE.

## Update log

- **2026-05-19** — Initial documentation, based on NCSEXPERT.exe
  decompilation and one full BMW install scan.
- **2026-05-19** — INPA.exe partially analysed. Debug-path reader
  `FUN_00463bd7` confirmed to use v5.x table without version dispatch.
  Type 7/8/9 vocabulary corrected (`ULONG`/`NUMERIC`/`OBJECT`, not
  `Handle1/2/3`). Runtime loader `FUN_00457594` is 21 KB and not yet
  decompiled in full — whether it has hidden v1.x dispatch is an open
  question.
- **2026-05-19** — `INPA_VM_Interpret` @ `0x004607d7` decompiled.
  Confirmed opcode `0x04` is a NOP (no CAST opcode exists). `TypeMarker`
  bytes `0x56`/`0x57` corrected (Object/ULong, not Handle1/Handle2).
  Documented full ALU type-support matrix and confirmed
  ULONG/OBJECT silently no-op through the ALU while NUMERIC is
  coerced at load time via `FUN_0045ffdc`/`FUN_0046014a`.
- **2026-05-19** — NCSEXPERT.exe v1.x reader path identified end-to-end
  (see section below). Open question (#1) about INPA.exe's hidden v1.x
  dispatch is **no longer load-bearing** — NCSEXPERT has a complete
  binary-mode v1.x reader, so our parser can mirror it directly without
  needing to chunk-decompile INPA's `FUN_00457594`.
- **2026-05-19** — `FUN_00464c50` (initially mistaken for the VM)
  decompiled and reclassified as NCSEXPERT's LALR(1) source parser.
  Extracted v1.x **opcode and ALU vocabulary** from its bytecode
  emissions: ALU op codes (`0x60`–`0x71`) are **identical to v5.x**;
  observed opcodes (`0x01`, `0x02`, `0x03`, `0x05`, `0x06`, `0x09`,
  `0x0A`, `0x0B`, `0x0C`, `0x0F`, `0x10`) match v5.x meanings; LineFunc
  / ControlFunc / MenuItemFunc are **emitted by the v1.x compiler**
  even though NCSEXPERT's own binary reader doesn't read them back.
- **2026-05-19** — Found NCSEXPERT's **true VM dispatcher**:
  `CInterpreter::DoInterpret` at `FUN_0045d830` (assertion-message
  symbol). Decompiled the full opcode dispatch + the ALU sub-dispatcher
  `FUN_0045d030` + the TypeMarker mapper `FUN_0045cdc0`. The
  earlier-extracted "opcode emissions" from the source parser were
  **misinterpreted** — the parser does emit those bytes, but the
  *byte values* differ from v5.x for opcodes `0x0D`–`0x10`. See the
  new section below for the complete divergence map.

## NCSEXPERT.exe v1.x reader (2026-05-19)

NCSEXPERT.exe is the authoritative reference for v1.x binary IPO files.
It has both a writer (we already documented `FUN_0046b240` etc.) **and**
a complete binary reader. Open question #1 above (whether INPA.exe has
hidden v1.x dispatch) becomes academic — even if INPA.exe doesn't read
v1.x, NCSEXPERT does, and our parser should mirror NCSEXPERT for the
v1.x dialect.

### Mode dispatch

`FUN_0045e460` chooses the load path based on `DAT_006038e8`:

| Mode | Path                                          | Purpose                                       |
|---|---|---|
| `1` | `FUN_004677c0` → LALR parse → write IPO       | Source-to-IPO compile (writes binary IPO)     |
| `2` | `FUN_0045e460` → `FUN_0046c170` → `FUN_0046bae0` | **Binary IPO load**                         |
| else | `FUN_00467c50` → `FUN_004677c0` (LALR only)  | Source-text interpret (no binary emission)    |

### Binary reader: `FUN_0046bae0`

1. Opens the file with `fopen(path, "rb")` via `FUN_0046b670`
   (which switches between `"wb"` and `"rb"` depending on the mode
   string passed — `&DAT_005e004c == "rb"`).
2. Reads two version bytes via `FUN_0046a910` and validates:
   - `versionHi == DAT_00791430` (exact match — must equal `0x01`)
   - `versionLo <= DAT_00791434` (max value, currently `0x02`)
   So **this NCSEXPERT.exe build accepts v1.0, v1.1, v1.2 only**. The
   v1.3 and v1.4 files we have in the wild were produced by a newer
   NCSEXPERT and would error 0x131 on load here.
3. Loops over blocks via `FUN_0046b7b0` (block-header reader) and
   dispatches on the first byte (the block type):

   | Block type | v1.x reader case | v5.x equivalent |
   |---|---|---|
   | `0x01` Screen        | **(not handled)** — falls through to `error 0x135` | Screen |
   | `0x02` Menu          | **(not handled)** | Menu |
   | `0x03` StateMachine  | `FUN_004685c0`, `FUN_00469560(2, …)`, `FUN_00471900`, `FUN_0046ae20` | StateMachine |
   | `0x04` LogicTable    | `FUN_004685c0`, `FUN_00469560(4, …)`, `FUN_0046ad30` | LogicTable |
   | `0x05` Function      | `FUN_004685c0`, `FUN_00469560(3, …)`, `FUN_0046ae20` | Function |
   | `0x11` GlobalData    | `FUN_0046a9a0(0, …)` | GlobalData |
   | `0x12` ConstantData  | `FUN_0046a9a0(1, …)` | ConstantData |
   | `0x21` ScreenFunc    | `FUN_0046ae20(DAT_007aa4c4, …)` | ScreenFunc |
   | `0x22` LineFunc      | **(not handled)** | LineFunc |
   | `0x23` ControlFunc   | **(not handled)** | ControlFunc |
   | `0x24` MenuItemFunc  | **(not handled)** | MenuItemFunc |
   | `0x25` StateFunc     | `FUN_004689a0`, `FUN_00471c70`, `FUN_0046ae20` | StateFunc |
   | default              | `FUN_00468260(0x135)` — error | — |

   So **v1.x lacks INPA's live-diagnostic UI vocabulary**: the Screen
   *container* (`0x01`) and Menu *container* (`0x02`), plus the
   sub-element function bodies LineFunc (`0x22`), ControlFunc (`0x23`),
   and MenuItemFunc (`0x24`). v1.x **does** keep ScreenFunc (`0x21`)
   and StateFunc (`0x25`), so screen-level and state-level function
   bodies are still expressible — what's missing is the multi-LINE
   cyclic-refresh + F-key + dropdown-menu model that defines INPA's
   real-time diagnostic display. Consistent with NCSEXPERT being a
   Windows-dialog vehicle-coding tool, not a live ECU readout UI.

### Block header layout (v1.x)

`FUN_0046b7b0` reads the block header in this order — **identical to
v5.x**:

| Offset | Type | Field | Read via |
|---|---|---|---|
| 0 | `u8`    | type      | `fread(buf, 1, 1)` |
| 1 | string  | name      | `fgets(buf, 0x7f)` newline-terminated, NL stripped by `FUN_0046a860` |
| — | `u16` LE | blockId   | `fread(buf, 1, 2)` |
| — | `u16` LE | flags     | `fread(buf, 1, 2)` |
| — | string  | arg1      | `fgets(…)` |
| — | string  | arg2      | `fgets(…)` |
| — | `u8`    | marker    | `fread(buf, 1, 1)`; stored as `(byte == 1)` boolean |
| — | `u16` LE | size      | `fread(buf, 1, 2)` |

Our parser already reads this layout, so no v1.x-specific block-header
fix is needed.

### Constants / globals reader: `FUN_0046a9a0(this, kind, count)`

- `kind == 0` → **globals block (0x11)**: reads `count` type bytes
  only, no values. Each type byte is dispatched into the runtime via
  `FUN_00462710(type, default)`; the runtime initializes variables to
  default values (0 / null) without consuming any bytes from the file
  past the type. Supported type bytes: `0x01`, `0x02`, `0x03`, `0x04`,
  `0x05`. Any other type byte hits `error 0x135` via the default arm.
- `kind == 1` → **constants block (0x12)**: reads `count` (type, value)
  pairs:

  ```c
  switch (type) {
  case 0x01: fread(&v, 1, 1); value = (v == 1);            // BOOL    (1 byte)
  case 0x02: fread(&v, 1, 2); value = (s16)v;              // INT     (2 bytes LE)
  case 0x03: fread(&v, 1, 8); value = (double)v;           // REAL    (8 bytes)
  case 0x04: fgets(buf, 0x3ff); strip NL                   // STRING  (LF-terminated, max 1023)
  case 0x05: fread(&v, 1, 4); value = (u32)v;              // LONG    (4 bytes LE)
  default:   error 0x12e
  }
  ```

  **This is the authoritative v1.x value-type table.** Five types
  only (`0x01`–`0x05`). No BYTE, no ULONG, no NUMERIC, no OBJECT.

### v1.x → v5.x type migration

The shift is **not** a simple "added BYTE at 0x02, everything shifted
down one." Comparing the tables side-by-side:

| Byte | v1.x      | v5.x      |
|---|---|---|
| `0x01` | BOOL      | BOOL      |
| `0x02` | **INT** (s16) | **BYTE**  |
| `0x03` | **REAL** (f64) | INT (s16) |
| `0x04` | **STRING** | **LONG** (s32) |
| `0x05` | LONG (s32) | **REAL** (f64) |
| `0x06` | (unused)  | STRING    |
| `0x07` | (unused)  | ULONG     |
| `0x08` | (unused)  | NUMERIC   |
| `0x09` | (unused)  | OBJECT    |

So **all five v1.x types moved to different slots in v5.x** — BOOL is
the only stable one. Any v1.x→v5.x conversion needs a full remap, not
just a "shift by one." This explains why our parser produces
"unknown = null" for v1.x constants — every type byte except `0x01`
collides with a *different* meaning in our v5.x table.

### Function-body reader: `FUN_0046ae20`

```c
while (count--) {
    fread(&instr, 1, 4, file);   // ← 4-byte instructions
    array->SetAtGrow(index++, instr);
}
```

**v1.x bytecode instructions are 4 bytes wide** — same as v5.x. The
on-disk layout for an instruction word matches what our parser
already produces from v5.x files. The question of whether the v1.x
**opcode and operand semantics** match v5.x is still open — that's
what `FUN_00464c50` (NCSEXPERT's combined VM/interpreter, ~10 KB and
the heavy user of `CDataMan::GetStackData` / `GetStackData2`) would
tell us. Most likely v1.x has a strict subset of v5.x opcodes (no
PUSHIMM for ULONG/OBJECT markers, no NUMERIC coercion, no STRING ALU
ops at all) but that needs the dispatcher decompiled to verify.

### v1.x opcode / ALU vocabulary (from the source parser)

`FUN_00464c50` (~10 KB, ~260 cases) is NCSEXPERT's LALR(1) source
parser, not a VM dispatcher — the dual-stack `"Parser stack overflow"`
shape and the action table at `DAT_00606538` make this unambiguous.
But it's still load-bearing for us, because when `DAT_006038e8 == 1`
(compile mode) the reduction actions emit v1.x bytecode via two
helpers:

- **`FUN_00470a40(state, opcode, operand)`** — appends one 4-byte
  instruction `[opcode][operand][filler×2]` to the current function's
  `CObArray`. The opcode byte is the v1.x opcode.
- **`FUN_0046b920(state, blockType, name, blockId, flags, arg1, arg2, _)`**
  — writes one block header. First arg after state is the file's
  block-type byte.

**v1.x opcodes observed in parser emissions:**

| Op   | v1.x emission (parser case → call)                                        | v5.x meaning   |
|---|---|---|
| `0x01` | case 100 → `FUN_00470c80(1, …)`                                          | LOAD           |
| `0x02` | (LOAD-by-ref variant)                                                    | PUSHREF        |
| `0x03` | (LOAD inout ref)                                                          | LOADINOUTREF   |
| `0x05` | case 0x50 / 0x53 → `FUN_00470b00(5, 1)`                                  | MOVE           |
| `0x06` | (PUSHR)                                                                   | PUSHR          |
| `0x09` | every ALU-emitting case → `FUN_00470a40(state, 9, aluOp)`                | ALU            |
| `0x0A` | (JMP — used internally)                                                   | JMP            |
| `0x0B` | case 0x50 / 0x53 → `FUN_00470b00(0xb, 0)`                                | JMPNZ          |
| `0x0C` | (CALL)                                                                    | CALL           |
| `0x0F` | (FRAME)                                                                   | FRAME          |
| `0x10` | case 0xee → `FUN_00470bc0(0x10, 0x51, …)`                                | LOGTABLE       |

Not yet observed (may genuinely not exist in v1.x, may just be in
parser cases we didn't trace): `0x04` NOP, `0x07` PUSHREFSTORE,
`0x08` ALLOC, `0x0D` CALLE, `0x0E` RET, `0x11` PUSHIMM.

`TypeMarker 0x51` (INT) appears explicitly in case 0xee
(`FUN_00470bc0(0x10, 0x51, DAT_007a9d48)` and `…0x51, DAT_007a9b08`).
This confirms the marker vocabulary overlaps with v5.x at least for
`0x50–0x53` (the small inline-byte forms). `0x56`/`0x57` (Object,
ULong) are exceedingly unlikely in v1.x because the matching
ValueTypes don't exist.

**v1.x ALU op codes — IDENTICAL to v5.x:**

| Parser case | Emission                       | AluOp | Op    |
|---|---|---|---|
| `0x30`      | `FUN_00470a40(9, 0x60)`        | `0x60`| ADD   |
| `0x31`      | `FUN_00470a40(9, 0x61)`        | `0x61`| SUB   |
| `0x5d`      | `FUN_00470a40(9, 0x62)`        | `0x62`| MUL   |
| `0x5c`      | `FUN_00470a40(9, 0x63)`        | `0x63`| DIV   |
| `0x33`      | `FUN_00470a40(9, 0x64)`        | `0x64`| LT    |
| `0x32`      | `FUN_00470a40(9, 0x65)`        | `0x65`| GT    |
| `0x35`      | `FUN_00470a40(9, 0x66)`        | `0x66`| LE    |
| `0x34`      | `FUN_00470a40(9, 0x67)`        | `0x67`| GE    |
| `0x36`      | `FUN_00470a40(9, 0x68)`        | `0x68`| EQ    |
| `0x37`      | `FUN_00470a40(9, 0x69)`        | `0x69`| NE    |
| `0x39`      | `FUN_00470a40(9, 0x6a)`        | `0x6a`| AND   |
| `0x38`      | `FUN_00470a40(9, 0x6b)`        | `0x6b`| OR    |
| `0x3a`      | `FUN_00470a40(9, 0x6c)`        | `0x6c`| XOR   |
| `0x5e`      | `FUN_00470a40(9, 0x6d)`        | `0x6d`| NEG   |
| `0x5f`      | `FUN_00470a40(9, 0x6e)`        | `0x6e`| NOT   |
| `0x3c`      | `FUN_00470a40(9, 0x6f)`        | `0x6f`| BAND  |
| `0x3b`      | `FUN_00470a40(9, 0x70)`        | `0x70`| BOR   |
| `0x3d`      | `FUN_00470a40(9, 0x71)`        | `0x71`| BXOR  |

**All 18 ALU op codes match v5.x exactly.** Our existing `AluOp` enum
works unchanged for v1.x files.

### v1.x file block types — actually emitted by the parser

The parser emits the same block-type bytes as v5.x. Cases:

- case `0x15` → `FUN_0046b920(0x21, …)` — ScreenFunc
- case `0x16` → `FUN_0046b920(0x22, …)` — **LineFunc** (yes, v1.x has it)
- case `0xa6` → `FUN_0046b920(0x23, …)` — **ControlFunc** (also present)
- case `0xe`  → `FUN_0046b920(0x24, …)` — **MenuItemFunc** (also present)
- case `0x28` → `FUN_0046b920(0x25, …)` — StateFunc
- case `0xed` → `FUN_0046b920(4, …)`    — LogicTable
- case `0xee` → `FUN_0046b920(5, …)`    — Function

So **my earlier claim that v1.x "lacks LineFunc / ControlFunc /
MenuItemFunc" was wrong.** The compile path *does* emit them. What's
true is that NCSEXPERT's own binary *reader* (`FUN_0046bae0`)
doesn't recognise them — its switch only has cases for `0x03`,
`0x04`, `0x05`, `0x11`, `0x12`, `0x21`, `0x25`. Three possible
explanations:

1. The binary reader is intentionally a strict subset — NCSEXPERT
   compiles its full vocabulary to disk but only re-imports the
   simpler blocks (maybe for a partial-reload mode).
2. The binary reader is incomplete and the runtime never actually
   uses it for these blocks (the in-memory IPO is built directly by
   the parser, no read-back needed).
3. Other tools (a separate INPA build, or BMW vehicle programmers)
   consume the richer blocks; NCSEXPERT only round-trips a subset.

For our parser, the practical takeaway: **a v1.x file in the wild
can contain any block type a v5.x file can.** No need to special-case
the block-type vocabulary by version.

## NCSEXPERT v1.x VM dispatcher (2026-05-19)

Identified `CInterpreter::DoInterpret` at **`FUN_0045d830`** — confirmed
by the assertion message `"interpr.cpp","CInterpreter::DoInterpret",0x204`
embedded in the function. Supporting members:

- **`FUN_0045d030`** — ALU sub-dispatcher (analog of INPA's
  `FUN_00460faf`). Switch on AluOp byte `0x60`–`0x71`. Confirmed
  identical opcodes to v5.x.
- **`FUN_0045cdc0`** — TypeMarker → internal-tag mapper (analog of
  INPA's `FUN_00460f29`).
- **`FUN_00461cb0`** — `CDataMan::GetStackData(scope, index)` — scope
  table read (scopes 0/1/2 = global/const/local, same as v5.x).
- **`FUN_00461e70`** — `CDataMan::GetStackData2` — pop two operands
  from the operand stack at `this+0x1c4`.

### Opcode renumbering — v1.x ↔ v5.x

This is the single most important finding for parser/VM design:

| Byte   | v1.x meaning (NCSEXPERT) | v5.x meaning (INPA) | Notes |
|---|---|---|---|
| `0x01` | LOAD                      | LOAD                      | identical |
| `0x02` | PUSHREF                   | PUSHREF                   | identical |
| `0x03` | LOADINOUTREF              | LOADINOUTREF              | identical |
| `0x04` | NOP                       | NOP                       | identical |
| `0x05` | MOVE                      | MOVE                      | identical |
| `0x06` | PUSHR                     | PUSHR                     | identical |
| `0x07` | PUSHREFSTORE              | PUSHREFSTORE              | identical |
| `0x08` | ALLOC                     | ALLOC                     | identical |
| `0x09` | ALU                       | ALU                       | identical |
| `0x0A` | JMP                       | JMP                       | identical |
| `0x0B` | JMPNZ                     | JMPNZ                     | identical |
| `0x0C` | CALL                      | CALL                      | identical |
| **`0x0D`** | **RET**                   | **CALLE**                 | **renumbered** |
| **`0x0E`** | **FRAME**                 | **RET**                   | **renumbered** |
| **`0x0F`** | **CALLE**                 | **FRAME**                 | **renumbered** |
| **`0x10`** | **PUSHIMM**               | **LOGTABLE**              | **renumbered** |
| `0x11`     | *(not in v1.x)*           | PUSHIMM                   | **v5.x-only** |

**v5.x added one new opcode** (LOGTABLE) and **shifted the four
trailing opcodes** by one slot. The first 12 opcodes are bit-for-bit
identical; only the last 5 differ.

The discovery means our disassembler's current rendering of v1.x
files mis-labels every opcode in the `0x0D`–`0x10` range. e.g.
`[0E 00 00 00] RET` in our output is actually `FRAME` in v1.x, and
`[0D 00 00 00] CALLE dll[cabi.h]` is actually `RET` — and the
`dll[cabi.h]` text is meaningless (we were dereferencing
`constants[0]` for every RET).

### TypeMarker semantics: same, but internal tags differ

`FUN_0045cdc0` returns NCSEXPERT's internal type tag for each
marker byte:

| TypeMarker | v1.x meaning | NCSEXPERT internal tag | INPA internal tag (v5.x) |
|---|---|---|---|
| `0x50` | BOOL    | `1` | `1` BOOL |
| `0x51` | INT     | `2` | `3` INT |
| `0x52` | BYTE    | `3` | `2` BYTE |
| `0x53` | LONG    | `4` | `4` LONG |
| `0x54` | REAL    | `6` | `5` REAL |
| `0x55` | STRING  | `5` | `6` STRING |

The marker byte → ValueType **semantics are the same** (0x50 always
means BOOL, 0x55 always means STRING) — but NCSEXPERT and INPA
disagree on the internal numeric tag they assign to each type.
NCSEXPERT also has **no `0x56`/`0x57` markers** (Object/ULong don't
exist in v1.x).

### Runtime type system — v1.x is narrower

The ALU sub-dispatcher (`FUN_0045d030`) only dispatches on tags
**1, 2, 3, 4**:

| ALU tag | v1.x semantic |
|---|---|
| `1` | BOOL — logical AND/OR/XOR/NOT, equality |
| `2` | 32-bit integer — arithmetic, comparisons, bitwise |
| `3` | double — arithmetic, comparisons |
| `4` | string — concat (`+`), equality (`==`/`!=`) |

So **v1.x collapses INT and LONG into a single 32-bit-integer ALU
type** (tag `2`). At storage time the disk-side type byte still
distinguishes them (1 byte BOOL, 2 byte INT-s16, 5 byte LONG-s32),
but at ALU time both are the same code path. v5.x keeps them
separate (BYTE/INT/LONG as ALU tags `2`/`3`/`4`).

### ALU op codes — identical

All 18 AluOps `0x60`–`0x71` (ADD, SUB, MUL, DIV, LT, GT, LE, GE, EQ,
NE, AND, OR, XOR, NEG, NOT, BAND, BOR, BXOR) appear at the same byte
values in v1.x as in v5.x — verified via the cases in `FUN_0045d030`.
**No remap needed for AluOps.**

### Implication for our parser & VM

**We do not need to branch the entire VM.** The semantic operations
(LOAD, PUSHREF, ALLOC, ALU, JMP, CALL, RET, FRAME, CALLE, PUSHIMM)
exist in both versions and behave the same way given the same
operands. The only differences that matter at the bytecode level are:

1. **Four opcode bytes are renumbered.** `0x0D`–`0x10` mean different
   things in v1.x vs v5.x. Trivial to remap at parse time.
2. **TypeMarker internal tags differ in number space**, but since our
   parser canonicalises to v5.x `ValueType` already, this is invisible
   to the VM.
3. **v1.x has no LOGTABLE opcode** — v1.x files just don't contain
   `0x10` in its v5.x-LOGTABLE meaning. After remap, our LOGTABLE
   handler will simply never fire for v1.x files.
4. **v1.x's narrower runtime type space** (no BYTE/ULONG/etc.) is
   already accommodated by our v5.x VM — INT and LONG are separate
   types but ALU works on both.

### Recommended implementation strategy

**Parse-time opcode remap.** When `header.versionHi === 1`:

```
v1.x byte → v5.x byte
0x0D RET     → 0x0E RET
0x0E FRAME   → 0x0F FRAME
0x0F CALLE   → 0x0D CALLE
0x10 PUSHIMM → 0x11 PUSHIMM
```

After remap, the in-memory `Instruction` stream uses v5.x opcode
bytes, and the existing v5.x VM/disassembler/interpreter handle it
unchanged. No version branching required in the VM. This is a
~10-line change in `ipo-parser.ts`.

### What this gives us

For a v1.x parser fix:

1. Constants block — implement the 5-type v1.x table above, dispatched
   on `header.versionHi === 1`.
2. Globals block — read N type bytes (no values), values default at
   load time. We currently already store types-only here, so the only
   fix is the type byte vocabulary.
3. Block-header layout — no change needed, identical to v5.x.
4. Bytecode width — no change needed, identical 4-byte width.
5. Block-type dispatch — be aware that Screen / Menu / LineFunc /
   ControlFunc / MenuItemFunc cannot appear in v1.x files. If we see
   them, the file is corrupt (or actually v5.x mis-tagged).

What we **don't** know yet:

- A few v1.x opcodes (`0x04` NOP, `0x07` PUSHREFSTORE, `0x08` ALLOC,
  `0x0D` CALLE, `0x0E` RET, `0x11` PUSHIMM) — not seen in the parser
  cases we traced, so possibly absent in v1.x. Easy to verify
  empirically by running our parser on a v1.x file and dumping
  opcode histograms.
- `TypeMarker` bytes beyond `0x51` — almost certainly `0x50`–`0x55`
  exist (BOOL/INT/BYTE/LONG/REAL/STRING). `0x56`/`0x57` (Object/ULong)
  are very unlikely since the matching ValueTypes don't exist in v1.x.
