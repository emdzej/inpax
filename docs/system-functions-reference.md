# BEST2 system functions — reference & implementation status

Companion to [`system-functions.md`](./guides/developer/inpa/system-functions.md) (which
covers the **call mechanism** — opcode 0x0C dispatch, FRAME / RET
discipline, the IFH table layout from `FUN_004607d7` /
`FUN_0041fc3f`). This file is the **per-function reference**: what
each system function is documented to do, how original INPA
implements it where we know, and where in inpax that work currently
lives.

The canonical enum + signatures are in
[`packages/core/src/types/system-functions.ts`](../packages/core/src/types/system-functions.ts).
The full list is 158 functions across IDs `0x00`–`0xA1`.

## Status legend

| Symbol | Meaning |
| --- | --- |
| ✅ | Implemented to the extent the bytecode we run needs; matches INPA semantics. |
| 🟡 | Partial — the common path works, but edge cases (specific flags, multi-value variants) are simplified. |
| 🔌 | Routed to a provider (`IUiProvider` / `IEdiabasProvider` / `IPemProvider` / `IDtmProvider` / `IExternalProvider` / `ISpsProvider`); behaviour depends on the host injection. |
| 🚧 | Registered as a stub — pops args (or lets `popFrame` drop them), no side effect. Scripts that depend on real behaviour may misbehave. |
| ❌ | Not registered. Hitting one of these throws / logs "internal function not implemented" and the script proceeds with undefined output values. |

## Provider layout

Most behaviour-heavy functions are not implemented in-tree; they're
delegated through a small interface surface so the same dispatcher
can drive a Web Serial cable, a CLI mock, or a unit test.

| Provider | Interface package | Implementations |
| --- | --- | --- |
| UI | `@emdzej/inpax-interfaces` (`IUIProvider`) | `WebUIProvider` (canvas), `TuiProvider` (ink), `CliProvider` (stdio), `NullUIProvider`, `MockUIProvider` |
| EDIABAS | `IEdiabasProvider` | `EdiabasXProvider` (production, talks to `@emdzej/ediabasx-ediabas`), `NullEdiabasProvider` |
| INP1 | `IInp1Provider` | `Inp1Adapter` (thin wrapper over EDIABAS), `NullInp1Provider` |
| Simulation (sim*) | `ISimulationProvider` | `NullSimulationProvider` |
| Print (`printscreen` / `printfile`) | `IPrintProvider` | `NullPrintProvider` |
| PEM (label printing) | `IPemProvider` | `NullPemProvider` |
| DTM (variable tracking) | `IDtmProvider` | `NullDtmProvider` |
| External (`viewopen`, `winhelp`, `callwin`) | `IExternalProvider` | `BrowserExternalProvider`, `NullExternalProvider` |
| SPS (PLC) | `ISpsProvider` | `NullSpsProvider` |
| Native imports (CALLE) | `INativeImportProvider` | `BrowserNativeImportProvider`, CLI equivalent |

## Coverage matrix

One row per registered system function, in ID order. **Status** is
"as currently wired in inpax". **Where** points at the file that
owns the behaviour.

