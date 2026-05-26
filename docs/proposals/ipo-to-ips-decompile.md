# `inpax decompile --ips` — bytecode → IPS source

> **Status: implemented in 0.8.0** as `@emdzej/inpax-decompiler` +
> the `--ips` flag on `inpax decompile`. This document is kept for
> the prior-art relationship and the catalogue of recognised vs.
> unrecognised patterns.

The `decompile` CLI emits ASM-style listings of an IPO's bytecode
(LOAD / CALL / JMPZ / etc., with labels resolved) by default. The
`--ips` switch emits **readable IPS source** instead — function
definitions, syscall calls in IPS syntax, structured `if/else` +
`while` from the codegen-emitted templates.

The point is to make decompiled IPOs a starting point for editing +
recompiling: feed the `--ips` output back through `inpax compile` and
get an equivalent IPO. The roundtrip is **not** byte-identical
(constant ordering, original variable names, integer radix all lost
in compilation), but is intended to be **semantically equivalent for
code paths the codegen knows**.

## Prior art / pattern source

The 0.8.0 implementation backports the recognised-pattern catalogue
+ structural reconstruction approach from
[`qt-inpa-runtime`](https://github.com/mjaskols/qt-inpa-runtime) by
permission of the author. That project's `src/ipo_dumper.cpp`
(~1,750 lines C++) was the reference for:

- **CFG analysis**: backward-JMP-after-JMPZ for `while` recovery,
  forward-JMPZ-with-tail-JMP for `if/else`, fallback to `goto` +
  labels for irreducible flow.
- **Expression-tree reconstruction** from the stack-machine
  instruction sequence (LOAD/PUSHIMM/PUSHREF/ALU → operator-form
  expression strings).
- **Function-call collapsing**: `FRAME + arg pushes + CALL/CALLE` →
  `funcName(args);`.
- **Argument-count inference**: scan every user-function call site,
  count the arg pushes that precede it, name the first N locals
  `p_NN`.
- **Three-tier output**: raw assembly (existing `--ips`-less mode),
  decompile = resolved names (qt-inpa-runtime's `--decompile`,
  not ported), source = structured IPS-like (our `--ips`).

qt-inpa-runtime's own docs (`docs/ipo-format-and-decompiler.md`) are
a useful supplementary reference for the pattern catalogue.

## What's recovered

- Function definitions with inferred `(p_NN, p_NN, ...)` parameter
  lists.
- Function calls (system + user + CALLE imports) with args
  reconstructed from the FRAME-and-pushes pattern.
- Variable assignments — simple `target = value;` and computed
  `target = lhs op rhs;` shapes.
- Structured `if` / `if else` blocks (forward JMPZ with matching
  tail JMP, or bare JMPZ skipping a block).
- Structured `while` loops (backward JMP after a JMPZ-out).
- `return;` for RET.
- Globals declared with their `ValueType` (`int g_03;`, etc.).
- Screen / menu / state-machine block structure preserved.

## What's NOT recovered

- **Original variable / parameter / global names.** The IPO format
  doesn't preserve them. Emitted as `g_XX`, `l_XX`, `p_XX`.
- **Integer literal radix.** Always rendered in hex (`0x0005`),
  matching the bytecode encoding.
- **`for`, `switch`, `do/while`.** The IPS compiler lowers these
  to `while` + branches before encoding; recovery only sees the
  lowered form.
- **Unusual flow shapes** that don't fit a single-entry/single-exit
  structured block — `goto L_XXXX;` with explicit labels.

## What it looks like

Sample from a real `00swt*.ipo`-family function:

```text
TestApiFehler()
{
    scriptchange(l_04, "JOB_STATUS", 0x0001, "");
    if (l_04 != "OKAY")
    {
        setstate(l_03, l_03, ": ");
        setstate(l_03, l_03, l_04);
        infobox(l_00, g_3E, l_01, l_02, l_03);
        PEMInitialisiere(l_00);
        setitem();
    }
  L_0022:
    return;
}
```

Recompiling this through `@emdzej/inpax-compiler` is intended to
produce semantically equivalent bytecode (not byte-identical —
constant table order, instruction-stream addressing of dropped
labels, etc. differ).

---

The original proposal text is preserved below for archaeology.

## Why bother

- **Reverse-engineering aid.** Reading BMW's shipped IPOs as IPS
  source instead of ALU/LOAD soup means we can spot what an
  unfamiliar handler actually does in minutes instead of grinding
  through stack pushes.
- **Modification workflow.** Today an IPO that's "almost right"
  can't easily be tweaked — you'd have to hand-edit bytes or write a
  patch tool. With `--ips` → edit → `inpax compile`, the source ↔
  binary loop closes.
- **Validation oracle.** Decompiling our own roundtrip-test IPS
  fixtures, recompiling them, and diffing the bytecode is a strong
  smoke test that the lifter understands what the codegen emitted.
- **NCS Expert / INPA archaeology.** A lot of what we've reverse-
  engineered via Ghidra (NCSEXPER) and hex-grep (per-IPO string
  searches in `ncsx`) becomes "just read the source" once we can
  decompile to IPS.

## What we already have

| Piece | Location | Status |
|---|---|---|
| IPO parser → typed `Instruction` stream + `FunctionDef` + constants + globals | `@emdzej/inpax-parser` | ✅ |
| Disassembler formatter (Instructions → asm text) | `@emdzej/inpax-dis` — `packages/disassembler/src/format/formatter.ts` (538 lines) | ✅ |
| IPS AST node types (`FunctionDecl`, `IfStmt`, `WhileStmt`, `ForStmt`, `BinaryExpr`, `CallExpr`, `AssignExpr`, …) | `packages/compiler-core/src/ast/nodes.ts` | ✅ |
| Codegen (AST → Instructions) | `packages/compiler-core/src/codegen/codegen.ts` (818 lines) | ✅ |
| IPS source parser (text → AST) | `packages/compiler-core/src/parser/parser.ts` (858 lines) | ✅ |
| Semantic / symbol resolution | `packages/compiler-core/src/semantic/` | ✅ |
| Roundtrip tests (IPS → bytecode → run) | `packages/compiler-core/src/__tests__/roundtrip.test.ts` | ✅ |

The asymmetry: every direction except **bytecode → AST** is wired. We
have the target shape (the AST) and we have the deterministic
patterns the codegen emits — reversing them is mechanical but not
free.

## What's missing

| Piece | Why | Rough cost |
|---|---|---|
| **CFG builder** over instructions, using already-resolved labels | Needed before lifter can pattern-match on control-flow shapes | ~100 lines |
| **Lifter** (Instructions → AST) | Reverses codegen's templates: FRAME-LOAD*-CALL → `CallExpr`; LOAD-LOAD-ALU-MOVE-JMPZ → `IfStmt`; loop-back JMP → `WhileStmt`/`ForStmt`; etc. | ~400-600 lines |
| **AST pretty-printer** (AST → IPS text) | Tree walk over `ast/nodes.ts` shapes, IPS-syntax aware (`PROC`/`SCREEN`/`MENU` blocks, `;` terminators, indentation) | ~200 lines |
| **CLI wiring** — `--ips` switch + format dispatch on `inpax decompile` | One option flag in `apps/cli/src/commands/decompile.ts`, branch to the new emitter | ~30 lines |
| Tests: a few hand-written `.ipo` ↔ `.ips` roundtrip fixtures + the existing roundtrip suite re-run through `--ips` | Pins lifter behaviour against real codegen output | ~150 lines fixtures |

Total: roughly **900-1100 lines** plus tests. Doable in one focused
session, but worth phasing so the linear-only output ships first and
proves itself before the control-flow recovery layer.

## Phased plan

### Phase 1 — linear lifter (the "Recommended start")

Lifts everything *except* control flow. Output looks like IPS source
with labels and `goto` for branches:

```ips
PROC Cod(string id_jobname)
{
    setjobstatus(0);
    setstate(state, ", Cod");
    PEMProtokollAusgabe(text1, text2);
    TestCDHFehler(text2);
    // ... linear sequence ...

  label_50:
    if (id_jobname == "SG_CODIEREN") goto label_60;   // synth from JMPZ
    PEMPrintFormular("CHECKSUM", retval);
    goto label_146;
  label_60:
    // ... else branch ...
}
```

Already useful for reading. Compiles back through the IPS parser if
the parser tolerates `goto`/`label:` (check first; may need a small
parser-side extension).

Scope:
- Walk instructions per function
- Maintain a **virtual stack** of `Expression` nodes as we visit
  LOAD / PUSHREF / ALU
- On CALL: pop N expressions per arg, emit `CallExpr`
- On MOVE / PUSHREFSTORE: emit `AssignExpr`
- On JMPZ / JMP to labels: emit synthetic `goto label_NNN;` and
  `label_NNN:` markers
- Wrap each function in `PROC` / `SCREEN` / `MENU` framing using the
  function-type info from the parsed IPO

### Phase 2 — control-flow recovery

Replace `goto`/`label:` with proper `IfStmt` / `WhileStmt` / `ForStmt`
/ `ReturnStmt` by matching the codegen-emitted templates:

| Template | Recovers to |
|---|---|
| `... ALU OP ; MOVE 0,1 ; JMPZ @L1 ; <body> ; (L1:)` | `if (cond) { body }` |
| `... ; JMPZ @L1 ; <body> ; JMP @L2 ; L1: <else> ; L2:` | `if (cond) { body } else { else }` |
| `Lstart: ... JMPZ @Lend ; <body> ; JMP @Lstart ; Lend:` | `while (cond) { body }` |
| `Lstart: <init> ... JMPZ @Lend ; <body> ; <incr> ; JMP @Lstart ; Lend:` | `for (init; cond; incr) { body }` |
| `... RET` | `return;` / `return expr;` |

The patterns are exactly what `codegen.ts` emits — line-up via the
file itself (e.g. `IfStmt` codegen at the `if` case in codegen.ts
becomes the canonical "shape to look for"). Anything not matching a
template stays as `goto` / `label:` from phase 1.

Scope:
- Build basic blocks from the instruction stream
- Pattern-match each block against the templates above
- Replace matched blocks with the corresponding AST node
- Leave unmatched blocks as labelled goto-form

### Phase 3 — polish (optional)

- Recover local-variable names from the constant pool (some are
  emitted as string constants near their declaration)
- Resolve `local[N]` indices back to declared names where the
  function signature gives us hints
- Inline obvious `MOVE 0, 1` results into the next use to reduce
  visual noise

## CLI shape

One switch on the existing `decompile` command:

```bash
# Current (asm output to stdout)
inpax decompile A_LSZ.ipo

# Proposed (IPS source output)
inpax decompile --ips A_LSZ.ipo
inpax decompile --ips -o A_LSZ.ips A_LSZ.ipo

# Per-function still works
inpax decompile --ips -f Cod A_LSZ.ipo
```

Implementation: `apps/cli/src/commands/decompile.ts` adds an `--ips`
flag. When set, the `disassembleIpo` / `disassembleFunction` call is
replaced with a new `lift+print` pair from a new
`@emdzej/inpax-decompiler` package (or the existing
`@emdzej/inpax-dis` package gains a parallel `decompileToIps`
export).

Package placement decision: probably **a new package**
(`packages/decompiler/`) so the lifter doesn't have to share a
release cadence with the disassembler — they're related but
independent concerns. The CLI depends on both.

## Acceptance criteria

Phase 1 ships when:
- Every IPO under `~/Downloads/inpa/NCSEXPER/SGDAT/` decompiles to
  IPS without throwing
- A representative subset (KMB, LSZ, GM5 — the three we care about
  most) is hand-reviewed and recognisably IPS-shaped
- The compiler-core roundtrip fixtures (`__tests__/roundtrip.test.ts`)
  decompile to IPS that re-parses through the IPS parser without
  errors (compilation back to equivalent bytecode is a phase-2/3 goal)

Phase 2 ships when:
- At least 60% of the basic blocks in our roundtrip fixtures match
  one of the if/while/for templates (measure: count of `goto`s
  remaining vs total branches)
- Hand-reviewed output of three real BMW IPOs reads as recognisable
  IPS source (judgment call — no automated metric beats a human
  reading the file)

## References

- Current disassembler entry point: `apps/cli/src/commands/decompile.ts`
- Codegen patterns to reverse (the canonical "what bytecode does
  `if`/`while`/`for` produce"): `packages/compiler-core/src/codegen/codegen.ts`
- AST shapes (the lifter's target): `packages/compiler-core/src/ast/nodes.ts`
- Roundtrip fixtures (validation oracle): `packages/compiler-core/src/__tests__/roundtrip.test.ts`
- Opcode reference: `docs/opcode-reference.md`
- Existing companion tool that already walks IPO without the
  bytecode layer: `apps/ipo-editor/` (constants-only edit; would
  share the parser dependency with this work)
