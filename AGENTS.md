# inpax — Agent Onboarding & INPA Scripting Reference

This file is split into two halves:

1. **[Repository Orientation](#repository-orientation)** — workspace layout,
   cross-repo dependencies, release / deploy workflow, known limitations,
   and gotchas. Read this first when resuming a session.
2. **[INPA / IPS Scripting Language Guide](#inpa--ips-scripting-language-guide)** —
   reference for working *on* INPA scripts (what `.ips` source looks like,
   how `.ipo` bytecode is laid out, how to drive the compiler). Read when
   touching parser / interpreter / compiler / disassembler code, or when
   authoring sample scripts.

---

## Repository Orientation

### What inpax is

A TypeScript reimplementation of the BMW INPA stack — parser, compiler,
disassembler, VM, and runtime providers — paired with a browser SPA
(`inpax-web`) and a terminal TUI (`inpax-cli`) that can run real INPA
diagnostic scripts against a live ECU. The VM speaks the `.ipo` bytecode
format defined in [bytecode-byte-order](#bytecode-byte-order); the
runtime providers shim INPA's diagnostic / UI / printing system functions
against modern hosts (Web Serial cable, WebSocket gateway, ediabasx
provider).

### Workspace layout

20-something pnpm workspaces under `packages/` (libs) and `apps/`
(end-user tools). Active areas an agent typically touches:

| Path | Role |
|---|---|
| `packages/core` | Shared types, scalar helpers, byte-order constants |
| `packages/parser` | `.ipo` bytecode → AST |
| `packages/disassembler` | AST → human-readable assembly |
| `packages/interpreter` | BEST2 VM: main scheduler, screen executor, state-machine executor, instruction dispatch |
| `packages/compiler-core` + `apps/inpax-compiler` | `.ips` source → `.ipo` bytecode |
| `packages/dispatcher` | INPA system-function table, routes opcodes to provider methods |
| `packages/ui-provider-core` | Abstract `UIProvider` — screen buffer, menu state, dialogs, cell-grid writes |
| `packages/tui-provider` + `packages/cli-provider` | TUI / CLI implementations of `UIProvider` |
| `packages/ediabasx-provider` | Diagnostic provider — wraps `@emdzej/ediabasx-ediabas` |
| `packages/providers` | Mock / null providers used in tests + when a real one is absent |
| `packages/mock-provider` | Headless mock for unit tests |
| `packages/interfaces` | Shared TS interfaces between provider implementations |
| `packages/ini-parser` | INPA `.ini` config parser (INPA.INI, EDIABAS.INI) |
| `packages/logger` | pino-based structured logging, honours `INPAX_LOG_LEVEL` |
| `apps/cli` | `inpax` terminal binary — TUI runtime + IPO toolchain subcommands |
| `apps/inpax-web` | Browser SPA — Svelte 5 + Vite. Deploys to `inpax.bimmerz.app` |
| `apps/inpax-compiler` | Headless `.ips → .ipo` compiler binary |
| `apps/ipo-editor` | Ink-based TUI for editing constants inside compiled `.ipo` files; ships the **patch system** (init / apply / save-as-patch) |
| `apps/bimmerz-bundler` | CLI that produces a curated zip of a BMW INPA install; OPFS-importable in inpax-web. Truncation bug fixed in 0.3.2 |

`packages/tui` is the headless cell-grid renderer used by `cli`. Don't
edit `inpax/my/` — it's a legacy subtree that pre-dates the monorepo
split and should be ignored.

### Cross-repo dependency: ediabasx

inpax depends on the sibling repo at `~/Projects/my/ediabasx` for the
EDIABAS / ECU communication stack. Published as `@emdzej/ediabasx-*`
on npm; consumed via *npm pins*, **not** workspace links — three places
hold the pin:

- `apps/cli/package.json` → `@emdzej/ediabasx-interfaces`
- `apps/inpax-web/package.json` → `ediabasx-ediabas`, `interface-base`,
  `interface-serial`, `interfaces`
- `packages/ediabasx-provider/package.json` → `ediabasx-ediabas`

Bump the pins together when picking up a new ediabasx release; the
[browser-safe `/client` subpath](https://github.com/emdzej/ediabasx)
of `@emdzej/ediabasx-interfaces` is what `inpax-web` imports
(`@emdzej/ediabasx-interfaces/client`) to avoid pulling the
`node:net` / `node:http` / `ws` baggage into the browser bundle.

### Browser-app interface model

`inpax-web` exposes exactly two interfaces in the wizard:

- **Web Serial (local cable)** — `navigator.serial` + `WebSerialTransport`
  + a `SerialInterface` from `@emdzej/ediabasx-interface-serial`.
- **Remote gateway (WebSocket)** — `new GatewayClient({ transport: "websocket", url })`
  from `@emdzej/ediabasx-interfaces/client`, pointed at a remote
  `ediabasx gateway --transport websocket` server (which holds the cable).

Simulation / ENET / raw `serial` / `kdcan` are not offered: they need
Node-only APIs. Older localStorage entries with those values coerce
back to `webserial` on load (see `apps/inpax-web/src/lib/config.ts`).

### Build / test / lint

```bash
pnpm install                            # workspace bootstrap
pnpm -r build                           # all packages
pnpm -r test                            # all packages
pnpm --filter @emdzej/inpax-web typecheck
pnpm --filter @emdzej/inpax-web dev     # vite, port 5174
                                        # (ediabasx-web is 5173)
```

Individual filters use the package name from `package.json:name`, not
the directory. `pnpm --filter @emdzej/inpax-interpreter test` etc.

### Versioning & release

- **Uniform versioning.** Every package — public *and* private — moves
  in lockstep on a release. `chore: release X.Y.Z — bump all workspace
  packages, update CHANGELOG` is the canonical commit shape.
- **Bumps live in 23 places per release**: the 22 `package.json` files
  + `CHANGELOG.md`. (`packages/*/package.json` × 16, `apps/*/package.json`
  × 5, root `package.json` × 1).
- **Tags use plain `0.3.3` form** — no `v` prefix. The web app's
  version pill links to `/releases/tag/{__APP_VERSION__}` accordingly.
- **CHANGELOG format**: Keep-a-Changelog with `## [X.Y.Z] — YYYY-MM-DD`
  headings. Maintain `[Unreleased]` at the top while work is in-progress;
  rename to the release version + add the date when bumping.
- **Publish:** `pnpm -r publish --otp=<code>` to push the public packages
  to npm; the OTP is shared across the recursive run (one prompt per
  batch, not per package). `inpax-web` is `private: true` and doesn't
  ship via npm — it deploys to GitHub Pages instead.

### Deploy: `inpax.bimmerz.app`

`.github/workflows/deploy-web.yml` builds `apps/inpax-web` and publishes
it via `actions/deploy-pages` with a `CNAME` writing
`inpax.bimmerz.app`. **Manual trigger only** (`workflow_dispatch`) —
click "Run workflow" in the Actions tab. Concurrency-gated on the
`pages` group, so a second run queues cleanly.

GitHub Pages binds one site per repo, so we can't deploy multiple
domains from this repo with `actions/deploy-pages` alone. If you ever
need two sites (e.g. SPA at root + docs at `/docs/`), build them into a
single artifact under subpaths and adjust the Vite `base` config; the
inpax-web service worker needs a `navigateFallbackDenylist: [/^\/docs\//]`
in that case so the SPA shell doesn't intercept docs navigations.

### Browser bundle / OPFS

- `apps/inpax-web/src/lib/bundled-install.ts` streams a
  `bimmerz-bundle` zip into OPFS. Surfaces per-file failures via a
  structured DevTools warning and an amber callout in Settings → Data;
  the install marker reflects what *actually* landed in OPFS, not what
  fflate decoded.
- `apps/inpax-web/src/lib/connection.svelte.ts` owns the cable
  transport lifecycle (Web Serial port pick + `SerialInterface`, or
  `GatewayClient`). Separate from `runtime.svelte.ts` (which is
  per-IPO) so switching scripts doesn't re-prompt for a port.
- `apps/inpax-web/src/lib/runtime.svelte.ts` is the per-IPO runtime
  graph — `Ediabas` + providers + dispatcher + main scheduler.

### Known limitations

- **`setscreen` mid-LINE-block tail continuations leak.** When BEST2
  calls `setscreen` from inside a LINE block, the bytecode after the
  dispatch still runs to the end of *that block*. Writes from those
  trailing instructions land on the new screen. Cancelling mid-block
  would need an `AbortSignal` plumbed down into `vm.execute`'s
  instruction loop. Fixed in 0.3.3 for the cross-block case (the
  surrounding LINE loop no longer continues to `line[i+1..N]` after a
  swap); see commit `c20c8a7`. Practically: keep `setscreen` as the
  last meaningful op in its containing block.
- **OPFS rejects Windows reserved basenames** (`CON`, `PRN`, `NUL`,
  `COM1..9`, `LPT1..9`) and chars `< > : " | ? *`. Files with those
  paths are skipped during bundle import and surfaced in the Settings
  failure list — they're not silently lost any more, but a path that
  needs them won't make it in. Re-bundle excluding them, or rename
  upstream.
- **`bimmerz-bundler` produced corrupt zips before 0.3.2.** Any bundle
  built on 0.3.0 / 0.3.1 silently truncates somewhere through the
  central directory. Re-bundle with ≥0.3.2 (uses synchronous fd writes
  instead of the racy fire-and-forget `appendFile`).

### Gotchas

- **Don't touch `inpax/my/`** — legacy subtree, ignored by all tooling.
- **No `v` prefix on git tags** — `0.3.3`, not `v0.3.3`. The web app's
  release-tag link depends on this.
- **`pnpm -r test` runs Vitest in each package**; some packages have no
  tests and pass on `--passWithNoTests`. That's expected.
- **Web app port is 5174** so it doesn't collide with ediabasx-web on
  5173 (when both are running locally for cross-repo work).
- **Service worker autoUpdate.** `vite-plugin-pwa` is configured with
  `registerType: "autoUpdate"` — a new build's SW silently activates
  after the next reload, no user prompt. If you ship a breaking change
  to the SPA state model, bump the version *and* announce — users won't
  see a "refresh" badge.
- **Conventional commit prefixes per scope:** `feat(inpax-web): …`,
  `fix(interpreter): …`, `chore: release …`, `docs(bimmerz-bundler): …`.
- **Use the project's existing palette** in any UI work — defined in
  `apps/inpax-web/src/lib/theme.ts`. The BMW INPA palette is the
  authoritative reference; don't introduce ad-hoc colour values.

---

# INPA / IPS Scripting Language Guide

## Tech Stack

- **Language**: TypeScript (strict mode)
- **Monorepo**: pnpm + Turborepo
- **Testing**: Vitest
- **Linting**: ESLint + Prettier
- **Build**: TypeScript (`tsc`)

### Guidelines

| Technology | Guide                                                            | When to load                     |
| ---------- | ---------------------------------------------------------------- | -------------------------------- |
| TypeScript | [`docs/guidelines/typescript.md`](docs/guidelines/typescript.md) | Types, const objects, binary ops |

**Rule:** Load the relevant guide(s) before starting work in that area.

### Core Rules

- **All code, comments, and commit messages in English**
- **No `any`** — use `unknown` or proper types
- **Const objects over enums** — better tree-shaking
- **Uint8Array for binary data** — use DataView for multi-byte reads
- **Conventional commits**: `feat(parser): add opcode disassembly`

---

## Overview
INPA (Interpreter for Test Procedures) is a scripting system used for BMW diagnostics. It allows creating `.IPS` (source) files which are compiled into `.IPO` (object) files. These scripts control the diagnostic interface (EDIABAS) to communicate with vehicle ECUs.

Key features:
- C-like syntax
- Built-in UI functions (text, menus, graphs)
- EDIABAS interface for ECU communication
- State machine support for background tasks

## File Structure

A standard `.IPS` file structure:

```c
// 1. Pragmas & Includes
#include "inpa.h"

// 2. Global Variables
string myText;
int myCounter;
real voltage;

// 3. Main Entry Point (Required)
inpainit()
{
   INPAapiInit(); // Initialize EDIABAS
   settitle("My Test Script");
   setmenu(m_main);
   setscreen(s_main, TRUE);
}

// 4. Exit Point (Required)
inpaexit()
{
   INPAapiEnd(); // Cleanup EDIABAS
}

// 5. Screen Definitions
SCREEN s_main()
{
   // UI layout & periodic updates
   text(1, 0, "Main Menu");
}

// 6. Menu Definitions
MENU m_main()
{
   INIT {
      setmenutitle("Main");
   }
   ITEM(10, "Exit") {
      exit();
   }
}
```

## Language Elements

### Variables & Types
- `byte` (8-bit int)
- `int` (16-bit int)
- `long` (32-bit int)
- `real` (double float)
- `bool` (TRUE/FALSE)
- `string` (null-terminated)

### Control Structures
Standard C-style controls:
- `if (condition) { ... } else { ... }`
- `while (condition) { ... }`
- Logic: `&&`, `||`, `!`, `==`, `!=`, `>`, `<`
- Binary: `&`, `|`, `^`

### Functions
User functions:
```c
my_function(in: int a, out: int b) {
  b = a + 1;
}
```
Parameter directions: `in`, `out`, `inout`.

## User Interface

### Screens (`SCREEN`)
Defines visual layout. Can be cyclic (`frequ=TRUE`).
```c
SCREEN s_status()
{
   // Static text
   text(0, 0, "Status:");
   
   // Periodic job
   INPAapiJob("MY_ECU", "STATUS_READ", "", "");
   
   // Display result
   LINE("Voltage", "") {
      INPAapiResultAnalog(voltage, "STAT_UBATT", 1);
      analogout(voltage, 2, 10, 0.0, 15.0, 11.0, 14.0, "%.2f");
   }
}
```

### Menus (`MENU`)
Defines F-keys (F1-F10).
```c
MENU m_main()
{
   ITEM(1, "Read Error") {
      setscreen(s_error, TRUE);
   }
   ITEM(10, "Exit") {
      exit();
   }
}
```

## EDIABAS Interface (Standard Library)

### Core Functions
- `INPAapiInit()`: Initialize connection.
- `INPAapiJob(sgbd, job, args, result)`: Execute ECU job.
  - `sgbd`: ECU description file (e.g., "DME_M52")
  - `job`: Job name (e.g., "STATUS_LESEN")
- `INPAapiResultText(var, result_name, set, format)`: Get text result.
- `INPAapiResultAnalog(var, result_name, set)`: Get float result.
- `INPAapiFsLesen(sgbd, file)`: Read error memory to file.

### Example: Reading Voltage
```c
real volt;
INPAapiJob("DME", "STATUS_UBATT", "", "");
INPAapiResultAnalog(volt, "STAT_UBATT", 1);
```

## Best Practices
1. **Always include `inpa.h`**.
2. **Initialize/Exit properly**: Call `INPAapiInit()` in `inpainit()` and `INPAapiEnd()` in `inpaexit()`.
3. **Use State Machines** for complex, interruptible sequences (like guided tests).
4. **Error Handling**: Use `INPAapiCheckJobStatus("OKAY")` to verify job success.
5. **Formatting**: Use `analogout` for visual bars for sensor values.

## Compilation

Use `INPACOMP.EXE filename.ips -B output.log` to compile.

⚠️ **CRITICAL: ALWAYS use `-B` flag when compiling!**

Without `-B`, the compiler opens GUI dialogs and waits for user input — this blocks remote execution.

**Syntax:**
```
INPACOMP.EXE <filename.ips> -B <logfile.log>
```

**Example on Windows Node:**
```
C:\EC-APPS\INPA\BIN\INPACOMP.exe C:\EC-APPS\INPA\SGDAT\test.ips -B C:\EC-APPS\INPA\SGDAT\test.log
```

**Via nodes tool:**
```
nodes run --node="Windows Node" ["cmd", "/c", "C:\\EC-APPS\\INPA\\BIN\\INPACOMP.exe S:\\inpax-tests\\test.ips -B S:\\inpax-tests\\test.log"]
```

ALWAYS place .ips files in C:\EC-APPS\INPA\SGDAT\
Output will be also in C:\EC-APPS\INPA\SGDAT\

**Examples (CI / validation):**
```
# Compile headlessly and save errors to a file
INPACOMP.EXE MY_SCRIPT.IPS -B compile-errors.log

# Fail CI if errors were logged (simple check)
INPACOMP.EXE MY_SCRIPT.IPS -B compile-errors.log && (test ! -s compile-errors.log)
```

## Bytecode Byte Order

**IMPORTANT**: IPO instructions are 4 bytes, **opcode is the FIRST byte**.

❌ Wrong: `00 09 6A 00` (looks like little-endian u32)
✅ Correct: `09 6A 00 00` (opcode 0x09, operand 0x6A, padding)

When documenting bytecode, always use the CLI disassembler output as reference:
```
pnpm --silent cli disasm <file.ipo>
```
