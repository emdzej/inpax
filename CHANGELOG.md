# Changelog

All notable changes to **inpax** are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com); the project
follows [Semantic Versioning](https://semver.org) loosely — minor version
bumps may carry new features and small breaking changes until 1.0.

## [0.10.0] — 2026-05-29

Pulls in [ediabasx 0.5.0](https://github.com/emdzej/ediabasx/releases/tag/0.5.0)
— the FTDI / J2534 / Gateway sweep. No inpax-side code changes; the
behavioural improvements come from the upgraded transports.

### Changed

- **`@emdzej/ediabasx-*` deps bumped `^0.4.0` → `^0.5.0`** across
  `inpax-ediabasx-provider`, `inpax-cli`, and `inpax-web`. Pulls in:
  - **FTDI USB-side latency timer auto-tuning** on `interface-serial` —
    K+DCAN cables now drop from 16 ms to 1 ms latency on connect via OS-
    specific paths (Linux sysfs, macOS via the new
    `@emdzej/ediabasx-mac-ftdi-latency` native addon, Windows hint).
    Slow K-line ECUs (cluster, IKE) negotiate cleanly instead of timing
    out the inter-byte window.
  - **Gateway default transport flipped TCP → WebSocket** — Node 22+
    clients and browsers speak the same dialect now. `inpax-web`
    through Gateway works without specifying `transport: "websocket"`
    explicitly.
  - **Gateway forwards the previously-missing methods**:
    `transmitFrequent` / `receiveFrequent` / `stopFrequent` (closes the
    `xfrequent` silent-no-op gap), `getIgnitionStatus` /
    `getAdapterType` / `getAdapterVersion`, plus `getInterfaceType` /
    `getInterfaceVersion` (the `xtype` / `xvers` ones — eagerly
    prefetched into sync cached fields at `connect()`).
  - **`UTILITY.PRG INTERFACE` now returns the right `TYP` / `VERSION`**
    across every transport. Match BMW's OBD32.dll reference (`"OBD"` /
    `0xD1` = 209) on K+DCAN, J2534 (deliberately masquerading), and
    through the gateway. ENET reports `"ENET"` / `1`.
  - **J2534 safety blacklist now lives in `@emdzej/j2534-driver` 0.3.0**
    — sending the previously-bricking SET_CONFIG params (P1_MIN /
    P2_MIN / P2_MAX / P3_MAX / P4_MAX) silently drops them, mirroring
    Tactrix's `op20pt32.dll` behaviour. Stops a class of OpenPort 2.0
    persistent-config corruption regressions.
- **`@emdzej/j2534-*` peer deps bumped to `^0.3.0`** in `inpax-web`.

### Notes

- ediabasx's `@emdzej/ediabasx-mac-ftdi-latency` is an
  `optionalDependency` of `interface-serial` with `"os": ["darwin"]`,
  so non-mac inpax installs skip the gyp build. macOS users get the
  N-API addon compiled on `pnpm install`, requires Xcode CLT.
- **macOS users must explicitly approve the native build.** pnpm ≥ 10
  ignores dependency `install` / `postinstall` scripts by default for
  supply-chain safety. After `pnpm install` you'll see:
  ```
  ╭ Warning ─────────────────────────────────────────────────────────╮
  │   Ignored build scripts: @emdzej/ediabasx-mac-ftdi-latency@…     │
  │   Run "pnpm approve-builds" to pick which dependencies should    │
  │   be allowed to run scripts.                                     │
  ╰──────────────────────────────────────────────────────────────────╯
  ```
  Run `pnpm approve-builds`, select `@emdzej/ediabasx-mac-ftdi-latency`
  (and any other build scripts you trust), then `pnpm rebuild` to
  compile the `.node` binary. Without this, the macOS FTDI latency
  path silently degrades to the gateway-recommendation hint — slow
  K-line ECUs over a local K+DCAN cable will keep hitting the 16 ms
  latency wall until the addon is built. Linux/Windows installs are
  unaffected (no native addon to build).
- Lockstep bump across all 19 inpax packages 0.9.0 → 0.10.0. No
  user-facing API changes; this is a transport-layer upgrade.

## [0.9.0] — 2026-05-28

Pulls in the ediabasx 0.4.0 release: SAE J2534 transport via Tactrix
OpenPort 2.0, the new shared UI components, and the slow-K-line-ECU
fix. Web app moves to the shared `@emdzej/bimmerz-theme` palette and
deduplicates its interface-config UI against the rest of the bimmerz
family.

### Added

- **SAE J2534 transport in the web app** — pick "J2534 (OpenPort 2.0)"
  in Settings to drive a Tactrix OpenPort 2.0 over Web Serial. Same
  cluster / IKE / body-module reads that previously only worked over
  K+DCAN now work over OpenPort thanks to the host-side `ParRegenTime`
  enforcement in `@emdzej/ediabasx-interface-j2534`.
- **Shared UI components from `@emdzej/ediabasx-web-ui`** — the
  interface configuration panel and the Connect/Disconnect pill come
  from the shared package now. Adding a new transport upstream (e.g.
  another J2534 device family) shows up in inpax-web automatically.

### Changed

- **`apps/cli` now uses `@emdzej/ediabasx-host-config`** for loading
  `~/.config/ediabasx/config.json`. Same file, same XDG search order;
  the schema + parser are now shared with the ediabasx CLI. Removes
  ~50 lines of duplicated `EdiabasxCliConfig` / `readEdiabasxCliConfig`.
- **Web app adopts `@emdzej/bimmerz-theme`.** Tailwind preset +
  shared `tokens.css` replace the local `:root` / `.dark` block.
  Class names unchanged (`bg-surface`, `text-muted`, …) so component
  code is untouched. Subtle hue shift from inpax's historical
  zinc neutrals to bimmerz's slate-tinted palette — kept consistent
  with the rest of the family.
- **All `@emdzej/ediabasx-*` deps bumped to `^0.4.0`** in cli, web,
  and ediabasx-provider.

### Fixed

- **`packages/interpreter`: unused `Scope` import** that was breaking
  CI lint.

## [0.8.1] — 2026-05-27

### Fixed

- **VM: cross-frame `Scope.Local` reference writes now target the
  correct stack slot.** When a callee wrote back through a ref the
  caller had passed (the canonical `out:` / `inout:` parameter
  pattern), `PUSHREFSTORE` / `CALLE` / `LOADINOUTREF` /
  `SignatureHandler` were resolving the destination via
  `setVariable(Local, callerLocalIndex)` — which adds the **callee's**
  `frameOffset` on top, landing in the wrong stack slot or throwing
  `Stack index out of bounds`. Surfaces against BMW's NFS
  `SG_PROGRAMMIEREN` IPO (`TestApiFehlerNoExit` helper crashed at
  `pc=2` with `Stack index out of bounds: 30`).

  Fix: `ExecutionContext.createRef` now frame-pins `Scope.Local` refs
  by storing the **absolute** stack index in `refInfo.index` at PUSHREF
  time. New `getByRef` / `setByRef` helpers bypass frame-relative
  arithmetic; `setOutParam` and the affected interpreter call sites
  use them. Other scopes (`Global`, `Const`, UI handles) are
  unaffected — their `refInfo.index` is still the logical store index.

  Plain `LOAD` / `STORE` of locals (frame-relative, no ref) is
  unchanged. One existing test (`updates local references with a
  non-zero frame offset`) was documenting the old broken behaviour
  and is updated to use `setByRef`; a new `writes through a Local
  ref across a frame boundary` test exercises the cross-frame path.

## [0.8.0] — 2026-05-26

### Added

- **`@emdzej/inpax-decompiler` package + `inpax decompile --ips` flag.**
  Reconstructs IPS-like source from compiled `.IPO` bytecode.
  Recognises function calls, simple/computed assignments, expression
  trees with operator precedence, structured `if` / `if else`, and
  `while` loops. Irreducible flow falls back to `goto L_XXXX;` + labels.
  Default mode of `decompile` (ASM output) is unchanged — new
  behaviour is opt-in via `--ips`.

  ```
  inpax decompile --ips path/to/script.ipo
  ```

  Patterns + scaffolding ported with permission from
  [`qt-inpa-runtime`](https://github.com/mjaskols/qt-inpa-runtime)'s
  `src/ipo_dumper.cpp`. Recompiling the output through
  `@emdzej/inpax-compiler-core` is intended to produce semantically
  equivalent bytecode, not byte-identical — original names, integer
  radix, `for` / `switch` / `do/while` forms aren't preserved by the
  IPO encoding. See `docs/proposals/ipo-to-ips-decompile.md` for the
  recognised pattern catalogue + the prior-art relationship.

## [0.7.1] — 2026-05-24

Maintenance release — VM-opcode rename to clean up a long-standing
naming wart in the disassembly output, plus a tiny dev-script
ergonomic tweak.

### Changed

- **VM opcode 0x0b renamed `JMPNZ → JMPZ`.** The byte at 0x0b jumps
  when the condition register is **zero** (false), not non-zero —
  the historical `JMPNZ` mnemonic flat contradicted the semantics
  and three separate source files apologised for the misnaming in
  comments. Renamed across the enum, codegen helper (`jmpnz()` →
  `jmpz()`), VM method (`opJmpNZ()` → `opJmpZ()`), disassembly
  mnemonic, and all internal references. Byte value unchanged →
  emitted bytecode is byte-identical, roundtrip tests still pass.
  User-visible change: `inpax decompile` now prints `JMPZ ; jump
  if false` where it used to print `JMPNZ ; jump if true`.

- **Root script `dev:web` → `web`.** Shorter, more honest — it's a
  dev-server invocation but the long namespace doesn't add anything.
  The `dev:web:host` variant (LAN-bound 0.0.0.0 server) is dropped;
  if you need it, `pnpm --filter @emdzej/inpax-web dev -- --host
  0.0.0.0` is one line.

## [0.7.0] — 2026-05-24

Logger migration onto `@emdzej/bimmerz-logger` (matches the ediabasx
0.3.0 cut-over). The inpax-web Settings dialog gains a Logging
section that controls both `INPAX.*` and `EDIABASX.*` categories
from one panel.

### Changed (breaking)

- **`@emdzej/inpax-logger` deleted.** Consumers move to
  [`@emdzej/bimmerz-logger`](https://www.npmjs.com/package/@emdzej/bimmerz-logger)
  (peer dep for libraries, regular dep for apps). Same pino-shape
  `Logger` interface plus hierarchical categories and runtime-mutable
  central config. Migration for external consumers is a one-line
  import swap:
  ```ts
  - import { getLogger } from '@emdzej/inpax-logger';
  + import { getLogger } from '@emdzej/bimmerz-logger';
  ```
- **`INPAX_LOG_LEVEL` env-var reading moved to the CLI boundary.**
  The library no longer reads `process.env`. The CLI parses the
  full `INPAX_LOG_*` namespace (new — replaces the single
  pre-0.7.0 var):

  | Variable | Values | Purpose |
  |---|---|---|
  | `INPAX_LOG_LEVEL` | `trace\|debug\|info\|warn\|error\|fatal\|silent` | Default level |
  | `INPAX_LOG_CATEGORIES` | `cat=lvl,cat=lvl,…` | Per-category overrides (hierarchical) |
  | `INPAX_LOG_DESTINATION` | path | File output |
  | `INPAX_LOG_FORMAT` | `pretty\|json` | Output format |

- **Bumped to `@emdzej/ediabasx-*@^0.3.0`** across every consumer
  (workspace-wide). Brings in the ediabasx logger migration + new
  modal Run-job arg dialog + `LOG_CATEGORIES` export.

### Added

- **Hierarchical categories on every emit.** All `getLogger()` calls
  now use the `INPAX.*` prefix:
  - `INPAX.vm` — VM dispatch loop.
  - `INPAX.dispatcher` — system-function dispatcher.
  - `INPAX.internal-functions` — IPO-side helpers.
  - `INPAX.main-scheduler` — top-level scheduler.
  - `INPAX.screen-executor` — SCREEN block evaluation.
  - `INPAX.state-machine-executor` — state-machine evaluator.
  - `INPAX.signature-handler` — FFI / callee binding.
  - `INPAX.ui-provider` — terminal / web / mock UI provider.
  - `INPAX.interpreter-cli` — CLI-side interpreter wrapper.
- **`@emdzej/inpax-interpreter` exports `LOG_CATEGORIES`** —
  catalogue iterable from consuming apps so Settings UIs don't
  hardcode category names. Drives the inpax-web Settings panel; web
  hosts that bundle inpax can compose with their own catalogues
  (e.g. ncsx-web combining inpax + ediabasx + ncsx categories).
- **inpax-web Settings — Logging section.** Default-level dropdown
  plus per-category override picker, **sourced from both
  `@emdzej/inpax-interpreter`'s LOG_CATEGORIES and
  `@emdzej/ediabasx-ediabas`'s** — the web app embeds both
  libraries, so a single panel covers both subsystems. Changes apply
  immediately at runtime (handles are proxies; every cached logger
  picks up the new threshold on its next emit).
- **`WebLoggerConfig`** + `setLogLevel` / `setLogCategory` mutators
  in `settings.svelte.ts`. Persisted under
  `settings.logging.{level,categories}`.

### Removed

- **`packages/logger/` (the old `@emdzej/inpax-logger`).** Was a
  thin pino wrapper duplicated across our repos (ediabasx had the
  same shape); consolidated into bimmerz-logger so the three tools
  share one logger with one categorisation model.
- **Pre-0.7.0 `debugMode` no longer drives the logger.** It stays as
  a UI-only toggle for the VM-throttle / tick-ms diagnostic
  settings; the logger has its own panel surface now.

### Internal

- All inpax packages bumped to **0.7.0** in lockstep.
- ediabasx peer-dep range: `^0.3.0` (`^0.2.7` was the prior pin).
- bimmerz-logger range: `^0.1.2` (gets the `LogCategory` type export
  used by the new `LOG_CATEGORIES`).

## [0.6.8] — 2026-05-22

### Changed

- **Bump `@emdzej/ediabasx-*` pins to `^0.2.7`.** Picks up
  `ediabasx@0.2.7`, which converts the BEST/2 table-op error paths
  (`tabseek`, `tabseeku`, `tabget`, `tabline`) from hard `throw` to
  soft `SetError + return` — matching C# `EdiabasLib`'s
  `OpTabseek`/etc. Before, a SGBD that `tabset`'d a non-existent
  table (or seeked an unknown column) had its whole `executeJob`
  aborted with an `EdiabasError`; the BEST/2 program never got to
  branch on `Z` or test the error state. Now the program continues
  past the failed lookup, as C# does.

  Surfaced via `ncsx` again — `C_KMB46.prg::STATUS_AIF_SIA_DATEN_LESEN`
  was throwing inside ncsx-web's SG_CODIEREN post-write status check
  ("tabseek: no active table") even though the actual coding write +
  checksum had completed cleanly. That manifested as a misleading
  "Write failed" toast in the UI for AKMB-class coding flows that
  worked fine before.

  Also picks up `EDIABASX_TIMEOUT_STD_MIN_MS` — a Node-only env var
  that floors `ParTimeoutStd` for diagnosing slow flash-write paths.
  No browser impact (process is undefined in Vite builds).

  No inpax-visible code changes — the fix is entirely inside the
  ediabasx interpreter's table-op error handling. Touches the three
  packages with direct ediabasx pins:
  `@emdzej/inpax-ediabasx-provider`, `@emdzej/inpax-cli`,
  `@emdzej/inpax-web`.

## [0.6.7] — 2026-05-22

### Changed

- **Bump `@emdzej/ediabasx-*` pins to `^0.2.6`.** Picks up
  `ediabasx@0.2.6`, which fixes the `not` opcode (`0x0A`) in the
  bytecode interpreter — previously every job that executed `not`
  aborted with `EdiabasError: Cannot read value from operand`
  because the unary handler routed through the binary
  `arithmeticReadModifyWrite` helper with a synthetic
  `{ kind: "none" }` placeholder for `arg1`, and `readPolyValue`
  rejected the unknown kind.

  Surfaced via `ncsx` again — BMW E46 `KOMBI46R.prg::C_CHECKSUM`
  runs `not L0` inside its post-coding verify path, so NCS Expert's
  `SG_CODIEREN` flow aborted on the C_CHECKSUM step right after the
  16-chunk write loop completed. Earlier blockers (the binary-param
  NUL-append bug from 0.6.6 / `ediabasx@0.2.5`, slot table seeding,
  auth) had to land first before this surfaced as the next gate.

  No inpax-visible code changes — the fix is a dedicated
  `unaryReadModifyWrite` helper inside ediabasx's interpreter that
  mirrors C# `OpNot` (`EdOperations.cs:1753`) exactly. Touches the
  three packages with direct ediabasx pins:
  `@emdzej/inpax-ediabasx-provider`, `@emdzej/inpax-cli`,
  `@emdzej/inpax-web`.

## [0.6.6] — 2026-05-21

### Changed

- **Bump `@emdzej/ediabasx-*` pins to `^0.2.5`.** Picks up
  `ediabasx@0.2.5`, which fixes a CP1252/binary mismatch in three
  interpreter opcodes — `pary`, `freadln`, and `shmget` — that were
  routing raw byte payloads through the string-write path
  (`SetStringData` semantics: append `\0` if the last byte isn't
  already zero) instead of the byte-write path
  (`SetArrayData` semantics: pass-through). The result was a silent
  off-by-one in the destination S register's logical length whenever
  a binary payload's last byte happened to be non-zero, which
  manifested as `JOB_STATUS = "ERROR_BIN_BUFFER"` from any SGBD that
  `slen`-checks the input.

  Surfaced while porting BMW NCS coding to `ncsx` —
  `C_S_SCHREIBEN` aborted on real GETRIEBEART writes (last byte
  `0x0A`) purely from this 1-byte skew. `C_S_LESEN` worked by
  accident because the IPO pre-fills the scratchpad with zeros so
  the buffer's last byte is `0x00` and the NUL-append no-ops.

  No inpax-visible code changes — the three opcodes now match C#
  `EdiabasLib` semantics exactly. Touches the same three packages
  the 0.6.3 bump did (`@emdzej/inpax-ediabasx-provider`,
  `@emdzej/inpax-cli`, `@emdzej/inpax-web`).

## [0.6.5] — 2026-05-21

### Fixed

- **VM `execute()` is now re-entrancy safe.** Symptom: pressing F1 on
  `SGDAT\KOMBI.IPO`'s "Fehler­speicher" menu ran `INPAapiFsLesen`
  successfully (fault report written, no exception thrown), but the
  trailing `userboxclose(0)` and `viewopen("na_fs.tmp", …)`
  instructions at PC `0x00c7` / `0x00cb` never executed — the
  "Fehlerspeicher lesen" progress box stayed stuck on screen, no
  viewer modal opened, no log line surfaced anywhere. The new 0.6.4
  `[ediabas/job:error]` banner didn't catch it either: EDIABAS had
  succeeded, there was simply nothing left running.

  Root cause: every `vm.execute(block, ctx)` call mutated the shared
  `VM.state.{running, currentBlock, ip}` fields. The F1 handler's
  outer `execute()` loop suspended on the `INPAapiFsLesen` `await`;
  during that await, the `setTimeout(0)` scheduled by `setmenu menu[22]`
  (the same handler's PC `0x0002`) fired and ran a *nested* `execute()`
  for `m_fehler_lesen`'s INIT body. When that INIT block ran out of
  instructions, `doReturn` saw an empty return-address stack (top-level
  call from this `execute()`'s perspective) and did
  `this.state.running = false`. Because `running` is a shared field,
  this killed the outer F1 handler's loop guard
  `while (this.state.running && this.state.currentBlock)` —
  silently, with no exception, no error, no log. The outer handler
  returned "normally" without ever running PC `0x00c5`+.

  Why MS43 / ZKE5 fault reads worked: their F1 handlers don't navigate
  menus (no `setmenu` → no nested execute), so there was never a
  re-entrancy window.

  Fix: snapshot `state.{running, currentBlock, ip}` at `execute()`
  entry and restore in `finally`. Each `execute()` now owns its own
  loop guard; a nested call finishing top-level can no longer cancel
  the outer one mid-await. The intra-call call/return mechanism
  (`opCall` / `doReturn` with a non-empty return stack) is untouched —
  user-function calls within a single `execute()` still work the way
  they always did.

  This also closes a latent screen-executor / F-key race: a screen
  block running to completion would have killed any concurrent F-key
  handler too (and vice versa). No reproducer for that one yet, but
  the failure mode was identical.

  (`@emdzej/inpax-interpreter`)

### Changed

- **`@emdzej/inpax-logger` and `@emdzej/ediabasx-ediabas` are now
  peer dependencies.** Previously they were regular `dependencies` of
  the library packages that used them, which meant each consumer of
  `inpax-dispatcher` / `inpax-interpreter` / `inpax-ui-provider-core`
  / `inpax-ediabasx-provider` could end up with its own pino logger
  instance (or its own ediabasx-ediabas version) in `node_modules`,
  hoisted or not. With per-instance loggers the new debug-mode toggle
  (see below) only flipped *one* of the copies and the others stayed
  silent; with two ediabasx-ediabas versions the runtime could end
  up sharing state across mismatched cores.

  Each affected package now declares the dep as a `peerDependency`
  *and* a `devDependency` (so the package still compiles and tests
  in isolation). Apps that ship inpax (`@emdzej/inpax-web`,
  `@emdzej/inpax-cli`) declare the peer-targets as direct
  `dependencies` — pnpm install resolves the peer to the app's
  copy. inpax-web already had both as direct deps; cli picked them
  up in this release.

  (`@emdzej/inpax-dispatcher`, `@emdzej/inpax-interpreter`,
  `@emdzej/inpax-ui-provider-core`, `@emdzej/inpax-ediabasx-provider`,
  `@emdzej/inpax-cli`)

- **Diagnostic VM/dispatcher traces are now gated behind the web
  app's developer-mode toggle.** Added `log.debug(…)` calls in
  `dispatcher.runFsLesen` (entry / mid / exit with character count)
  and `ui-provider`'s `userBoxOpen` / `userBoxClose` (boxNum + state
  snapshot). `apps/web/src/lib/settings.svelte.ts` flips the
  shared pino logger's level between `"debug"` and `"info"` whenever
  `settings.debugMode` toggles (and once on module load). Result:
  debug mode on → diagnostic taps appear in the browser console;
  debug mode off → silent no-ops. Real warnings / errors keep going
  through `console.warn` / `console.error` unconditionally —
  `0.6.4`'s `[ediabas/job:error]` banner is unaffected.

  (`@emdzej/inpax-dispatcher`, `@emdzej/inpax-ui-provider-core`,
  `@emdzej/inpax-web`)

## [0.6.4] — 2026-05-21

### Fixed

- **EDIABAS job failures are now surfaced to the user.** Pre-fix the
  `@emdzej/inpax-ediabasx-provider` `job:error` event had **no
  listeners** — when `executeJob` threw (SGBD load failure, transport
  timeout, `JOB_STATUS != OKAY` caught by `CheckJobStatus`, init
  failure, you-name-it) the error was internally caught and emitted as
  a silent event. The IPO bytecode never sees the failure and runs
  past the failed call with empty/stale results, producing symptoms
  like "userbox opens but never closes" (the report-display step
  ends up rendering an empty file), "F1 handler done but no serial
  activity in the console", or "the screen refreshes once with zero
  data and stops".

  Anchor: KOMBI.IPO `m_fehler` ITEM 0 (F1 = Read faults) calls
  `INPAapiFsMode(165, …)` then `INPAapiFsLesen` for KOMBI46R cluster
  variants. Failures along that path (an `INPAapiFsMode` mode our
  provider doesn't propagate, a job-status mismatch, a cable that
  dropped between the previous call and this one) all swallowed
  silently — debugging required adding console.log statements inside
  the provider. After this fix the same failure surfaces as a red
  banner at the top of the running-script view with the underlying
  EDIABAS message, the user can dismiss it once read, and the
  console still logs the full context for further diagnostics.

  Implementation:
  - `runtime.svelte.ts` subscribes to `ediabasProvider.on('job:error',
    …)` and writes a one-line summary to `app.error` (the same Svelte
    state slot the install picker already uses for banner errors).
  - `App.svelte` renders an `app.error` banner above
    `IpoSidebar` + `IpoRunner` when the user is in the browse view —
    previously the banner was only rendered inside `InstallPicker`
    so script-runtime errors were invisible.
  - `connect:error` failures route through the same `job:error`
    event in the provider (`lines 198, 203` of `ediabasx-provider.ts`),
    so cable / init failures land in the same banner without a
    separate listener.

  (`@emdzej/inpax-web`)

## [0.6.3] — 2026-05-21

Picks up two structural improvements from `ediabasx` (0.2.3 and 0.2.4)
and bumps `apps/*` onto the package version line so the whole monorepo
moves in lockstep.

### Changed

- **Bump `@emdzej/ediabasx-*` pins to `^0.2.4`.** Two-release jump from
  `^0.2.2`:

  - **`ediabasx@0.2.3`** — byte-backed S registers. The interpreter
    now stores S0–SF as raw `Uint8Array` buffers + a logical length
    (matches C# `EdiabasLib.StringData`), with CP1252 only running at
    the `getS`/`setS` boundary. All 256 byte values round-trip
    bit-exact through `getSBinary`/`setSBinary`; the 0.2.2 encode-
    table patch is no longer load-bearing for binary buffers. `getS`
    now terminates at the first `0x00` (C# `GetStringData` parity)
    and `getSBinary` returns a fresh copy. No inpax-visible behaviour
    change for canonical write-then-read flows; binary-heavy paths
    are now structurally lossless.
  - **`ediabasx@0.2.4`** — `Ediabas.executeJob` accepts
    `Uint8Array` parameters. EDIABAS exposes two parameter channels
    (string via `pari`/`pars`, binary via `pary`/`parb`/`parw`/`parl`/
    `parr`). The widened API routes elements by JS type:
    `string` → `ParameterSet.parameters[i]`, `Uint8Array` →
    `ParameterSet.binaryPayload`. Unblocks binbuf-driven SGBDs whose
    entry point starts with `pary S1; jz ERROR_NO_BIN_BUFFER` —
    notably BMW NCS coding (`C_S_LESEN` / `C_S_SCHREIBEN` /
    `C_S_AUFTRAG` on K-line + F-series equivalents). Pure widening;
    every existing `string[]` caller still type-checks.

  Touches `@emdzej/inpax-ediabasx-provider`, `@emdzej/inpax-cli`, and
  `@emdzej/inpax-web` (the three packages with direct ediabasx pins).

- **`apps/*` versions now move with `packages/*`.** Previously the
  five apps (`cli`, `inpax-web`, `inpax-compiler`, `ipo-editor`,
  `bimmerz-bundler`) stayed pinned at `0.5.1` while packages
  advanced through `0.6.x`. This was technically fine since the apps
  aren't published, but it made it hard to tell which app build
  matches which package release. From this release on, every
  `package.json` in the repo (packages, apps, root) carries the
  same version string.

## [0.6.2] — 2026-05-20

Dependency bump release. Picks up the ediabasx 0.2.2 patch that fixes
CP1252 round-trip corruption on five specific byte values — the bug
that caused certain BEST2 jobs to loop forever once an inner counter
or response byte crossed `0x81`, `0x8D`, `0x8F`, `0x90`, or `0x9D`.

### Changed

- **Bump `@emdzej/ediabasx-*` pins from `^0.2.1` to `^0.2.2`.** Affects
  `@emdzej/inpax-ediabasx-provider`, `@emdzej/inpax-cli`, and
  `@emdzej/inpax-web`. The underlying ediabasx fix is in
  `@emdzej/ediabasx-core`'s CP1252 encode table (the five "undefined"
  CP1252 slots now round-trip bit-exact instead of falling back to
  `'?'` / `0x3F`). Surfaced by `C_KMB46.prg!C_FA_LESEN` (BMW E46
  vehicle-order read), whose loop counter at `S0[#$0..1]` got stuck
  cycling `0x40..0x81` instead of reaching its `0x180` exit max. See
  `ediabasx/CHANGELOG.md @ 0.2.2` and the
  `ediabasx/docs/s-register-refactor-proposal.md` doc for the
  longer-term direction (native `Uint8Array` storage for S registers).

## [0.6.1] — 2026-05-20

Bug-fix release. Closes a v1.x interpretation bug discovered while
running NCSEXPERT-emitted IPOs end-to-end.

### Fixed

- **v1.x `ALLOC` / `PUSHIMM` TypeMarker bytes are now translated to
  the canonical v5.x vocabulary at parse time.** NCSEXPERT-era v1.x
  bytecode numbers TypeMarker bytes following the constants
  vocabulary (`1=BOOL, 2=INT, 3=REAL, 4=STRING, 5=LONG`) shifted by
  `0x4F` — so v1.x `0x53` means **String** (default `""`), but the
  canonical v5.x `0x53` means **Long** (default `0`). Without
  translation, `opAlloc` mis-typed every v1.x string local as Long;
  `A_ACC.ipo!FgnrLesen`'s `local[0]` (the EDIABAS job-name slot)
  came back as a Long-`0` and `popString` returned `"0"` —
  cascading into broken `INPAapiJob` dispatches and string-ALU
  results.

  Empirical anchor: surveyed every IPO in
  `EC-APPS/NCS_EXPER/SGDAT/`; only `0x50/0x51/0x53` are emitted by
  NCSEXPERT in the wild (Bool / Int / String — coding scripts
  rarely need Real or Long). The String case was verified end-to-end
  against `FgnrLesen`, whose `3× ALLOC 0x53 + 1× ALLOC 0x51`
  prologue feeds `local[0]` into both `INPAapiJob "STOP_MODUS"` and
  `PEMProtokollAusgabe` as strings.

  Fixed via a new `V1_TYPE_MARKER_TO_V5_TYPE_MARKER` table in
  `packages/parser/src/parser/ipo-parser.ts`, applied at parse time
  in `parseFunction` when `versionHi === 1` and `opcode` is `ALLOC`
  or `PUSHIMM`. `Instruction.raw` preserves the original on-disk
  byte for tooling that needs it. ALU operations need no separate
  fix — their type-dispatching reads the (now-correct) operand
  `type` field from the stack, so string concatenation and string
  equality work as soon as ALLOC stops mis-typing the source slots.
  (`@emdzej/inpax-parser`)

### Documentation

- **Umbrella docblock at the top of `ipo-parser.ts`** spelling out
  the "normalise v1.x → v5.x at parse time" strategy and listing
  all four translation tables in one place (opcode, TypeMarker,
  constants type, globals type) so future contributors know to
  extend by adding a new table rather than branching downstream.
  (`@emdzej/inpax-parser`)
- **Corrected `docs/ipo-format-versions.md` TypeMarker table.** The
  previous version claimed the byte → ValueType semantics were
  identical across v1.x / v5.x with only internal-tag differences —
  wrong, as the FgnrLesen anchor proves. New table makes the
  byte-swap explicit and the "v1.x = constants_type + 0x4F"
  derivation explicit.

## [0.6.0] — 2026-05-20

Additive release driven by two threads of INPA.exe reverse-engineering:
mapping the STEUERN (control/activation) verb family to its state
machine, and giving consumers of `@emdzej/inpax-interpreter` a clean
hook to override system functions per host.

### Added

- **`ControlSession` — state mirror for the STEUERN verb family.**
  Promotes `select` / `deselect` / `start` / `stop` from silent no-op
  stubs to real state mutations on a per-VM `ControlSession` that
  mirrors INPA's `DAT_004a0008` singleton. Field map is Ghidra-anchored
  in the docblock (`+0x38` active, `+0x44` applied, `+0x98` selected,
  `cycleTicks` from `DAT_0049bec0`, …). `control()` stays a no-op —
  only 8 legacy E36/E38 IPOs (LCM / LSZ / ZKE2 lighting era) use it
  and none of them query the session back. (`@emdzej/inpax-interpreter`)

  - `select(MultipleSelectFlag)` moved from internal-functions into
    the dispatcher's async list. It routes through
    `ui.togglelist(multi, /*argNum=*/true, items)` so the dialog
    returns 1-based indices (no mask-OR ambiguity), then commits
    picks via `session.applySelection()`. Guarded with INPA's
    `IsEmpty` check so orphaned `m_main` F-keys (`start; select(true)`
    on screens with no LineFuncs — observed in MS430 / KOMBI / LCM)
    stay silent instead of opening an empty picker.
    (`@emdzej/inpax-dispatcher`)
  - `start()` honours the same `IsEmpty` guard via
    `session.start(items)` and sets `cycleTicks = 60` to match
    `DAT_0049bec0 = 0x3c`. (`@emdzej/inpax-interpreter`)
  - `stop()` clears `active` + `cycleTicks` — the canonical pattern
    in ZKE2's per-screen error halt (`messagebox` + `stop` at offset
    `002d`, repeated 60+ times across body-electronics screens).
    (`@emdzej/inpax-interpreter`)
  - No consumers read the session yet, so KOMBI / MS43 flows that
    already work via `togglelist` (0x16) are untouched. The session
    is the foundation for ZKE2-style cycle gating and the legacy
    LCM `control + INPAapiJob` pattern.

- **Host overrides for system functions.** New `systemFunctions?:
  Map<number, SystemFunctionOverride>` slot in `VMConfig`. Each entry
  fully replaces the default routing for that `SystemFunction` ID —
  checked before both the internal-functions registry and the
  dispatcher. Sync or async handlers both supported (`void` or
  `Promise<void>` return); the VM awaits either. No `next()` chain:
  consumers who want "default plus side-effect" compose by hand.

  Lets each host wire verbs that need different semantics per
  environment — `exitwindows` closes a browser tab in the web app,
  calls `process.exit` in the CLI, collapses a panel in the TUI —
  without forking the interpreter. See
  `packages/interpreter/README.md` for the recipe.
  (`@emdzej/inpax-interpreter`)

## [0.5.1] — 2026-05-20

Bug-fix release focused on the live diagnostic-control path. Every
fix below was verified end-to-end against a real BMW E46 KOMBI46R
cluster: F1 TACHO in the "Steuern Analog" menu now drives the
dashboard needle, and F3 "Auswahl: Kontrollampen ansteuern" pops a
populated togglelist whose picks light the correct indicators.

### Fixed

- **Menu locals persist across the INIT → item-handler transition.**
  v5.x menus inline their local-variable allocation as `LOAD` defaults
  at the start of the menu body; those values must remain on the
  stack for every MenuItemFunc dispatched by an F-key. `setMenu` used
  to run the body in a disposable `ExecutionContext`, so the first
  `PUSHREF local[0]` in an item handler hit an empty stack and threw
  "Stack index out of bounds". `VM` now captures the context after the
  menu body settles (`activeMenuContext`) and reuses it via
  `executeMenuItem`. Mirrors what `ScreenExecutor` already does.
  (`@emdzej/inpax-interpreter`, `@emdzej/inpax-cli`, `@emdzej/inpax-web`)
- **`AluOp.XOR` handler + condition register on `AND`/`OR`/`XOR`.** The
  enum had XOR (`0x6c`); the switch in `opAlu` didn't. INPA's
  `FUN_00460faf` updates `state.condition` for all three logical
  binary ops, not just comparisons — without that, a `JMPNZ` after a
  compound bool like `(a == b) && (c == d)` reads the stale condition
  from the last `EQ`. Both fixed. (`@emdzej/inpax-interpreter`)
- **`getinputstate` polarity inverted (`0` = OK).** INPA convention
  matches Win32 return codes: `0` = success, non-zero = error /
  cancel. The previous fix had submit→1 / cancel→0 which made every
  submission take the cancel branch (the script's `EQ inputstate, 0`
  → `JMPNZ @51` chain only reaches the OK path when EQ is true).
  `submitInput` now sets `lastInputState = 0`; `cancelInput` sets it
  to `1`. (`@emdzej/inpax-ui-provider-core`)
- **`INPAapiJob` splits the parameter string by `;`.** BMW EDIABAS's
  `apiJob(ECU, JOB, PARAMS, RESULTS)` takes `PARAMS` as a single
  semicolon-delimited string that the API explodes into `par(0)`,
  `par(1)`, … `par(N)` for the BEST2 program. We were passing
  `[arg1, arg2]` verbatim as a 2-element array, so a multi-param
  command like `STEUERN_LEUCHTE "0xFF;0xFF;0xFF;0xFF;0xFF;0xFF" ""`
  collapsed into one giant `par(0)` blob and the ECU saw nothing
  valid. Now `arg1.split(';')` produces the correct per-`par(N)`
  values; `arg2` (result filter) is dropped — `executeJob` doesn't
  support filtering. (`@emdzej/inpax-ediabasx-provider`)
- **ScrollIndicator no longer counts toggle-item declarations.**
  `ScreenExecutor` reports `totalLines` to the host for pagination;
  pre-fix it counted every `LineFunc` block, including the "empty"
  (`size === 0`) ones that carry toggle-item name/mask pairs in
  their headers. KOMBI's "Ansteuern Digital" screen has 1 paintable
  line + 34 item declarations; the indicator was showing "1/35" with
  scroll arrows pointing nowhere. Now it counts only `size > 0`
  lines. (`@emdzej/inpax-interpreter`)

### Added

- **INPA-compatible `togglelist` dialog driven by SCREEN
  declarations.** v1 ships the complete read path:
  - **`ScreenExecutor.getToggleItems()`** harvests the active SCREEN's
    "empty" LineFunc sub-blocks (`size === 0` && `arg1 !== ""`) as
    `{ name, mask }` pairs. Each item's name lives in `LineHeader.arg1`
    and a 9-byte semicolon-hex control mask in `LineHeader.arg2`
    (the bytes that get fed straight into
    `INPAapiJob "STEUERN_LEUCHTE", <mask>, ""`). Mirrors what real
    INPA does at screen-mount time via `INPA_RunBlockPhase` /
    `FUN_0041acbe`.
  - **Dispatcher** reads the items via `vm.getScreenExecutor()` and
    hands them to `ui.togglelist(multipleSelect, argNum, items)`.
  - **Wire serialisation** honours both INPA flags:
    `MultipleSelectFlag=false` → dialog runs in single-select mode
    (radio behaviour); `ArgNumFlag=true` → output is space-separated
    1-based indices (`"3 7"`); otherwise → bitwise OR of the picked
    items' masks, re-formatted as `"0xNN;0xNN;…"` so two lamps can be
    driven in one ECU command.
  - **`TogglelistDialog.svelte`** renders the harvested item names in
    a multi-select list with OK / Cancel / Deselect buttons. Free-text
    "Set:" field removed — items always come from the SCREEN now.
- **`ToggleItem` interface in `@emdzej/inpax-interfaces`** plus three
  serialisation helpers — `orToggleMasks`, `formatToggleIndices`, and
  `encodeTogglelistResult` — shared between the CLI, web, and mock
  providers so all wire bytes match regardless of which provider drove
  the dialog. 13 unit tests pin the OR / index / round-trip /
  out-of-range behaviour. (`@emdzej/inpax-interfaces`)
- **CLI `togglelist` prompt** renders items as a numbered list,
  accepts comma-separated 1-based indices, encodes via the same
  shared helper. (`@emdzej/inpax-cli-provider`)

### Changed

- **`IUIProvider.togglelist` signature**: `candidates: string[]` →
  `items: ToggleItem[]`. The previous shape only landed in an
  intermediate (unreleased) commit between `0.5.0` and `0.5.1`, so
  no public API actually breaks. (`@emdzej/inpax-interfaces`,
  `@emdzej/inpax-ui-provider-core`, all concrete UI providers)
- **`select` / `deselect` / `control` / `start` / `stop` promoted to
  silent no-ops.** Per BMW INPA developer reference these are the
  "measurement/control session" verbs an external launcher drives —
  not on the togglelist read path. The previous stub logged
  `"stub function not implemented"` on every dispatch, which was
  noisy for any script that exercised them. `select` correctly drains
  its single `bool` argument via a new helper so the operand stack
  stays balanced for subsequent instructions.
  (`@emdzej/inpax-interpreter`)

### Reverse-engineering

The togglelist architecture was pinned down via a chain of INPA.exe
decompiles documented incrementally — handler `FUN_004139f5` →
context router `FUN_00420cff` → list-iterator `FUN_0041acbe` →
toggle-context constructor / mounter `INPA_RunBlockPhase @ 0x00420891`.
The crucial finding (items come from the SCREEN's empty LineFunc
declarations, not from EDIABAS results as we'd first hypothesised)
was confirmed empirically by scanning `KOMBI.IPO`'s constants pool
for "Tempomat", "Bremsbelag", "Ladekontrolle" etc. — none had
matching `LOAD const[…]` instructions because they live in
`LineHeader.arg1` fields, not in the bytecode at all.

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
  reusable browser components, extracted from `apps/web` so future
  apps that embed the INPA runtime in a browser can consume them
  without duplicating the rendering layer. Ships:
  - `WebUIProvider` (concrete `UIProvider` subclass).
  - 9 components: `ScreenCanvas` (canvas-based INPA screen renderer,
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

- **`apps/web` consumes `@emdzej/inpax-web-provider`** instead of
  hosting the components inline. `App.svelte` installs the theme
  context once at the root via `setLibTheme(...)` inside an `$effect`
  that tracks the existing `isDarkTheme()` store; `IpoRunner.svelte`
  imports components from the new package and wires the
  `<ScriptSelectDialog>`'s `loader` prop to its existing
  `loadScriptSelect(cfgdat, filename)` adapter. The 9 component files
  + 3 lib modules previously in `apps/web/src/` are gone — same
  rendering, code lives in the library now. (`@emdzej/inpax-web`)
- **`apps/web/tsconfig.json`: `verbatimModuleSyntax: false`.**
  Required because the library ships `.svelte.ts` source whose Svelte
  module parser rejects the `type` keyword in import specifiers; the
  consumer's tsc was descending into the package source and forcing
  the keyword. TS still elides type-only imports automatically.
  (`@emdzej/inpax-web`)
- **`apps/web/vite.config.ts`: removed `@emdzej/inpax-web-provider`
  from `optimizeDeps.include`.** Vite's pre-bundling step uses esbuild
  which doesn't run the Svelte plugin's TS preprocessor, so a `.svelte.ts`
  source file fails to parse at pre-bundle time. Leaving the package
  out of the include list routes it through the main transformation
  pipeline (which does include the plugin). (`@emdzej/inpax-web`)
- **`apps/web/tailwind.config.ts`: scan the library's source.**
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
