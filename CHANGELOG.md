# Changelog

All notable changes to **inpax** are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com); the project
follows [Semantic Versioning](https://semver.org) loosely — minor version
bumps may carry new features and small breaking changes until 1.0.

## [0.5.0] — 2026-05-19

### Added

- **v1.x IPO format support.** The parser now reads BMW INPA's older v1.x
  binary format alongside v5.x. v1.x files are produced by NCSEXPERT and
  found in `EC-APPS/NCS_EXPER/SGDAT/` on real BMW installs (~3,250 scripts
  across BMW E-series ECUs). Coverage:
  - **Version-aware constants block.** `parseConstantV1()` reads the 5-type
    v1.x vocabulary (`0x01` BOOL / `0x02` INT s16 / `0x03` REAL f64 /
    `0x04` STRING / `0x05` LONG s32) and translates each byte into the
    canonical v5.x `ValueType` enum so disassembler / interpreter /
    dispatcher need no version-aware code paths. Authoritative source:
    `NCSEXPERT.exe!FUN_0046a9a0(kind=1)`. (`@emdzej/inpax-parser`)
  - **Version-aware globals block.** `parseGlobals()` accepts the broader
    v1.x globals vocabulary (`0x00`–`0x06`, including the reserved Void
    slot at index 0 and a `0x06` handle slot for state-machine / screen
    references which maps to `ValueType.ULong`). Authoritative source:
    `NCSEXPERT.exe!FUN_0046a9a0(kind=0)`. (`@emdzej/inpax-parser`)
  - **Parse-time opcode remap.** v5.x renumbered the four trailing
    opcodes when LOGTABLE was inserted at `0x10`, so v1.x bytes
    `0x0D`–`0x10` carry different semantics than the same bytes in v5.x:

    | v1.x byte | v1.x op | v5.x byte (canonical) |
    |---|---|---|
    | `0x0D`    | RET     | `0x0E`                |
    | `0x0E`    | FRAME   | `0x0F`                |
    | `0x0F`    | CALLE   | `0x0D`                |
    | `0x10`    | PUSHIMM | `0x11`                |

    `parseFunction()` remaps these bytes when `header.versionHi === 1`,
    storing the canonical opcode in `Instruction.opcode` while preserving
    the original 32-bit on-disk word in `Instruction.raw`. The first 12
    opcodes (`0x01`–`0x0C`) and all ALU sub-codes (`0x60`–`0x71`) are
    bit-identical between versions and pass through unchanged.
    Authoritative source: NCSEXPERT's `CInterpreter::DoInterpret` at
    `FUN_0045d830`, cross-checked against INPA's `INPA_VM_Interpret` at
    `0x004607d7`. See `docs/ipo-format-versions.md` for the complete
    reverse-engineering trail. (`@emdzej/inpax-parser`)
  - **Disassembler hint for remapped instructions.** When
    `instr.opcode !== (instr.raw & 0xff)` (i.e. the parser remapped a
    v1.x byte into its v5.x slot), the formatter appends a
    `; v1.x op 0x__` trailing comment so a reader cross-checking the
    raw bytes can reconcile them with the displayed mnemonic. Hidden
    when `showComments: false`. (`@emdzej/inpax-dis`)
  - **Real-world coverage**: 1,588 / 1,591 NCSEXPERT v1.x files parse and
    disassemble cleanly. The 3 outliers are non-IPO files mis-extensioned
    `.ipo` (a 2-byte stub, a TSV log, a text source).
- **`@emdzej/inpax-ediabasx-provider`: background-I/O indicator support.**
  The provider now tracks an in-flight counter across `init` / `end` /
  `job` / `fsLesen` / `fsLesen2` and emits a `busy:changed` event on
  every transition. `IEdiabasProvider` gains an `isBusy()` accessor. A
  new component `<EdiabasBusyIndicator />` (in
  `@emdzej/inpax-web-provider`) lights an amber pulse in the canvas
  corner whenever the script is currently talking to the ECU —
  complements the existing green `LiveIndicator` (cyclic-screen signal)
  with a per-call background-processing signal.
  (`@emdzej/inpax-ediabasx-provider`, `@emdzej/inpax-interfaces`,
  `@emdzej/inpax-web-provider`, `@emdzej/inpax-web`,
  `@emdzej/inpax-mock-provider`, `@emdzej/inpax-providers`)
- **`AluOp.XOR` (`0x6C`) handler in the VM.** The enum entry already
  existed; the dispatcher's switch was missing it (would have thrown
  `Unknown ALU op: 0x6c` on any boolean `xor` expression). Now matches
  INPA's `FUN_00460faf` case `0x6c`: `result = Boolean(lhs) !== Boolean(rhs)`,
  result tagged `Bool`, condition register updated.
  (`@emdzej/inpax-interpreter`)

