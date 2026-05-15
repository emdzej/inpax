# @emdzej/inpax-cli

Terminal interface for the inpax toolchain — **disassemble**,
**inspect**, and **run** INPA `.IPO` scripts. Same VM that powers
the [browser SPA](../inpax-web); same parser the
[ipo-editor](../ipo-editor) reuses for patching.

For compiling `.IPS` source into `.IPO` bytecode see the dedicated
[**`@emdzej/inpax-compiler`**](../inpax-compiler) app — that's its own
binary and lives outside this CLI.

## Install

```bash
npm i -g @emdzej/inpax-cli
```

Provides the `inpax` binary on your PATH.

## Commands

### `inpax disasm <file>`

Disassemble an IPO into readable assembly with named opcodes,
resolved constants, and synthesised jump labels.

```bash
inpax disasm RADIO.IPO                       # whole file to stdout
inpax disasm RADIO.IPO -o radio.asm          # to a file
inpax disasm RADIO.IPO -f inpainit           # one function only
inpax disasm RADIO.IPO --no-color --no-raw   # plain, no per-instruction hex
```

| Flag | Description |
|---|---|
| `-o, --output <file>` | Write to a file instead of stdout |
| `-f, --function <name>` | Disassemble one specific function |
| `--no-color` | Disable ANSI colour |
| `--no-raw` | Hide the raw 4-byte hex per instruction |
| `--no-comments` | Hide inline comments (constant resolution, etc.) |
| `--no-labels` | Don't synthesise `Lnn:` labels for jump targets |

### `inpax info <file>`

Header summary: version, function / screen / menu / state-machine
counts, constants count, dependencies. Useful as a first look before
disassembling.

```bash
inpax info RADIO.IPO                  # summary
inpax info RADIO.IPO --functions      # also list every function
inpax info RADIO.IPO --strings        # also dump string constants
inpax info RADIO.IPO --hex            # hex dump of the file header
```

| Flag | Description |
|---|---|
| `--functions` | List every function with id and instruction count |
| `--strings` | Dump every string constant with its index |
| `--hex` | Hex dump of the IPO header |

### `inpax run <file>`

Execute an IPO in a terminal TUI that reproduces real INPA's
cell-grid screen — F-key menu, user-box dialogs, analog gauges,
digital LED indicators, the lot. Or run headless for logs-only use.

```bash
# Standard run, TUI mode
inpax run MS43.IPO

# Headless — no TUI, log-only. Useful for tests / scripted use.
inpax run MS43.IPO --headless

# With a real cable + the install's SGBD directory
inpax run MS43.IPO --sgbd ~/Downloads/inpa/EDIABAS/Ecu

# Pin an ediabasx config (overrides --sgbd; sets baud, interface, etc.)
inpax run MS43.IPO --ediabas-config ./inpax.config.json

# Mock provider — develop without a real car
inpax run MS43.IPO --mock

# Debug + VM instruction trace
inpax run MS43.IPO --debug --trace

# Slower tick (default is 16 ms ≈ 60 Hz)
inpax run MS43.IPO --tick 100
```

| Flag | Default | Description |
|---|---|---|
| `-f, --function <name>` | `inpainit` | Entry function to invoke |
| `-d, --debug` | off | Enable debug-level logging |
| `--trace` | off | Trace every VM instruction (very verbose) |
| `--headless` | off | Use the CLI provider — no TTY required |
| `--sgbd <path>` | — | Directory containing `.PRG` / `.GRP` files for the live ECU |
| `--ediabas-config <path>` | — | Path to an `ediabas.config.json` — sets cable, baud, ECU paths in one shot; overrides `--sgbd` |
| `--mock` | off | Use the in-process mock provider (no real car needed) |
| `--tick <ms>` | `16` | Scheduler tick interval in milliseconds |

#### TUI keymap (run mode)

| Key | Action |
|---|---|
| `1`–`9`, `0` | F1–F10 |
| `Shift`+`1`–`0` | F11–F20 |
| `↑` / `↓` / PgUp / PgDn / Home / End | Scroll between LINE blocks (paginated screens) |
| `C` | Copy current screen to clipboard |
| `P` | Pause / resume the scheduler |
| `Q` | Quit |

## Related tools

- **[@emdzej/inpax-compiler](https://github.com/emdzej/inpax/tree/main/apps/inpax-compiler)** —
  IPS source → IPO bytecode compiler. The other half of the toolchain;
  install separately if you need to compile.
- **[@emdzej/inpax-ipo-editor](https://github.com/emdzej/inpax/tree/main/apps/ipo-editor)** —
  interactive TUI for editing constants in a compiled `.IPO`, plus a
  patch-file system for distributing translations and overrides without
  shipping modified IPOs. `npm i -g @emdzej/inpax-ipo-editor`.
- **[inpax-web](https://github.com/emdzej/inpax/tree/main/apps/inpax-web)** —
  same VM in the browser, paints onto a canvas, talks to a K+DCAN cable
  via Web Serial. No install — try at <https://inpax.bimmerz.app>.
- **[ipo-community-patches](https://github.com/emdzej/ipo-community-patches)** —
  community-contributed patch files (translations, label corrections)
  that apply via `ipo-editor`.

## Development

```bash
pnpm --filter @emdzej/inpax-cli build      # tsc
pnpm --filter @emdzej/inpax-cli dev        # tsc --watch
```

Inside the workspace, `pnpm cli <subcommand>` runs the local build —
`pnpm cli disasm script.ipo` works identically to `inpax disasm
script.ipo` once installed.

## License

[PolyForm Noncommercial 1.0.0](../../LICENSE) — free for personal,
research, and hobby use. Commercial use needs a separate licence.