| ID | Name | Status | Where | Notes |
| --- | --- | --- | --- | --- |
| 0x00 | `setmenutitle` | 🔌 | dispatcher → `ui.setMenuTitle` | Top strip above F-key bar. |
| 0x01 | `setmenu` | 🔌 + ✅ | dispatcher → `ui.setMenu` ; interpreter handles VM-side activation | Both notify the UI and run the menu's init bytecode via `setTimeout(0)` (avoids corrupting `state.currentBlock` mid-execute — see `interpreter.ts`). |
| 0x02 | `setitem` | 🔌 | dispatcher → `ui.setItem` | F-key binding. |
| 0x03 | `settitle` | 🔌 | dispatcher → `ui.setTitle` | Window title. |
| 0x04 | `setscreen` | 🔌 + ✅ | interpreter (creates `ScreenExecutor`) + dispatcher → `ui.setScreen` | The interpreter's `setscreen` is the single canonical site; the dispatcher case is unreachable in practice because `internal-functions.ts:setscreen` runs first. See [`screen-line-pagination.md`](./research/screen-line-pagination.md). |
| 0x05 | `setstatemachine` | ✅ | interpreter (`StateMachineExecutor`) | Push prior SM if nested, set initial state. |
| 0x06 | `setstate` | ✅ | interpreter | Calls on-exit / on-enter blocks. |
| 0x07 | `callstatemachine` | ✅ | interpreter | Nested SM call. |
| 0x08 | `returnstatemachine` | ✅ | interpreter | Pop SM stack. |
| 0x09 | `settimer` | ✅ | interpreter (timer slots 0–15) | Tied to the active `ScreenExecutor`'s timer bank when one is running, otherwise falls back to an interpreter-wide map. |
| 0x0A | `testtimer` | ✅ | interpreter | Reads from the same source `settimer` wrote to. |
| 0x0B | `setjobstatus` | 🚧 | interpreter stub | INPA's `setjobstatus` reports a numeric status to the launcher (mirroring `_apiState`). No launcher to report to → no-op. |
| 0x0C | `exit` | ✅ | interpreter → `ui.emit('script:exit')` | Host clears `app.selectedIpo`; tears down runtime. Matches INPA's "unload script" intent rather than full process exit. |
| 0x0D | `exitwindows` | ✅ | aliased to `exit` | Real INPA called `ExitWindowsEx`. We treat it as "unload script" — terminating the browser tab would be hostile. |
| 0x0E | `scriptselect` | ✅ | interpreter | Fire-and-forget; host shows picker, script-switch event swaps the IPO. See doc in `internal-functions.ts:scriptselect`. |
| 0x0F | `scriptchange` | 🚧 | interpreter stub | Direct IPO swap by path. Rare in BMW scripts. |
| 0x10–0x14 | `select` / `deselect` / `control` / `start` / `stop` | 🚧 | interpreter stub | INPA's job/measurement control verbs (used by external launchers). No public launcher API yet. |
| 0x15 | `getapistring` | ✅ | interpreter | Returns "" (no-launcher case). See the function's own comment in `internal-functions.ts` for the full Ghidra-derived rationale. |
| 0x16 | `togglelist` | 🚧 | interpreter stub | Counterpart to `getapistring` for toggle-list launches. |
| 0x17 | `printscreen` | 🔌 | dispatcher → `print.printScreen` | Null provider: no-op. |
| 0x18 | `printfile` | 🔌 | dispatcher → `print.printFile` | Null provider: returns error code. |
| 0x1A | `setcolor` | 🔌 | dispatcher → `ui.setColor` | INPA palette indices (`1=Black`, `0=White`, …); see `apps/inpax-web/src/lib/theme.ts`. |
| 0x1B | `delay` | ✅ | interpreter | `await new Promise(setTimeout)`; matches `Sleep(ms)`. |
| 0x1C | `getdate` | ✅ | interpreter | Locale-formatted; matches `GetLocalTime` formatting. |
| 0x1D | `gettime` | ✅ | interpreter | Same. |
| 0x1E | `realtostring` | ✅ | interpreter | Uses BEST2's C-style format spec via `formatMany` in `@emdzej/inpax-core`. |
| 0x1F | `stringtoreal` | ✅ | interpreter | `parseFloat`, defaults to 0 on bad input (matches INPA). |
| 0x20 | `inttostring` | ✅ | interpreter | Decimal, no padding. |
| 0x21 | `stringtoint` | ✅ | interpreter | `parseInt(value, 10)`, defaults 0. |
| 0x22 | `hexconvert` | ✅ | interpreter | Splits a hex string into seg/low/mid/high bytes. |
| 0x23 | `strcat` | ✅ | interpreter | Simple concat. |
| 0x24 | `strlen` | ✅ | interpreter | `string.length`. |
| 0x25 | `midstr` | ✅ | interpreter | `String.prototype.substr` — INPA returns "" if `start ≥ length`. |
| 0x26 | `realtoint` | ✅ | interpreter | Truncation, not round (matches INPA's `(int)x` C cast). |
| 0x27 | `inttoreal` | ✅ | interpreter | Trivial widen. |
| 0x28 | `bytetoint` | ✅ | interpreter | Sign-extend disabled — INPA treats bytes as unsigned. |
| 0x29 | `inttolong` | ✅ | interpreter | Trivial widen. |
| 0x2A | `longtoreal` | ✅ | interpreter | Trivial widen. |
| 0x2B–0x3D | `PEM*` (label printer family) | 🔌 | dispatcher → `pem.*` | `NullPemProvider` returns `true` for every call. INPA scripts use these only when feeding label printers (BMW's old PEM workflow); browser/CLI have no printer wiring. |
| 0x3E | `getinputstate` | 🔌 | dispatcher → `ui.getInputState` | Returns 0=idle, 1=open. |
| 0x3F–0x47 | `inputtext` / `inputnum` / `inputhex` / `inputdigital` / `input2*` | 🔌 | dispatcher → `ui.inputXxx` | All return promises the dispatcher awaits; web app shows `DialogOverlay`. |
| 0x48 | `text` | 🔌 | dispatcher → `ui.text` | Plain string at `(row, col)` with current colours. |
| 0x49 | `textout` | 🔌 | dispatcher → `ui.textOut` | Same with reordered args. |
| 0x4A | `ftextout` | 🔌 | dispatcher → `ui.fTextOut` | INPA signature is `(text, row, col, fontsize, fontattr)` — **no colour params**. The dispatcher reads `getCurrentColors()` because the previous code accidentally consumed `fontsize`/`fontattr` as fg/bg. |
| 0x4B | `digitalout` | 🔌 | dispatcher → `ui.digitalOut` | LED indicator. Web canvas renders a real disc; TUI a `●`/`○` glyph. |
| 0x4C | `analogout` | 🔌 | dispatcher → `ui.analogOut` | Web canvas renders a gauge bar; TUI text only. |
| 0x4D | `multianalogout` | 🟡 | dispatcher → `ui.multiAnalogOut` | Signature per `ref/Inpa.h:201` is `(val, row, col, min, max, minValid, maxValid, format, mode)` — same as `analogout` plus a trailing `mode` int. Implementation pushes an `AnalogValue` with `mode` set; canvas renders identically to a plain gauge for now (no BMW script in our test set exercises a non-zero mode, so the mode's behavioural semantics are unknown). |
| 0x4E | `hexdump` | 🔌 | dispatcher → `ui.hexDump` | Hex byte sequence. |
| 0x4F | `ftextclear` | 🔌 | dispatcher → `ui.fTextClear` | Same shape as `ftextout`; clears the rendered area. |
| 0x50 | `clearrect` | 🔌 | dispatcher → `ui.clearRect` | Used by the screen executor to wipe LINE content area on a scroll. |
| 0x51 | `blankscreen` | 🔌 | dispatcher → `ui.blankScreen` | Wipes the whole canvas. |
| 0x52 | `messagebox` | 🔌 | dispatcher → `ui.messageBox` | Modal; OK only. |
| 0x53 | `infobox` | 🔌 | dispatcher → `ui.infoBox` | Same as messagebox here. INPA has subtler styling. |
| 0x54–0x58 | `userbox*` | 🔌 | dispatcher → `ui.userBox*` | Persistent named overlays. Web app renders via `UserBoxOverlay.svelte`. |
| 0x59 | `winhelp` | 🔌 | dispatcher → `external.winHelp` | INPA calls `WinHelpA`. Null provider: no-op. |
| 0x5A | `winhelpkey` | 🔌 | dispatcher → `external.winHelpKey` | Same, with a key. |
| 0x5B | `callwin` | 🔌 | dispatcher → `external.callWin` | INPA spawned an external program via `WinExec`. No browser equivalent; null/log only. |
| 0x5C | `viewopen` | 🔌 | dispatcher → `external.viewOpen` | Browser provider reads a virtual file (the dispatcher writes the formatted FsLesen report into it first via `external.writeFile`) and the host renders `ViewerDialog.svelte`. |
| 0x5D | `viewclose` | 🔌 | dispatcher → `external.viewClose` | Closes the modal. |
| 0x5E | `simnum` | 🔌 | dispatcher → `simulation.simNum` | Test-only path. Null provider returns its min. |
| 0x5F | `simdigital` | 🔌 | dispatcher → `simulation.simDigital` | Same shape. |
| 0x60 | `INPAapiInit` | 🔌 | dispatcher → `ediabas.init` | Opens the EDIABAS provider's connection. Dispatcher wraps it in a retry/continue loop using `ui.ensureConnected()` + `ui.confirmConnectError()`. |
| 0x61 | `INPAapiEnd` | 🔌 | dispatcher → `ediabas.end` | Disconnect. |
| 0x62 | `INPAapiJob` | 🔌 | dispatcher → `ediabas.executeJob` | The workhorse. Runs SGBD jobs, stores result sets for subsequent `INPAapiResult*` calls. |
| 0x63 | `INPAapiResultText` | 🔌 | dispatcher → `ediabas.resultText` | With format spec (`%.2f`, `%X`, etc.). |
| 0x64 | `INPAapiResultInt` | 🔌 | dispatcher → `ediabas.resultInt` | |
| 0x65 | `INPAapiResultSets` | 🔌 | dispatcher → `ediabas.resultSets` | Returns the number of result sets (e.g. fault entries from `FS_LESEN`). |
| 0x66 | `INPAapiResultDigital` | 🔌 | dispatcher → `ediabas.resultDigital` | |
| 0x67 | `INPAapiResultAnalog` | 🔌 | dispatcher → `ediabas.resultAnalog` | |
| 0x68 | `INPAapiResultBinary` | 🔌 | dispatcher → `ediabas.resultBinary` | Returns bytes via `GetBinaryDataString`. |
| 0x69 | `INPAapiCheckJobStatus` | 🔌 | dispatcher → `ediabas.checkJobStatus` | Truth check against the job's status string (typically `"OKAY"`). |
| 0x6A | `INPAapiFsLesen2` | 🔌 + ✅ | dispatcher | Runs `FS_LESEN_DETAIL`, formats per the INPA fault-report template (see `packages/dispatcher/src/format-fs.ts`), writes to `external` as `na_fs.tmp`. |
| 0x6B | `INPAapiFsLesen` | 🔌 + ✅ | dispatcher | Same with simpler formatting. |
| 0x6C | `INPAapiFsMode` | 🔌 | dispatcher → `ediabas.fsMode` | Toggle between detail and summary formats. |
| 0x6D | `INP1apiInit` | 🔌 | dispatcher → `inp1.init` | INP1 is INPA's older API surface; `Inp1Adapter` routes everything to the underlying `IEdiabasProvider`. |
| 0x6E | `INP1apiEnd` | 🔌 | dispatcher → `inp1.end` | |
| 0x6F | `INP1apiJob` | 🔌 | dispatcher → `inp1.executeJob` | |
| 0x70 | `INP1apiState` | 🔌 | dispatcher → `inp1.state` | |
| 0x71 | `INP1apiResultText` | 🔌 | dispatcher → `inp1.resultText` | |
| 0x72 | `INP1apiResultInt` | 🔌 | dispatcher → `inp1.resultInt` | |
| 0x73 | `INP1apiResultSets` | 🔌 | dispatcher → `inp1.resultSets` | |
| 0x74 | `INP1apiResultReal` | 🔌 | dispatcher → `inp1.resultReal` | |
| 0x75 | `INP1apiResultBinary` | 🔌 | dispatcher → `inp1.resultBinary` | |
| 0x76 | `INP1apiErrorCode` | 🔌 | dispatcher → `inp1.errorCode` | |
| 0x77 | `INP1apiErrorText` | 🔌 | dispatcher → `inp1.errorText` | |
| 0x78 | `GetBinaryDataString` | ✅ | interpreter | Reads the most recent binary result the dispatcher stashed. |
| 0x79 | `fileopen` | ✅ | interpreter | Opens an OPFS file in `r` / `w` / `a` mode. CLI uses `node:fs`. |
| 0x7A | `fileclose` | ✅ | interpreter | |
| 0x7B | `filewrite` | ✅ | interpreter | Append text. |
| 0x7C | `fileread` | ✅ | interpreter | Line-by-line; sets EOF flag. |
| 0x7D–0x8B | `DTM*` family | 🔌 | dispatcher → `dtm.*` | Variable tracking + setup persistence. Null provider returns reasonable empties; INPA used these for the "Steuern" / "Adaption" workflows. |
| 0x8C–0x91 | `StrArray*` | 🚧 | interpreter stub | INPA string-array helpers (sparse-keyed string storage). No real BMW script in our test set exercises these. |
| 0x92 | `SPSInit` | 🔌 | dispatcher → `sps.init` | PLC connection. Null provider: no-op. |
| 0x93 | `SPSEnd` | 🔌 | dispatcher → `sps.end` | |
| 0x94 | `SPSLeseVonSPS` | 🔌 | dispatcher → `sps.leseVonSps` | Read from PLC. |
| 0x95 | `SPSSendeAnSPS` | 🔌 | dispatcher → `sps.sendeAnSps` | Write to PLC. |
| 0x96 | `SPSLeseVakWerte` | 🔌 | dispatcher → `sps.leseVakWerte` | Production-line vacuum readings; legacy BMW. |
| 0x97 | `ApiJobFsLesenFAB` | ❌ | not registered | "FAB" = Fertigungsablauf (production sequencing). Used in factory programs; no BMW INPA on our radar. |
| 0x98 | `ApiResultFsLesenFAB` | ❌ | not registered | Same family. |
| 0x99 | `ELDIOpenStartDialog` | ❌ | not registered | ELDI is a BMW dealer-only tool. Out of scope. |
| 0x9A–0x9F | `CreateStructure` / `SetStructureMode` / `Structure{Byte,Int,Long,String}` | 🚧 | interpreter stub | INPA's binary-struct helper for raw memory access. No BMW scripts in our set use it. |
| 0xA1 | `setitemrepeat` | 🔌 | dispatcher → `ui.setItemRepeat` | F-key repeat enable / disable. |

## How the deeper-impact functions are wired

This section zooms in on the functions that aren't a simple
provider hop — usually because they need cross-system coordination or
because we deviate from INPA's behaviour for browser reasons.

### `setscreen` (0x04)

INPA's Windows runtime: when `setscreen(handle, cyclic)` runs, the
SCREEN block's allocFunc runs once (variable allocation), then INPA
enters its main paint loop driven by `WM_TIMER` ticks. Each tick
runs the SCREEN's initFunc (per-cycle data fetch) followed by every
LINE block. Pagination is implemented in INPA via `WM_VSCROLL` —
see [`research/screen-line-pagination.md`](./research/screen-line-pagination.md).

inpax: `interpreter/src/runtime/internal-functions.ts:setscreen`
calls `vm.setScreen(handle, cyclic)` which builds a
`ScreenExecutor` and `start()`s it. `start()` is the single canonical
call site for `ui.setScreen()` + `ui.setTotalLines()`. The async
chain looks like:

```
internal-functions.ts setscreen
└─ vm.setScreen
   └─ new ScreenExecutor(...)
   └─ executor.start()
      ├─ ui.setScreen(handle, cyclic)
      ├─ ui.setTotalLines(N)
      └─ scheduleNextTick()
         └─ executeInitPhase → executeLinePhase → ... → handleCycleComplete (cyclic restart)
```

The dispatcher's `setscreen` case (in `dispatcher.ts:343`) is
effectively unreachable — `internal-functions.ts` registers the
handler in `INTERNAL_HANDLED` so the dispatcher short-circuits to
the internal path first.

### `setmenu` (0x01)

Tricky because the menu's init block (F-key text + bindings) is set
*after* the setscreen the menu lives inside has already started its
LINE-block loop. If we ran the menu's init synchronously, we'd
corrupt `state.currentBlock` / `state.ip` of the surrounding
`__inpa_startup__` execute loop. So `vm.setMenu` defers the menu
init via `setTimeout(0)` and runs it on a fresh task.

### `INPAapiInit` / `INPAapiJob` / `INPAapiResult*`

Three concerns the dispatcher handles for these:

1. **Connection lifecycle.** `INPAapiInit` is the *script's* hint
   that it needs the cable open. The dispatcher first awaits
   `ui.ensureConnected()` (in browser: shows the Connect modal;
   user clicks → Web Serial port pick → returns transport via
   `getTransport`); only then calls `ediabas.init()`. On failure
   loops via `ui.confirmConnectError()` with retry/continue/stop.
2. **VARIANTE swap.** A user-explicit `IDENTIFIKATION` job must not
   trigger the auto-IDENT chain — the `Ediabas` instance has a
   first-class flag for that path.
3. **Result-set caching.** `executeJob` returns multiple sets; the
   dispatcher stashes them on a per-handle state object that
   `INPAapiResult*` reads from. `INPAapiResultSets` returns the
   length.

### `INPAapiFsLesen` / `INPAapiFsLesen2` (0x6A / 0x6B)

These don't just run the job — they format the result set into the
canonical INPA fault-report template (`packages/dispatcher/src/format-fs.ts`)
and write it via `external.writeFile("na_fs.tmp", text)`. The
script's `viewopen("na_fs.tmp", title)` that follows reads that
virtual file back and displays it in `ViewerDialog.svelte`.

### `getapistring` (0x15)

See the function's own comment block in
[`internal-functions.ts`](../packages/interpreter/src/runtime/internal-functions.ts).
TL;DR: INPA has its own API surface mirroring EDIABAS (`__apiInit@4`
etc., visible in INPA.exe's imports per Ghidra). External programs
can launch INPA with an arg string; the script reads it back via
`getapistring`. With no launcher (browser / standalone CLI), we
resolve to `""`, which all standard BMW scripts handle gracefully —
their `INPAapiJob(..., args="", ...)` paths return the unfiltered
result set.

### `exit` (0x0C) / `exitwindows` (0x0D)

Both emit `script:exit` on the UI provider. The host
(`apps/inpax-web/src/components/IpoRunner.svelte`) listens, clears
`app.selectedIpo` → the lifecycle `$effect` disposes the runtime →
the canvas unmounts → user lands back on the welcome screen. The
real INPA's `exitwindows` would have called `ExitWindowsEx`; we treat
both as "unload script" because terminating the tab would be hostile
on the web.

### `viewopen` (0x5C) — the "INI" trick on the FS side

Browser `external` provider exposes a tiny virtual filesystem keyed
on the script-provided filename (`na_fs.tmp`, etc.). The dispatcher
writes into it during `INPAapiFsLesen*`, and `viewopen` reads it
back into the `ViewerDialog` modal. No real disk file is involved —
the file picker is never opened. This is also why the browser
"open" doesn't hit Chrome's File System Access blocklist (see
[`research/chrome-ini-blocklist.md`](./research/chrome-ini-blocklist.md)).

## Stubs by impact

Listed by likely impact on running BMW scripts — most BMW scripts
don't hit these; the ones that do typically degrade gracefully.

### High impact (rare but visible)

- **`StrArrayCreate` family (0x8C–0x91)** — if a script uses string
  arrays for, say, accumulating a measurement history, the array
  reads will all miss and the script will think there's no data.
  None of our test scripts (MS43, RUSTSCHUTZ, etc.) hit these.

### Medium impact (degraded data)

- **`setjobstatus`** — INPA scripts use this to report progress to
  the launcher. No launcher → no observer. Safe to skip.
- **`select` / `deselect` / `control` / `start` / `stop`** —
  measurement-mode verbs. Without a launcher subscribing, nobody
  hears them. Some scripts gate measurement loops on a `control`
  return value, but most don't.
- **`scriptchange`** — direct IPO swap by filename. Unlike
  `scriptselect`, no UI is involved. Rare; mostly seen in
  factory / dealer scripts.

### Low impact (would be needed for specialty UIs)

- **`togglelist`** — toggle-mode launcher arg, mirror of
  `getapistring`.
- **`PEM*`** — only relevant when feeding a BMW label printer.
- **`SPS*`** — only relevant on a factory floor with a PLC.
- **`DTM*` (advanced)** — `Setup*` family is for the
  variable-persistence UI in INPA's adapter tools. Standard
  diagnostics don't touch it.

## Open / unknown

- **`ApiJobFsLesenFAB` (0x97) / `ApiResultFsLesenFAB` (0x98)** —
  not registered. "FAB" suggests Fertigungsablauf (production
  sequencing). If we ever see a script invoke it, will need a
  signature confirmation pass against decompiled INPA.
- **`ELDIOpenStartDialog` (0x99)** — not registered. ELDI is a
  separate BMW tool's start dialog. Out of scope for inpax.
- **The "internal" tagging in `dispatcher.ts INTERNAL_HANDLED`**
  duplicates a subset of `internal-functions.ts` registrations —
  worth collapsing into a single source of truth in a future
  refactor.

## Where to look next

- [`docs/system-functions.md`](./system-functions.md) — opcode 0x0C
  dispatch internals, function-table layout from Ghidra.
- [`docs/inpa-language-reference.md`](./inpa-language-reference.md)
  — BEST2 language surface (types, control flow, FRAME / RET).
- [`docs/vm-functions.md`](./vm-functions.md) — VM-side
  implementation patterns shared across handlers.
- [`docs/interfaces/README.md`](./interfaces/README.md) — the
  original Windows IFH DLLs (`OBD32`, `XEnet32`, …) decompiled.
- [`packages/interpreter/src/runtime/internal-functions.ts`](../packages/interpreter/src/runtime/internal-functions.ts)
  — handler implementations + per-function commentary, especially
  for `setscreen` / `setmenu` / `scriptselect` / `getapistring`.
- [`packages/dispatcher/src/dispatcher.ts`](../packages/dispatcher/src/dispatcher.ts)
  — the dispatcher cases + their routing to providers.