### Changed

- **`ValueType` enum**: `Handle1` / `Handle2` / `Handle3` renamed to
  **`ULong`** / **`Numeric`** / **`Object`** (slots `0x07` / `0x08` /
  `0x09` unchanged — only the symbolic names move). The previous names
  were guesses; the actual INPA-internal names were confirmed via the
  type-name table at `INPA.exe!FUN_0046456b` and the constants reader
  at `FUN_00463bd7`. **Breaking** for any external consumer that
  referenced `ValueType.Handle1`/`Handle2`/`Handle3` directly; in-tree
  callers across parser, interpreter, dispatcher, compiler-core,
  disassembler, mock-provider, and ipo-editor have all been updated.
  (`@emdzej/inpax-core`)
- **`TypeMarker` enum**: `Handle1` / `Handle2` renamed to **`Object`**
  / **`ULong`** (bytecode bytes `0x56` / `0x57` unchanged). Authoritative
  source: `INPA.exe!FUN_00460f29` — the marker→ValueType mapper. The
  rename also fixes a latent bug in `opAlloc` where `0x56` was previously
  mapping to `ValueType.ULong` (should be `ValueType.Object`) and `0x57`
  was mapping to `ValueType.Numeric` (should be `ValueType.ULong`),
  with both initial values set to `null` instead of `0`.
  (`@emdzej/inpax-core`, `@emdzej/inpax-interpreter`)
- **`opAlu` — `AND`/`OR`/`XOR` now update `state.condition`.** INPA's
  `FUN_00460faf` writes `*(this+8) = result` for all three logical
  binary ops, not just the comparison ops. Without this fix, a
  `JMPNZ` after a compound boolean (e.g. `(a == b) && (c == d)`)
  could read a stale condition register from the last comparison
  instead of the AND/OR/XOR result. (`@emdzej/inpax-interpreter`)

### Fixed

- **Disassembler CALLE rendering for v1.x files**: pre-remap, every v1.x
  byte `0x0D` was being labeled `CALLE dll[constants[0]]` (which in
  `A_AKMB46.ipo` happened to evaluate to `"cabi.h"` — bogus). Post-remap,
  these correctly render as `RET ; v1.x op 0xd ; return`. The
  `dll[cabi.h]` text seen across every CALLE in v1.x disassemblies was
  a symptom of the v5.x opcode interpretation mis-firing on a v1.x file.
  (`@emdzej/inpax-dis`)

### Reverse-engineering

The format-versioning work is fully documented in
`docs/ipo-format-versions.md` with anchor addresses and decompiled
behaviour for:
- NCSEXPERT's binary IPO reader (`FUN_0046bae0`), block-header reader
  (`FUN_0046b7b0`), constants/globals reader (`FUN_0046a9a0`), function
  body reader (`FUN_0046ae20`).
- NCSEXPERT's VM dispatcher `CInterpreter::DoInterpret` at
  `FUN_0045d830`, ALU sub-dispatcher `FUN_0045d030`, TypeMarker mapper
  `FUN_0045cdc0`.
- INPA's VM dispatcher `INPA_VM_Interpret` at `0x004607d7`, ALU
  dispatcher `FUN_00460faf`, TypeMarker mapper `FUN_00460f29`, NUMERIC
  coercion path `FUN_0045ffdc` → `FUN_0046014a`.

## [0.4.0] — 2026-05-18

### Added

