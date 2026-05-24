# inpax

**BMW INPA Interpreter & Toolchain**

Cross-platform reimplementation of BMW INPA (INterface for Programming Applications) — BMW's diagnostic tool for running test procedures on vehicle ECUs.

Two runtimes share the same VM, parser, dispatcher, and provider graph:

- **CLI (`inpax`)** — one terminal binary that decompiles, runs, compiles, edits, patches, and bundles INPA scripts.
- **Web SPA** — pick an INPA install on disk, browse and run `.ipo` scripts in the browser, talk to a real ECU over Web Serial.

## Features

- 📄 **IPO parser** — reads compiled INPA bytecode (`.ipo`).
- 🔧 **Decompiler** — IPO → readable assembly, names jobs/screens/menus.
- ⚙️ **VM + scheduler** — runs INPA bytecode with screen / state-machine / F-key dispatch.
- 🖥️ **TUI runtime** — terminal UI matching the original INPA look (ink-based).
- 🌐 **Browser SPA** — same VM in the browser, paints onto a canvas, talks to ECUs via Web Serial.
- ⌨️ **IPS compiler** — IPS source → IPO bytecode (CLI + library).
- ✏️ **IPO editor** — Ink TUI for editing constants inside compiled `.ipo` files.
- 🩹 **Patch system** — declarative YAML patches (translations, overrides) applied non-interactively.
- 📦 **Install bundler** — turn an INPA / EDIABAS / NCS install into a small zip the web tools can mount in OPFS.
- 🔌 **Provider system** — pluggable UI, EDIABAS, INP1, simulation, print, external surfaces.

## Embedding inpax in your own app

→ **[Integration guide](docs/guides/developer/embedding.md)** — VM,
providers, real-ECU transports, browser quirks. Worked examples for
Node CLI and Svelte 5 / Vite browser embeds.

## Quick start

### Install the CLI globally

```bash
npm i -g @emdzej/inpax-cli
inpax --help
```

One binary, multiple subcommands:

```bash
inpax decompile script.ipo                  # IPO → readable assembly
inpax run script.ipo                        # run an IPO in a terminal TUI
inpax run script.ipo --headless             # headless / log-only

inpax compile script.ips                    # IPS source → IPO bytecode
inpax compile new my-script.ips             # scaffold a starter .ips

inpax edit script.ipo                       # Ink TUI to edit constants
inpax patch init script.ipo                 # emit a starter patch file
inpax patch apply script.ipo script.patch.yaml

inpax bundle ~/inpa                         # zip a BMW install for web tools
inpax bundle init                           # scaffold a .bimmerzignore
```

### From source

