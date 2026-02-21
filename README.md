# inpax

**BMW INPA Interpreter & Toolchain**

Cross-platform reimplementation of BMW INPA (INterface for Programming Applications) - BMW's diagnostic tool for running test procedures on vehicle ECUs.

## Features

- 📄 **IPO Parser** — Parse compiled INPA bytecode (.ipo files)
- 🔧 **Disassembler** — Decompile IPO to readable assembly
- 🖥️ **TUI Runtime** — Terminal UI matching original INPA look
- ⌨️ **IPS Compiler** — Compile source scripts (WIP)
- 🔌 **Provider System** — Pluggable UI and EDIABAS backends

## Installation

```bash
npm install -g inpax
```

## Quick Start

```bash
# Disassemble IPO file
inpax dis script.ipo

# Show file info
inpax info script.ipo

# Run with TUI
inpax run script.ipo

# Run headless
inpax run script.ipo --headless
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        CLI                               │
│                    (@inpax/cli)                          │
├─────────────────────────────────────────────────────────┤
│      TUI Provider       │       CLI Provider            │
│  (@inpax/tui-provider)  │   (@inpax/cli-provider)       │
├─────────────────────────┴───────────────────────────────┤
│                    TUI Renderer                          │
│                     (@inpax/tui)                         │
├─────────────────────────────────────────────────────────┤
│                     Interpreter                          │
│                 (@inpax/interpreter)                     │
├─────────────────────────────────────────────────────────┤
│     IPO Parser      │      EDIABAS Provider             │
│  (@inpax/parser)    │     (via @inpax/interfaces)       │
├─────────────────────┴───────────────────────────────────┤
│                    Core Types                            │
│                    (@inpax/core)                         │
└─────────────────────────────────────────────────────────┘
```

## Packages

| Package | Description |
|---------|-------------|
| [@inpax/cli](./packages/cli) | Command-line interface |
| [@inpax/core](./packages/core) | Constants, opcodes, types |
| [@inpax/interfaces](./packages/interfaces) | Provider interfaces |
| [@inpax/parser](./packages/parser) | IPO bytecode parser |
| [@inpax/disassembler](./packages/disassembler) | IPO → assembly |
| [@inpax/interpreter](./packages/interpreter) | VM execution |
| [@inpax/compiler](./packages/compiler) | IPS → IPO compiler |
| [@inpax/tui](./packages/tui) | Terminal UI (ink) |
| [@inpax/tui-provider](./packages/tui-provider) | TUI state management |
| [@inpax/cli-provider](./packages/cli-provider) | Headless UI provider |
| [@inpax/mock-provider](./packages/mock-provider) | Mock providers for testing |
| [@inpax/ini-parser](./packages/ini-parser) | INPA config file parser |

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run CLI in dev mode
pnpm cli <command>

# Run tests
pnpm test
```

## TUI Keyboard Shortcuts

| Key | Action |
|-----|--------|
| 1-0 | F1-F10 |
| Shift+1-0 | F11-F20 |
| C | Copy screen to clipboard |
| P | Pause/Resume |
| Q | Quit |

## Related Projects

- [EdiabasX](https://github.com/emdzej/ediabasx) — EDIABAS implementation
- [tisx](https://github.com/emdzej/tisx) — TIS graphics decoder
- [wdsx](https://github.com/emdzej/wdsx) — Wiring Diagram System

## License

MIT

## Disclaimer

This project is for educational and research purposes only. It is not affiliated with BMW AG.