- **New package `@emdzej/inpax-web-provider`** — Svelte 5 UI provider +
  reusable browser components, extracted from `apps/inpax-web` so future
  apps that embed the INPA runtime in a browser can consume them
  without duplicating the rendering layer. Ships:
  - `WebUIProvider` (concrete `UIProvider` subclass).
  - 9 components: `ScreenCanvas` (canvas-based BEST2 screen renderer,
    ~460 LOC), `FKeyBar` (F1–F10 input bar), `MenuTitleBar`,
    `DialogOverlay`, `UserBoxOverlay`, `ViewerDialog` (backs
    `viewopen`), `ScriptSelectDialog` (host-agnostic via a `loader`
    prop), `LiveIndicator`, `ScrollIndicator`.
  - INPA theme palettes (`classicInpaTheme` + `darkInpaTheme`),
    `paletteColor()` helper, and a `setLibTheme()` / `getLibTheme()`
    Svelte context API so components stay app-agnostic and react to
    the host's light/dark toggle.
  - `BrowserExternalProvider` — the `external` provider that backs
    `viewopen` / `viewclose` with a Svelte-reactive viewer slot.
  - `parseScriptSelect` parser, `loadScriptSelect(cfgdat, filename)`
    `FileSystemDirectoryHandle`-backed loader, and `ScriptSelectNode`
    / `ScriptSelectEntry` types for INPA's `.ENG` / `.GER` / `.CPS`
    scriptselect catalogue files. Hosts with a directory handle wire
    the picker with a one-liner; hosts using OPFS / asset fetch / test
    fixtures still get the `loader` prop on `<ScriptSelectDialog>` for
    custom sources.
  - **INPA install primitives** —
    `discoverInpaInstall(root)` + `isCompleteInstall` +
    `isFileSystemAccessSupported` (walks the canonical
    `EC-APPS/INPA/{CFGDAT,SGDAT}` + `EDIABAS/{Ecu,Bin}` tree
    case-insensitively), `listIpoFiles(dir, origin)` (`.ipo`
    enumerator), `makeBrowserSgbdResolver(ecuDir)` (drop-in for
    Ediabas's `loadSgbdResolver` — handles both initial loads and
    the post-IDENT `.grp → .prg` variant swap).
  - **`BrowserNativeImportProvider`** + `BrowserNativeImportConfig`
    type — concrete `INativeImportProvider` for browser hosts. Wires
    INPA's CALLE imports (kernel32 INI / system / strings, api32
    `__apiGetConfig`, …) to a `FileSystemDirectoryHandle`-backed
    install with up-front INI prefetch for the synchronous CALLE
    dispatcher. (`@emdzej/inpax-web-provider`)
- **Root-level dev scripts.** `pnpm dev:web` runs the inpax-web Vite
  dev server; `pnpm dev:web:host` exposes it on `0.0.0.0` for LAN
  testing; `pnpm build:web` produces the production bundle.

### Changed

- **`apps/inpax-web` consumes `@emdzej/inpax-web-provider`** instead of
  hosting the components inline. `App.svelte` installs the theme
  context once at the root via `setLibTheme(...)` inside an `$effect`
  that tracks the existing `isDarkTheme()` store; `IpoRunner.svelte`
  imports components from the new package and wires the
  `<ScriptSelectDialog>`'s `loader` prop to its existing
  `loadScriptSelect(cfgdat, filename)` adapter. The 9 component files
  + 3 lib modules previously in `apps/inpax-web/src/` are gone — same
  rendering, code lives in the library now. (`@emdzej/inpax-web`)
- **`apps/inpax-web/tsconfig.json`: `verbatimModuleSyntax: false`.**
  Required because the library ships `.svelte.ts` source whose Svelte
  module parser rejects the `type` keyword in import specifiers; the
  consumer's tsc was descending into the package source and forcing
  the keyword. TS still elides type-only imports automatically.
  (`@emdzej/inpax-web`)
- **`apps/inpax-web/vite.config.ts`: removed `@emdzej/inpax-web-provider`
  from `optimizeDeps.include`.** Vite's pre-bundling step uses esbuild
  which doesn't run the Svelte plugin's TS preprocessor, so a `.svelte.ts`
  source file fails to parse at pre-bundle time. Leaving the package
  out of the include list routes it through the main transformation
  pipeline (which does include the plugin). (`@emdzej/inpax-web`)
- **`apps/inpax-web/tailwind.config.ts`: scan the library's source.**
  Tailwind's JIT only emits classes it finds in `content` paths;
  utilities used inside `packages/web-provider/src/**` weren't ending
  up in the CSS bundle, so library components rendered unstyled
  (FKeyBar stacked vertically because `flex` never made it in).
  Added the library's source to the glob. (`@emdzej/inpax-web`)