```bash
pnpm install
pnpm build

# Run the CLI from the local build
pnpm cli decompile script.ipo
pnpm cli run script.ipo --headless

# Browser runtime (dev server)
pnpm dev:web
# open http://localhost:5173 — pick your INPA install folder, then a script
```

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│ Apps                                                              │
│   apps/cli   single binary — decompile / run / compile / edit /  │
│              patch / bundle                                       │
│   apps/web   browser SPA — canvas runtime + Web Serial            │
├──────────────────────────────────────────────────────────────────┤
│ Dispatcher (packages/dispatcher) — routes ~250 system functions  │
│ to UI / Ediabas / INP1 / external / simulation / print / pem / … │
├──────────────────────────────────────────────────────────────────┤
│ VM + scheduler (packages/interpreter)                            │
│   • main scheduler — ticks screen / state machine / F-key queue  │
│   • screen executor — ALLOC / INIT / LINE phases, cycle:complete │
│   • state-machine executor                                       │
├──────────────────────────────────────────────────────────────────┤
│ Parser (packages/parser)         Compiler (packages/compiler-core)│
│ Disassembler (packages/disassembler)                             │
├──────────────────────────────────────────────────────────────────┤
│ Providers — TuiProvider, EdiabasXProvider, BrowserExternalProvider│
│   Null* providers for unwired surfaces                            │
├──────────────────────────────────────────────────────────────────┤
│ Core (packages/core) — opcodes, block types, system-function ids │
└──────────────────────────────────────────────────────────────────┘
```

## Packages

### Apps

| Package | Description |
|---------|-------------|
| [@emdzej/inpax-cli](./apps/cli) | One binary, six subcommands: `decompile`, `run`, `compile`, `edit`, `patch`, `bundle`. |
| [@emdzej/inpax-web](./apps/web) | Browser SPA — canvas runtime + Web Serial transport. |

> **Heads-up:** the older `@emdzej/inpax-compiler`, `@emdzej/inpax-ipo-editor`, and `@emdzej/bimmerz-bundler` packages have been folded into the single `inpax` CLI. They're being deprecated on npm with a pointer to the new home; existing global installs keep working but should be replaced with `npm i -g @emdzej/inpax-cli`.

### Runtime libraries

| Package | Description |
|---------|-------------|
| [@emdzej/inpax-core](./packages/core) | Opcodes, block types, system-function ids, shared types |
| [@emdzej/inpax-interfaces](./packages/interfaces) | Provider interfaces (UI / Ediabas / INP1 / external / …) |
| [@emdzej/inpax-parser](./packages/parser) | IPO bytecode parser |
| [@emdzej/inpax-disassembler](./packages/disassembler) | IPO → assembly |
| [@emdzej/inpax-compiler-core](./packages/compiler-core) | IPS lexer / parser / codegen — used by `inpax compile` |
| [@emdzej/inpax-interpreter](./packages/interpreter) | BEST/2 VM + screen / state-machine schedulers |
| [@emdzej/inpax-dispatcher](./packages/dispatcher) | System-function router (~250 calls) |
| [@emdzej/inpax-ini-parser](./packages/ini-parser) | INPA/EDIABAS `.ini` reader |
| [@emdzej/inpax-ui-provider-core](./packages/ui-provider-core) | Shared UI provider plumbing |
| [@emdzej/inpax-tui-provider](./packages/tui-provider) | Headless UI state (screen buffer, menu, userboxes, dialogs) |
| [@emdzej/inpax-tui](./packages/tui) | ink-based renderer for the CLI runtime |
| [@emdzej/inpax-cli-provider](./packages/cli-provider) | Headless UI provider (no TTY) |
| [@emdzej/inpax-ediabasx-provider](./packages/ediabasx-provider) | EDIABAS bridge — wraps [ediabasx](https://github.com/emdzej/ediabasx) |
| [@emdzej/inpax-web-provider](./packages/web-provider) | Browser-side UI provider (canvas, F-key bar, dialogs) |
| [@emdzej/inpax-providers](./packages/providers) | Null implementations for unwired provider surfaces |
| [@emdzej/inpax-mock-provider](./packages/mock-provider) | Mock providers for tests |

## Development

```bash
pnpm install          # install workspace deps
pnpm build            # build every package
pnpm typecheck        # tsc across the workspace
pnpm test             # vitest across the workspace
pnpm lint
```

Turborepo orchestrates the per-package scripts; targeted iteration is `pnpm --filter <pkg> <script>`.

Workspace shortcuts:

```bash
pnpm cli <args>       # apps/cli — invokes dist/index.js
pnpm compile          # alias for `pnpm cli compile`
pnpm editor           # alias for `pnpm cli edit`
pnpm dev:web          # apps/web — vite dev server on :5173
pnpm build:web        # apps/web — production bundle
```

## TUI keyboard shortcuts

| Key | Action |
|-----|--------|
| `1`–`9`, `0` | F1–F10 |
| `Shift`+`1`–`0` | F11–F20 |
| `C` | Copy screen to clipboard |
| `P` | Pause / resume |
| `Q` | Quit |

The browser SPA mirrors the same mapping plus mouse clicks on the F-key bar.

## Related projects

- [EdiabasX](https://github.com/emdzej/ediabasx) — sibling BEST/2 interpreter / EDIABAS implementation
- [tisx](https://github.com/emdzej/tisx) — TIS graphics decoder
- [wdsx](https://github.com/emdzej/wdsx) — Wiring Diagram System

## Right to Repair

The [Right to Repair](https://repair.eu) movement advocates for consumers' ability to fix the products they own — from electronics to vehicles — without being locked out by manufacturers through proprietary tools, paywalled documentation, or artificial restrictions.

**I build these tools because I believe repair is a fundamental right, not a privilege.**

Too often, service manuals, diagnostic software, and technical documentation are kept behind closed doors — unavailable to individuals even when they're willing to pay. This wasn't always the case. Products once shipped with schematics and repair guides as standard. The increasing complexity of modern technology doesn't change the fact that capable people exist who can — and should be allowed to — use that information.

These projects exist to preserve access to technical knowledge and ensure that owners aren't left at the mercy of vendors who may discontinue support, charge prohibitive fees, or simply refuse service.

## Support

If you find this project useful, consider [buying me a coffee](https://buymeacoffee.com/emdzej) ☕ or [sponsoring on GitHub](https://github.com/sponsors/emdzej) or if it's your thing: via PayPal

[![Donate with PayPal](https://www.paypalobjects.com/en_US/PL/i/btn/btn_donateCC_LG.gif)](https://www.paypal.com/donate/?business=TDBR3A97PLQRQ&no_recurring=0&item_name=%28emdzej%29&currency_code=PLN)

## License

[PolyForm Noncommercial 1.0.0](./LICENSE) — free for noncommercial use (personal projects, research, education, hobby diagnostics on your own car). Commercial use requires a separate licence — open an issue if you need one.

## Disclaimer

This project is for educational and research purposes only. It is not affiliated with BMW AG.
