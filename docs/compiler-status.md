# INPA Compiler — Status

Snapshot for resuming work later. Last touched after stages 2a–2g + B1 + B2.

## Where the code lives

| Layer | Path |
|---|---|
| Library | `packages/compiler-core/` |
| CLI | `apps/inpax-compiler/` (commander; `inpax-compiler <file.ips> -I <dir> -o <file.ipo>`) |
| Tests | `packages/compiler-core/src/__tests__/{roundtrip,runtime}.test.ts` + `packages/compiler-core/__tests__/fixtures/*.ips` |
| Verifier | reuses workspace `@emdzej/inpax-parser` + `@emdzej/inpax-dis` + `@emdzej/inpax-interpreter` (devDeps only) |

Pipeline: `preprocess → tokenize → parse → analyze → codegen → writeIpo`.

## Run / verify

```bash
pnpm --filter @emdzej/inpax-compiler-core build
pnpm --filter @emdzej/inpax-compiler build
pnpm exec vitest run packages/compiler-core    # 28 tests, all green

# single file
pnpm compile -I ~/Downloads/inpa/EC-APPS/INPA/SGDAT \
  ~/Downloads/inpa/EC-APPS/INPA/CFGDAT/startus.ips -o /tmp/startus.ipo

# batch — variadic <files...>, -o <dir>, --continue past failures
pnpm compile -I path/a,path/b -I path/c -o /tmp/out --continue \
  scripts/*.ips
```

Real-world smoke: `startus.ips` (BMW Rectification entry point) compiles to a 12 786-byte IPO that parses and disassembles cleanly (19 functions, 67 globals, 593 constants, 2 screens, 1 menu, 5 import descriptors).

### CLI surface (`apps/inpax-compiler/`)