### Documentation

- **AGENTS.md gains an "Embedding the browser UI in a new app" section**
  covering the `setLibTheme` context API, the `ScriptSelectDialog`
  loader prop, and the `onFrameReady` paint-coalescer contract — the
  three things a downstream consumer needs to wire up. The workspace
  map table also picks up the new package.

## [0.3.3] — 2026-05-15

### Fixed

- **`inpax-interpreter`: setscreen no longer leaves the previous
  screen's labels and result values bleeding through the new
  layout.** `ScreenExecutor.stop()` only set a `running = false` flag;
  the in-flight `executeLinePhase` loop didn't check it between LINE
  blocks, so when a LINE block called `setscreen` the surrounding
  `for` loop happily continued running `line[i+1..N]` against the
  *new* screen's freshly-cleared state. Many LINE blocks await
  internally (INPAapiResult, etc.), giving the new executor's
  setTimeout-scheduled first tick a chance to interleave — the visible
  result was two screens' worth of text overlaid in the same paint.
  The screen executor now checks `this.running` after every block
  boundary (between ALLOC/INIT, after INIT, after each LINE block,
  after each control block, and between phases inside `tick()`), and
  suppresses the `cycle:complete` emit when a mid-cycle swap happened
  so the canvas paint coalescer doesn't snapshot a half-built frame.
  Doesn't yet address the narrower case of a LINE block calling
  `setscreen` and then itself continuing to emit writes after the
  dispatcher returns — that would need cancellation plumbed down into
  `vm.execute`'s instruction loop. In practice `setscreen` is almost
  always the last meaningful op in its containing block, so this
  covers the visible leak. (`@emdzej/inpax-interpreter`)

## [0.3.2] — 2026-05-15

### Fixed

- **`bimmerz-bundler` was silently truncating large bundles.** The zip
  writer's `ondata` handler was firing `fileHandle.appendFile(chunk)`
  with no await, so hundreds of writes raced on the same fd and the
  outer `await writeFd.close()` could run before pending writes flushed.
  Result: a corrupt zip whose central directory referenced offsets that
  no longer matched the data. fflate's importer silently stopped at the
  first bad header — a 1.5 GB INPA bundle round-tripped as ~700 MB with
  no error reported. Replaced the async `FileHandle.appendFile` chain
  with synchronous `openSync` / `writeSync` / `closeSync` on a raw fd so
  fflate's emit loop blocks per chunk and ordering is preserved.
  Verified by round-tripping 100 MB across 50 files byte-perfect.
  **Anyone who ran an earlier `bimmerz-bundle` against a non-trivial
  INPA install should re-bundle with this build — old bundles are
  quietly missing content.** (`@emdzej/bimmerz-bundler`)
