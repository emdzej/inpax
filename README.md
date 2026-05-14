# inpax

**BMW INPA Interpreter & Toolchain**

Cross-platform reimplementation of BMW INPA (INterface for Programming Applications) — BMW's diagnostic tool for running test procedures on vehicle ECUs.

Three runtimes share the same VM, parser, dispatcher, and provider graph:

- **CLI** — disassemble / inspect / run scripts in a terminal TUI.
- **Web SPA** — pick an INPA install on disk, browse and run `.ipo` scripts in the browser, talk to a real ECU over Web Serial.
- **GUI tools** — IPS → IPO compiler CLI and an interactive `.ipo` constant editor.

## Features

- 📄 **IPO parser** — reads compiled INPA bytecode (`.ipo`).
- 🔧 **Disassembler** — IPO → readable assembly, names jobs/screens/menus.
- ⚙️ **VM + scheduler** — runs INPA bytecode with screen / state-machine / F-key dispatch.
- 🖥️ **TUI runtime** — terminal UI matching the original INPA look (ink-based).
- 🌐 **Browser SPA** — same VM in the browser, paints onto a canvas, talks to ECUs via Web Serial.
- ⌨️ **IPS compiler** — IPS source → IPO bytecode (CLI + library).
- ✏️ **IPO editor** — TUI for editing constants inside compiled `.ipo` files.
- 🔌 **Provider system** — pluggable UI, EDIABAS, INP1, simulation, print, external surfaces.

## Quick Start

```bash
# Install workspace dependencies
pnpm install
pnpm build

# CLI — disassemble / info / run a script
pnpm cli disasm script.ipo
pnpm cli info script.ipo
pnpm cli run script.ipo
pnpm cli run script.ipo --headless

# IPS compiler
pnpm --filter @emdzej/inpax-compiler dev -- compile script.ips -o script.ipo

# IPO constant editor (TUI)
pnpm --filter @emdzej/inpax-ipo-editor dev -- script.ipo

# Browser runtime (dev server)
pnpm --filter @emdzej/inpax-web dev
# open http://localhost:5173 — pick your INPA install folder, then a script
```

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│ Apps & CLIs                                                       │
│   apps/cli            terminal TUI runner — disasm / info / run   │
│   apps/inpax-web      browser SPA — canvas + Web Serial           │
│   apps/inpax-compiler IPS → IPO bytecode compiler CLI             │
│   apps/ipo-editor     ink TUI for editing constants in .ipo files │
├──────────────────────────────────────────────────────────────────┤
│ Dispatcher (packages/dispatcher) — routes ~250 system functions  │
│ to UI / Ediabas / INP1 / external / simulation / print / pem /…  │
├──────────────────────────────────────────────────────────────────┤
│ VM + scheduler (packages/interpreter)                            │
│   • main scheduler — ticks screen / state machine / F-key queue  │
│   • screen executor — ALLOC / INIT / LINE phases, cycle:complete │
│   • state-machine executor                                       │
├──────────────────────────────────────────────────────────────────┤
│ Parser (packages/parser)        Compiler (packages/compiler-core)│
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
| [@emdzej/inpax-cli](./apps/cli) | CLI: disassemble, info, run with TUI / headless |
| [@emdzej/inpax-web](./apps/inpax-web) | Browser SPA — canvas runtime + Web Serial transport |
| [@emdzej/inpax-compiler](./apps/inpax-compiler) | IPS source → IPO bytecode compiler CLI |
| [@emdzej/inpax-ipo-editor](./apps/ipo-editor) | TUI for editing constants in compiled `.ipo` files |

### Runtime libraries

| Package | Description |
|---------|-------------|
| [@emdzej/inpax-core](./packages/core) | Opcodes, block types, system-function ids, shared types |
| [@emdzej/inpax-interfaces](./packages/interfaces) | Provider interfaces (UI / Ediabas / INP1 / external / …) |
| [@emdzej/inpax-parser](./packages/parser) | IPO bytecode parser |
| [@emdzej/inpax-disassembler](./packages/disassembler) | IPO → assembly |
| [@emdzej/inpax-interpreter](./packages/interpreter) | VM, schedulers, screen/state-machine executors |
| [@emdzej/inpax-dispatcher](./packages/dispatcher) | System-function dispatcher |
| [@emdzej/inpax-compiler-core](./packages/compiler-core) | IPS → IPO compilation pipeline (lexer/parser/semantic/codegen/writer) |
| [@emdzej/inpax-ini-parser](./packages/ini-parser) | INPA `.ini` config file parser |
| [@emdzej/inpax-logger](./packages/logger) | Shared structured logger |

### Provider implementations

| Package | Description |
|---------|-------------|
| [@emdzej/inpax-tui-provider](./packages/tui-provider) | Headless UI state (screen buffer, menu, userboxes, dialogs) |
| [@emdzej/inpax-tui](./packages/tui) | ink-based renderer for the CLI runtime |
| [@emdzej/inpax-cli-provider](./packages/cli-provider) | Headless UI provider (no TTY) |
| [@emdzej/inpax-ediabasx-provider](./packages/ediabasx-provider) | EDIABAS bridge — wraps [ediabasx](https://github.com/emdzej/ediabasx) |
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

- [EdiabasX](https://github.com/emdzej/ediabasx) — sibling BEST2 interpreter / EDIABAS implementation
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
