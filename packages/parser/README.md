# @emdzej/inpax-parser

Binary IPO file parser for BMW INPA / NCSEXPERT bytecode. Reads both
the modern **v5.x** format (INPA) and the older **v1.x** format
(NCSEXPERT) into a single canonical in-memory representation.

## Installation

```bash
npm install @emdzej/inpax-parser @emdzej/inpax-core
```

## Usage

```typescript
import { IpoParser } from '@emdzej/inpax-parser';
import { readFileSync } from 'fs';

const bytes = new Uint8Array(readFileSync('script.ipo'));
const ipo = new IpoParser(bytes).parse();

console.log(`Version ${ipo.header.versionHi}.${ipo.header.versionLo}`);
console.log(`Functions: ${ipo.functions.size}`);
console.log(`Constants: ${ipo.constants.values.length}`);

for (const [id, fn] of ipo.functions) {
  console.log(`  fn[${id}] ${fn.header.name} — ${fn.instructions.length} instructions`);
}
```

The result is an `IpoFile` (from `@emdzej/inpax-core/types`) with
`header`, `globals`, `constants`, and `Map`s of functions, screens,
menus, and state machines indexed by block ID.

## v5.x vs v1.x — what gets normalised

The parser canonicalises both formats into v5.x's wider vocabulary so
downstream consumers (interpreter, dispatcher, disassembler) do not
need version-aware code paths.

**Value type bytes** — v1.x's 5-type table (`0x01` BOOL / `0x02` INT
(s16) / `0x03` REAL / `0x04` STRING / `0x05` LONG) is translated into
v5.x's `ValueType` enum at parse time. Constants and globals both go
through their respective NCSEXPERT-derived maps. v1.x globals also
accept `0x00` Void (reserved slot 0) and `0x06` (handle → `ULong`).

**Opcode bytes** — v5.x inserted a new `LOGTABLE` opcode at `0x10`,
which shifted the four trailing opcodes by one slot:

| v1.x byte | v1.x op | v5.x byte (canonical) |
|---|---|---|
| `0x0D`    | RET     | `0x0E`                |
| `0x0E`    | FRAME   | `0x0F`                |
| `0x0F`    | CALLE   | `0x0D`                |
| `0x10`    | PUSHIMM | `0x11`                |

When `header.versionHi === 1`, the parser remaps these four opcode
bytes. The first 12 opcodes (`0x01`–`0x0C`) and all ALU sub-codes
(`0x60`–`0x71`) are identical between versions and pass through
unchanged.

**`Instruction.raw` preserves the original 32-bit on-disk word**, so
tooling that needs to render the file faithfully (e.g. a "show me
what's actually in the bytes" disassembler view) can do so. Only
`Instruction.opcode` carries the canonical-v5.x byte.

See [`docs/ipo-format-versions.md`](../../docs/ipo-format-versions.md)
in the repository for the complete reverse-engineering notes —
authoritative anchors include NCSEXPERT's `CInterpreter::DoInterpret`
at `FUN_0045d830` and INPA's `INPA_VM_Interpret` at `0x004607d7`.

## File structure

Both v1.x and v5.x share the same outer layout:

```
┌──────────────────────────┐
│ version_hi, version_lo   │  2 bytes
├──────────────────────────┤
│ "TEST-Infotext\n"        │  magic + LF
├──────────────────────────┤
│ Block 1                  │  see below
│ Block 2                  │
│ …                        │
└──────────────────────────┘
```

Each block carries a header:

```
type        u8                    block-type byte
name        \n-terminated string  for tooling / debug
blockId     u16 LE                referenced by CALL etc.
flags       u16 LE
arg1        \n-terminated string
arg2        \n-terminated string
marker      u8                    0 or 1
size        u16 LE                element count (instructions / consts)
…body…
```

The body interpretation depends on `type`: globals (`0x11`) store
type bytes only; constants (`0x12`) store `(type, value)` pairs;
function-style blocks (`0x05`, `0x21`–`0x25`, `0x03`) store
`size` × 4-byte instructions.

## API surface

- `IpoParser` — the parser class. Constructor accepts `Uint8Array` or
  `ArrayBufferLike`. Call `.parse()` to get the `IpoFile`.
- All result types (`IpoFile`, `IpoHeader`, `BlockHeader`,
  `GlobalsBlock`, `ConstantsBlock`, `FunctionBlock`, `ScreenBlock`,
  `Instruction`, `StackEntry`, `ValueType`, `BlockType`) come from
  `@emdzej/inpax-core`.

## Errors

The parser throws on:
- Bad magic (`"TEST-Infotext"` not present after the version bytes)
- Unknown v1.x constant type byte outside `0x01`–`0x05`
- Unknown v1.x global type byte outside `0x00`–`0x06`

Unrecognised block-type bytes are skipped (advancing by the
header-declared `size`) rather than thrown — INPA / NCSEXPERT both
emit blocks the other can't read, so strict rejection would be
overly fragile.

## License

MIT