- **`inpax-web`: bundle import was masking dropped files.** Two layers
  swallowed failures:
  - `fflate.Unzip`'s per-entry `ondata` callback throws weren't
    propagating out (fflate's internal loop caught them and moved on),
    so a malformed entry was a silent drop.
  - Each per-file OPFS write was queued as a fire-and-forget promise;
    a Windows reserved basename (`CON`, `PRN`, `NUL`, `COM1`–`COM9`,
    `LPT1`–`LPT9`) or illegal char (`< > : " | ? *`) would reject the
    promise, and `Promise.all` aborted the whole batch — so one bad
    name took the rest of the import with it.

  Each write now has its own `.catch()` that records the failure
  without poisoning siblings. The unzip handler records into a
  failures array instead of throwing. The install marker now reflects
  what actually landed in OPFS (write-side counters), not what fflate
  decoded (decode-side counters). `importZipToOpfs` returns a new
  `ImportResult` with `failures: ImportFailure[]`; `ConfigPanel`
  surfaces the list as an expandable amber callout with the common
  causes spelled out. DevTools console gets a structured summary log
  on every import. (`@emdzej/inpax-web`)

### Added

- **`inpax-web`: build version + GitHub link, in two places.** A faint
  `0.3.2` label sits next to the INPAX title in the in-app header, and
  the same version + GitHub link pair appears under the tagline on
  the welcome / source-selection screen so a first-time visitor has
  somewhere to land. The version is sourced from `package.json` via
  Vite's `define` (`__APP_VERSION__` declared in `vite-env.d.ts`) so
  the bundle contains a literal string — no runtime fetch, no bundled
  package.json. Both labels link to the matching
  `releases/tag/{version}` GitHub release. (`@emdzej/inpax-web`)

### Documentation

- **`bimmerz-bundler` README — "Gotcha: re-including from an excluded
  directory".** The intuitive `EDIABAS/` + `!EDIABAS/Ecu` doesn't work
  (and won't in any gitignore-style matcher); documented why, with
  the correct `EDIABAS/*` + `!EDIABAS/Ecu/` form and a multi-level
  drill-down example. Git's own docs cited for the underlying reason.
- **WIP "Resurrecting BMW Diagnostics in the Browser"** Medium-style
  draft committed under `docs/article-medium-draft.md`. Long-form
  origin story; not yet linked from the README.
- **Docs reorganisation:** five `docs/reference/*.md` files moved to
  `docs/guides/developer/inpa/` as part of the wider user-vs-developer
  / INPA-vs-INPAX docs split.

## [0.3.1] — 2026-05-15

### Changed

- **Bumped all `@emdzej/ediabasx-*` deps to `^0.2.1`** (was `^0.1.3`) in
  `@emdzej/inpax-ediabasx-provider`, `@emdzej/inpax-cli`, and
  `@emdzej/inpax-web`. Picks up:
  - the gateway WebSocket transport,
  - the transparent `setCommParameter` / `setAnswerLength` /
    `setRepeatCounter` / `transmitData` forwarding so a remote
    `INITIALISIERUNG` runs cleanly,
  - the browser-safe `@emdzej/ediabasx-interfaces/client` subpath,
  - the 0.2.1 gateway-server fix that makes `ediabasx gateway` actually
    exit on `SIGINT` / `SIGTERM` instead of hanging on the open backend
    cable handle (affects anyone running the gateway as a server in
    front of inpax-web).

### Added

- **Web app: remote gateway over WebSocket.** Communication settings now
  expose two interfaces — `Web Serial (local cable)` and `Remote gateway
  (WebSocket)`. The gateway pane takes a single `ws://` / `wss://` URL,
  shows the matching CLI invocation (`ediabasx gateway --transport
  websocket …`) for copy-paste, and warns on mixed-content (HTTPS page →
  plain `ws://`). Connection lifecycle is unchanged: same Connect /
  Disconnect controls, same `INPAapiInit` script-driven open. (`@emdzej/inpax-web`)

### Removed

- **Web app: simulation and ENET interfaces dropped from the picker.** Both
  needed Node-only APIs to do anything real in a browser. Older
  localStorage entries that still record `interface: "simulation"` or
  `"enet"` coerce back to the default (`webserial`) on load. (`@emdzej/inpax-web`)
- **Web app: `enet.host` / `enet.port` fields removed from the config
  schema.** Settings-export JSON written by older builds keeps those
  fields harmlessly under `config.enet`; new exports omit them.

## [0.3.0] — 2026-05-15

### Added

- **IPO patch system** (`@emdzej/inpax-ipo-editor`) — YAML-based patch
  files for translating or overriding constants in compiled `.IPO`
  scripts. Two new subcommands:
  - `ipo-editor patch init <ipo>` — dump filtered constants into a
    starter patch, with optional per-entry usage notes.
  - `ipo-editor patch apply <ipo> <patch>…` — apply one or more
    patches with SHA-256 verification, type-match enforcement,
    conflict policy (`refuse` | `last-wins`), and `--dry-run`.
  - TUI gets a new `P` keystroke that exports the current edit set
    as `<file>.patch.yaml`, leaving the source IPO untouched.
  - Strong encoding-safety guarantees: characters not representable
    in the patch's `target_encoding` are rejected at apply time
    rather than silently substituted. Non-cp1252 targets trigger
    a loud "stock INPA will misrender" warning.
  - 46 vitest tests cover schema validation, serialization
    round-trips, init filtering, and every apply path.
- **`docs/research/ipo-encoding.md`** — full explanation of why
  stock INPA hard-codes cp1252 and what would be needed to support
  other codepages end-to-end.

### Fixed

- **Screen height default corrected to 30 rows** (was 25) — matches
  the documented INPA model in `docs/reference/ui-system.md`. The
  prior default silently clipped any LINE-block content writing to
  rows 25-29 across all three runtimes (web canvas, TUI, headless CLI).
- **Canvas no longer zooms on theme toggle** — Svelte 5 was
  rewriting the canvas's whole `style` attribute when the reactive
  `background` binding changed, wiping the imperatively-set
  `width`/`height` and leaving the canvas displaying at its native
  backing-pixel resolution (visible as a sudden DPR-multiple zoom).
  Background moved to the wrapping container; a theme-change repaint
  trigger added so any container-side layout shift from Tailwind
  `dark:` variants gets picked up.

### Docs

- PayPal donate button added to the README Support section,
  alongside Buy Me A Coffee and GitHub Sponsors.

## [0.2.0] — 2026-05-14

First public release. Earlier `0.1.0` package versions existed in-tree but
were never published to npm; this changelog consolidates the full project
arc up to this point and treats `0.2.0` as the first version anyone other
than the maintainer should rely on.

### Reverse-engineering & format work

- Mapped INPA's `.IPO` bytecode format — 4-byte fixed-width instructions,
  ~17 opcodes, stack-based VM. Documented opcode semantics, type/scope
  byte conventions, jump and call mechanics.
- Identified and renamed the key INPA.exe functions in Ghidra:
  `INPA_VM_Interpret` (0x004607d7), `INPA_RunBlockPhase` (0x00420745),
  `INPA_RunStatusDispatcher`, `INPA_MainAppStateStep`, `INPA_OnIdleStep`.
- Verified the screen execution model: one OnIdle tick runs the full
  3-phase cycle (INIT → LINE → EXIT), with all LINE blocks executed
  sequentially within the LINE phase. Documented in
  `docs/reference/screen-execution-model.md`.
- Catalogued 158 INPA system functions with signatures and runtime status
  in `docs/system-functions-reference.md`.
- Documented INPA's pagination model for screens whose LINE blocks
  overflow the visible canvas — Win32 `WM_VSCROLL` mechanics, per-block
  step size, top/bottom indicators.

### IPO toolchain

- **Parser** (`@emdzej/inpax-parser`) — reads compiled `.IPO` bytecode
  into a structured AST: globals, constants, functions, screens, menus,
  state machines, F-key handlers.
- **Disassembler** (`@emdzej/inpax-disassembler`) — emits readable
  assembly with comments, jump labels, named system calls, constant
  resolution.
- **Interpreter** (`@emdzej/inpax-interpreter`) — VM + main scheduler +
  screen executor + state-machine executor. Single-stepping VM with
  `cycle:complete` event coalescing for atomic frame painting.
- **Compiler** (`@emdzej/inpax-compiler-core` + `@emdzej/inpax-compiler`
  CLI) — `.IPS` source → `.IPO` bytecode pipeline (lexer / parser /
  semantic / codegen / writer). Batch mode, `--encoding cp1252` for
  legacy sources, `new` subcommand to scaffold a starter script.
- **IPO editor** (`@emdzej/inpax-ipo-editor`) — ink-based TUI for
  editing constants inside compiled `.ipo` files without recompiling.
- **INI parser** (`@emdzej/inpax-ini-parser`) — INPA `.ini` config file
  parser, used to read menu definitions, install metadata, and Windows
  install-side config layered on top of the IPO.

### Runtimes

- **Terminal TUI runtime** (`@emdzej/inpax-tui` + `@emdzej/inpax-cli`) —
  full INPA screen reproduction in an ink-based terminal. Cell grid,
  menus, user-box dialogs, screenshot via copy-to-clipboard, pause/quit.
- **Browser SPA** (`@emdzej/inpax-web`) — same VM in the browser,
  paints onto an HTML canvas, talks to ECUs over Web Serial. PWA —
  installable and offline-capable. Light, dark, and system-following
  themes with reactive canvas palette switching.
- **Provider system** (`@emdzej/inpax-ui-provider-core`,
  `@emdzej/inpax-tui-provider`, `@emdzej/inpax-cli-provider`,
  `@emdzej/inpax-ediabasx-provider`, `@emdzej/inpax-providers`,
  `@emdzej/inpax-mock-provider`) — pluggable surfaces for UI / EDIABAS
  / INP1 / external / simulation / print. Shared `UIProvider` base in
  `ui-provider-core`.

### Web SPA features

- File System Access API for picking an INPA install on disk.
- Bundled-install workflow — import a `bimmerz-bundle.zip` directly
  into OPFS, persist across sessions, "Forget folder" action to clear.
- Chrome `.ini` blocklist workaround — guided rename to `.INIX` with a
  one-line PowerShell command surfaced in the UI.
- Web Serial connection flow — explicit user gesture, persistent
  permission, adapter probe with auto-detect for K+DCAN cable variants.
- Top-bar GitHub icon, theme toggle, "Not connected" badge.
- Tabbed settings panel — debug mode, tick interval, theme, install
  source management, import/export of settings JSON.
- Pinned startup script, collapsible sidebar, IPO sidebar with origin
  grouping and search.
- F-key bar with click + keyboard input, F-key shortcuts gated on focus
  so users can type into form fields without triggering them.
- Menu title bar (`setmenutitle`), screenshot button (canvas → PNG to
  clipboard with download fallback), live indicator (corner pulse on
  cyclic screens), scroll indicator (▲/▼ glyphs + page counter).
- Per-cycle paint coalescing — fixes Battery/Ignition flicker caused
  by per-cell mutation events.
- Graphical overlays — analog-gauge bars with red/green zone backdrops,
  digital LED discs, sized `ftextout` text rendered above the cell grid.

### CLI

- `inpax disasm <ipo>` — disassemble to readable assembly with origin
  metadata.
- `inpax info <ipo>` — header summary, screen / menu / state-machine
  counts, dependencies.
- `inpax run <ipo>` — execute a script with TUI rendering, or
  `--headless` for log-only runs.

### Theme + canvas (recent work)

- Dark canvas theme tracking the app theme. 16-colour INPA palette
  remapped to dark equivalents — structural colours flipped, semantic
  colours lifted into the Tailwind 400–600 ramp for contrast.
- Dedicated `gauge.{invalid, valid, needle, outline}` colour roles so
  analog-gauge contrast is preserved across both themes.
- Fixed canvas zoom-on-theme-toggle bug — moved reactive `background`
  binding from the `<canvas>` element to the wrapping container, and
  added a theme-change repaint trigger so the canvas re-fits when
  no runtime cycle is active.

### Bundler

- New CLI tool **`bimmerz-bundler`** (`apps/bimmerz-bundler`) — walks
  a BMW install, applies a `.bimmerzignore` (gitignore-style) filter,
  emits a compact zip. Shared across inpax and sibling projects.
- `bimmerz-bundle init` to scaffold a template ignore file.
- Positional output argument, verbose / dry-run modes, summary stats.

### Documentation

- Comprehensive `docs/` tree — language reference, opcode reference,
  system-functions reference, IPO file structure, IPS language guide,
  reference execution model, research notes (Chrome `.ini` blocklist,
  per-IPO `.ini` files, screen-line pagination, opcode mapping).
- Reverse-engineering phase reports preserved as historical research.
- Architecture / proposal documents for major flow changes (bundled
  install, etc.).

### Infrastructure

- pnpm workspaces + Turborepo orchestration. `packageManager` pinned
  to pnpm@10.33.1 to match sibling projects.
- Published under PolyForm Noncommercial 1.0.0 — free for personal /
  research / hobby use; commercial use needs a separate licence.
- CI deploys `inpax-web` to <https://inpax.bimmerz.app> on demand.
- Package scope `@emdzej/*` on the public npm registry.

### Known limitations

- ECU coverage is opportunistic — MS43 (engine), RADIO, IKE, LCM are
  exercised regularly; other SGBDs in the install are likely to work
  but unverified.
- The `setcolor(C_WHITE, C_BLACK)` "inverted highlight note" pattern
  renders dark-on-light in dark theme. No script in the wild has been
  observed to use it, but the corner case is documented.
- Web Serial is main-thread only (browser API limitation) — DS2 traffic
  shares an event loop with the UI. Fine for current workloads; could
  become a ceiling at much higher protocol rates.
- ENET / DoIP support exists in `ediabasx` and is wired through to
  inpax, but coverage on F-chassis (gateway-translated) modules is
  thinner than on E-chassis direct-K-bus modules.

[0.3.0]: https://github.com/emdzej/inpax/releases/tag/v0.3.0
[0.2.0]: https://github.com/emdzej/inpax/releases/tag/v0.2.0
