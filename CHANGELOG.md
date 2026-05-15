# Changelog

All notable changes to **inpax** are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com); the project
follows [Semantic Versioning](https://semver.org) loosely — minor version
bumps may carry new features and small breaking changes until 1.0.

## [Unreleased]

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