| Flag | Meaning |
|---|---|
| `<files...>` | One or more `.ips` files (variadic) |
| `-o <path>` | Single input: output `.ipo` path. Batch: output directory. Mis-specifying as a file in batch mode is rejected with exit 2. |
| `-I <dir>` | `#include` search path — **repeatable** AND **comma-separated** (`-I a,b -I c`). Empty segments dropped. |
| `-e, --encoding <name>` | Source-file encoding for both the entry `.ips` and any `#include`d files. Default `cp1252` (every BMW German script we've seen). Accepts cp1250/cp1251/cp1254/latin1/utf-8/etc. via iconv-lite canonicalisation. |
| `--continue` | Keep compiling after a file fails (batch mode). Final exit non-zero if any failed. |
| `-v / --verbose` | Per-file lines + summary even with a single input. |

Per-file lines + summary always printed in batch mode. Case-insensitive sibling fallback in the preprocessor catches `#include "BMW_STD.H"` against an on-disk `bmw_std.h` (covered by a real-FS regression test).

## What works

- **Header / block layout** (`05 00 TEST-Infotext 0A`, then user funcs → menus → screens → state machines → inpainit/exit/startup/shutdown → Global Data → Constant Data). Order verified against `disasm/startus.txt`.
- **Function IDs:** 0=startup, 1=shutdown, 2=inpainit, 3=inpaexit, 4+=user funcs (incl. logic-table lookup functions) in source order.
- **Globals:** slot 0 reserved void, user globals 1+. **Initialisers emit `LOAD CONST / PUSHR GLOBAL / MOVE` triples at the head of `__inpa_startup__`** (matches INPACOMP — see `disasm/startus.txt:1972+`).
- **Locals:** params + declared locals share index space. Non-param locals get an `ALLOC <typeMarker>` prologue per function.
- **Expressions:** literals, identifiers (locals / globals / handles), binary `+ - * / < <= > >= == != && || ^^ & | ^`, unary `- !`, simple `x = expr` assignment.
- **Control flow:** `if/else`, `while`. Predicate emits `<cond>; MOVE 0,1; JMPNZ <target>` — `MOVE` copies the bool into the VM's condition register; jump targets are absolute instruction indices (not byte offsets).
- **User calls:** `FRAME; args; CALL_USER 0x80 id`. `in:` = value, `out:`/`inout:` = `PUSHREF` (0x02), with callee reading via `LOADINOUTREF` (0x03) and writing via `PUSHREFSTORE` (0x07). System calls: `CALL 0x81 sysId`.
- **External calls (CALLE):** descriptor `DLL::Func:<conv>.<paramchars><return>` in a constant; `CALLE 01 <descIdx>`. Encoding rules verified against ABGAS.IPO / docs.
- **UI blocks:** `SCREEN` (0x01) → `ScreenFunc` (0x21) → `LineFunc` (0x22) [+ `ControlFunc` (0x23)]. `MENU` (0x02) → `MenuItemFunc` (0x24, key in flags, label in arg1). Handle refs use scope codes `0x40` (Screen) / `0x41` (Menu) / `0x42` (StateMachine).
- **STATEMACHINE:** type-0x03 + per-state type-0x25. Layout matched against `ABGAS.IPO` / `ASE_SAVE.IPO`.
- **LOGTABLE:** type-0x05 `lt_<name>` lookup function (`PUSHIMM INT <inBits>; PUSHIMM INT <outBits>; LOGTABLE 0x44 0; RET`) + type-0x04 ` LT_<name>` data block (space-prefixed, 3×u32 per entry). Matched byte-for-byte against `EHC_2.IPO`'s `handst` table.
- **#include:** resolver walks current-dir then `-I` paths, case-insensitive sibling fallback (for `BMW_STD.H` vs `bmw_std.h`), cycle detection, virtual-FS hook for tests.

## Cross-validation log (compiler vs reality)

| Question | Source consulted | Outcome |
|---|---|---|
| Block emit order | `disasm/startus.txt` block addresses | Confirmed: user funcs → menus → screens → init/exit/startup/shutdown → globals → constants. |
| Constant dedup? | `disasm/mj-alu.txt` (duplicate `1`s) | No dedup; each literal occurrence creates a new entry. |
| JMP target encoding | `packages/interpreter/src/vm/interpreter.ts` `opJmp` | Absolute instruction index, not byte offset. |
| JMPNZ semantics | interpreter `opJmpNZ` | Jumps when `state.condition === 0` (i.e. when the predicate was false); reads condition register, not stack. |
| `MOVE 0,1` purpose | interpreter `opMove` | Copies bool TOS into condition register, then pops `op2` items. |
| ALLOC needed for locals? | interpreter `opPushR` reads `frameOffset+idx` | Yes — `PUSHR` writes to a stack slot, so each non-param local needs an ALLOC prologue. |
| inout read encoding | `disasm/mj-concat.txt:21` (`03 02 00 00 ; LOADINOUTREF`) | Single opcode 0x03. **Interpreter had a bug** — was pushing ref-to-ref; fixed in `packages/interpreter/src/vm/interpreter.ts` `opLoadInOutRef`. |
| Caller convention case | ABGAS.IPO descriptors | `import` → uppercase (`P`/`C`/`S`); `import32` → lowercase. |
| `structure` encoding in descriptors | `user::wvsprintf:P.Sstl%I` | Always two chars `tl`, regardless of direction. |
| Global init code location | `disasm/startus.txt:1973+` (`__inpa_startup__` prologue) | INPACOMP emits init triples in startup before `FRAME; CALL_USER inpainit`. We match. |
| LOGTABLE function name | `disasm/ipo-file-structure.md` + EHC_2.IPO | Function uses source LOGTABLE name verbatim; data block uses ` LT_<name>` (leading space). |
| LOGTABLE `0x44` magic | EHC_2.IPO + docs example | Constant `0x44` on op1; meaning unconfirmed; emit verbatim. |
| Grammar contents (rejected features) | Ghidra string scan of INPACOMP | No `for_construct`, no `return_statement` for user funcs, no `MOD`/`INCR`/`DECR` tokens, no subscript rule. Confirmed rules: `if_construct`, `while_construct`, `assignment`, `func_call`, `binary`, `function_definition`, `g_data_definition`, `l_data_definition`(s), `menu_definition`, `screen_definition`, `statemachine_definition`, `logictable_definition`, `ext_function_declaration`, `statement_statements`, `if_expression`. |

## What's NOT in INPA (deliberately rejected by parser)

| Feature | Rejection message |
|---|---|
| `for` loops | `'for' loops are not part of the INPA language — use 'while' instead` |
| `++` / `--` (prefix and postfix) | `'++' is not part of the INPA language` (or `'--'`) |
| `%` modulo | `modulo '%' is not part of the INPA language` |
| `return <expr>;` | `INPA does not support 'return <value>;' — use an out: parameter instead` |
| `arr[i]` postfix | `array indexing 'expr[i]' is not part of the INPA language` |

(`return;` without a value is still accepted — `RETURN` token exists in the grammar.)

## Open questions / unknowns

- **LOGTABLE `0x44` magic** — same in every sample, meaning TBD. Could be flag bits or a fixed marker.
- **State handle for `setstate(state_name)`** — `Scope.StateMachine` (0x42) is documented but no `Scope.State` exists. Real BMW scripts barely use `setstate`; haven't traced a concrete sample yet. Currently any reference to a state name will fail to resolve in `emitIdent` → `unknown identifier`.
- **`string[N]` runtime semantics** — declared length isn't surfaced into bytecode (no special block / ALLOC variant observed). Probably a no-op metadata, but unverified.
- **Real-INPACOMP descriptor characters for `bool`/`byte`/`real`** — my encoding (`B`/`b`, `Y`/`y`, `R`/`r`) is *guessed*; only `s/S`, `i/I`, `l/L`, and structure (`tl`) appear in real `.ipo` samples I've seen.
- **Global initializer ordering with cross-refs** — currently we emit in source order. A later global referencing an earlier one works; a forward reference would compile but evaluate against the default. Real INPACOMP may topo-sort; unverified.

## Known runtime issues (interpreter, not compiler)

These come from the interpreter and are visible when running our compiled IPOs:

- **`screen-executor.test.ts` has 8 failing tests (pre-existing, unrelated to our work)** — they call `this.vm.getGlobals()` / `getConstants()` which don't exist on `VM`. Not introduced by anything we did; just noise on full test runs.
- **`LOGTABLE` (0x10) is a stub** in `opLogTable` (`packages/interpreter/src/vm/interpreter.ts`) — logs a warning and pushes 0. Our compiler emits the table correctly but it won't lookup at runtime until the interpreter implements it.

## Files modified outside `packages/compiler-core/`

Only **one** interpreter touch — `packages/interpreter/src/vm/interpreter.ts` `opLoadInOutRef`, fixing the inout-arg ref-to-ref bug. Inline comment in the source explains.

## What to consider doing next

Two candidates:

1. **A — boot `startus.ipo` on the interpreter.** Forcing function. Will surface 5–10 real runtime divergences fast. Best ROI.
2. **More language polish:**
   - **State handle `setstate`** wiring (likely needs a new `Scope.State` and per-SM state index lookup).
   - **Verify `string[N]` runtime semantics** by compiling + running a fixture that exercises buffer-length-dependent code (`GetPrivateProfileString` write target).
   - **Bool / byte / real CALLE descriptor chars** — find a real `.ipo` that uses them and validate against the encoder.

## Companion app: ipo-editor

A separate TUI at `apps/ipo-editor/` lets you edit constants in compiled `.ipo` files (translation use case — change German strings to other languages without recompiling). Built on `ink` + `commander` + `iconv-lite`; depends on `@emdzej/inpax-parser` for the walk.

Key features:
- Codepage-aware decode/encode (`--codepage cp1252` default; cp1250/1251/etc. for other locales)
- Per-type edit dialogs (string with live cp-mapping check, bool radio, int/byte/long with range + hex preview, real with sci-notation)
- Byte-preserving save: only the Constant Data block's payload is re-emitted; every other block byte stays identical. `.bak` created by default; `--no-backup` to skip.
- FFI-descriptor strings auto-locked unless `--allow-ffi` (heuristic: contains `::`, `:<letter>.`, `%`)
- `--readonly` for view-only mode

```bash
pnpm editor ~/Downloads/inpa/EC-APPS/NFS/SGDAT/ABGAS.IPO
pnpm editor --codepage cp1250 path/to/file.ipo
```

End-to-end save path verified against a real BMW file (`ABGAS.IPO`): length-changing string edit + int edit round-trip cleanly, all prefix bytes byte-identical to source, `.bak` matches source.

## Repo entry points (for next time)

- Compiler library: `packages/compiler-core/src/index.ts` (the `compile(source, options)` export)
- Compiler CLI: `apps/inpax-compiler/src/index.ts`
- Editor TUI: `apps/ipo-editor/src/index.tsx`, `apps/ipo-editor/src/components/`
- Codegen: `packages/compiler-core/src/codegen/codegen.ts`
- Writer: `packages/compiler-core/src/writer/writer.ts`
- Semantic / symbols: `packages/compiler-core/src/semantic/symbol-table.ts`
- Preprocessor: `packages/compiler-core/src/preprocessor/preprocessor.ts`
- Tests: `packages/compiler-core/src/__tests__/`
- Fixtures: `packages/compiler-core/__tests__/fixtures/`
- Format spec we cross-reference: `docs/ipo-file-structure.md`, `docs/opcode-reference.md`
- Reference disasms (canonical bytecode patterns): `disasm/*.txt`
- Real `.ipo` samples used for grounding: `~/Downloads/inpa/EC-APPS/NFS/SGDAT/*.ipo` (ABGAS.IPO, EHC_2.IPO, ASE_SAVE.IPO especially)
- Real `.ips` source: `~/Downloads/inpa/EC-APPS/INPA/CFGDAT/startus.ips`, `~/Downloads/inpa/EC-APPS/INPA/SGDAT/*.h`
- INPACOMP decompile: `ref/INPACOMP.exe.c` (88 925 lines, function names stripped — navigate by strings)
- INPACOMP via Ghidra MCP: tool prefix `mcp__ghidra__*` (list_functions, list_strings, decompile_function_by_address, etc.)
