# @emdzej/inpax-cli

The full inpax toolchain in a single binary. **Decompile**, **run**,
**compile**, **edit**, **patch**, and **bundle** — all behind one
`inpax` command on your `PATH`.

Same VM that powers the [browser SPA](../web). Same parser used to
patch constants. Same compiler used to turn `.IPS` source into `.IPO`
bytecode.

> **Heads-up:** as of inpax 0.6.8 the older `@emdzej/inpax-compiler`,
> `@emdzej/inpax-ipo-editor`, and `@emdzej/bimmerz-bundler` binaries are
> folded into this CLI. Replace
> `npm i -g @emdzej/inpax-compiler` etc. with
> `npm i -g @emdzej/inpax-cli`; the old packages are deprecated on npm.

## Install

```bash
npm i -g @emdzej/inpax-cli
inpax --help
```

## Commands

| Command | Purpose |
|---|---|
| `inpax decompile <file>` | Print BEST/2 bytecode as readable assembly. |
| `inpax run <file>` | Execute an `.ipo` in a terminal TUI or headless mode. |
| `inpax compile <files…>` | IPS source → IPO bytecode. |
| `inpax compile new <file>` | Scaffold a starter `.ips` with `inpainit`/`inpaexit` stubs. |
| `inpax edit <file>` | Open an Ink TUI to edit constants in a compiled `.ipo`. |
| `inpax patch init <file>` | Emit a starter YAML patch listing the IPO's current constants. |
| `inpax patch apply <file> <patch…>` | Apply one or more YAML patches to an `.ipo`. |
| `inpax bundle <input-dir>` | Walk an INPA / EDIABAS / NCS install, apply `.bimmerzignore`, write a zip. |
| `inpax bundle init` | Scaffold a starter `.bimmerzignore`. |

Run any subcommand with `--help` for the full flag list.

### `inpax decompile`

Decompile an IPO into readable assembly with named opcodes, resolved
constants, and synthesised jump labels.

```bash
inpax decompile RADIO.IPO                       # whole file to stdout
inpax decompile RADIO.IPO -o radio.asm          # to a file
inpax decompile RADIO.IPO -f inpainit           # one function only
inpax decompile RADIO.IPO --no-color --no-raw   # plain, no per-instruction hex
```

| Flag | Description |
|---|---|
| `-o, --output <file>` | Write to a file instead of stdout |
| `-f, --function <name>` | Decompile one specific function |
| `--no-color` | Disable ANSI colour |
| `--no-raw` | Hide the raw 4-byte hex per instruction |
| `--no-comments` | Hide inline comments (constant resolution, etc.) |
| `--no-labels` | Don't synthesise `Lnn:` labels for jump targets |

### `inpax run`

Execute an IPO in a terminal TUI that reproduces real INPA's cell-grid
screen — F-key menu, user-box dialogs, analog gauges, digital LED
indicators, the lot. Or run headless for logs-only use.

```bash
inpax run MS43.IPO                              # TUI mode (default)
inpax run MS43.IPO --headless                   # log-only

# Talk to a real ECU
inpax run MS43.IPO --sgbd ~/Downloads/inpa/EDIABAS/Ecu

# Pin a complete ediabasx config (overrides --sgbd)
inpax run MS43.IPO --ediabas-config ./inpax.config.json

# Develop without a real car
inpax run MS43.IPO --mock

# Debug + VM instruction trace
inpax run MS43.IPO --debug --trace
```

| Flag | Default | Description |
|---|---|---|
| `-f, --function <name>` | `inpainit` | Entry function to invoke |
| `-d, --debug` | off | Enable debug-level logging |
| `--trace` | off | Trace every VM instruction (very verbose) |
| `--headless` | off | Use the CLI provider — no TTY required |
| `--sgbd <path>` | — | Directory containing `.PRG` / `.GRP` files for the live ECU |
| `--ediabas-config <path>` | — | Path to an `ediabas.config.json` — overrides `--sgbd` |
| `--mock` | off | Use the in-process mock provider (no real car needed) |
| `--tick <ms>` | `16` | Scheduler tick interval |

#### TUI keymap

| Key | Action |
|---|---|
| `1`–`9`, `0` | F1–F10 |
| `Shift`+`1`–`0` | F11–F20 |
| `↑` / `↓` / PgUp / PgDn / Home / End | Scroll between LINE blocks (paginated screens) |
| `C` | Copy current screen to clipboard |
| `P` | Pause / resume the scheduler |
| `Q` | Quit |

### `inpax compile`

Compile INPA IPS source into IPO bytecode. Output drops next to each
input by default; pass `-o` for a single file or a target directory in
batch mode.

```bash
inpax compile RADIO.IPS                         # → RADIO.IPO
inpax compile *.ips -o build/                   # batch → build/<name>.ipo
inpax compile foo.ips -I ./headers -e cp1250    # custom include path + encoding

inpax compile new my-script.ips --title "Demo"  # scaffold starter .ips
```

| Flag | Description |
|---|---|
| `-o, --output <path>` | Output file (single input) or output directory (batch) |
| `-I, --include <dir>` | Add directory to the `#include` search path. Repeatable. |
| `-e, --encoding <name>` | Source-file encoding (default `cp1252`; e.g. `cp1250`, `utf-8`) |
| `--continue` | Keep going after one file fails |
| `-v, --verbose` | Extra info to stderr |

### `inpax edit`

Open an Ink TUI for editing constants in a compiled `.ipo`. Optional
codepage override for non-Latin-1 installs (`cp1250` for Polish,
`cp1252` for German).

```bash
inpax edit MS43.IPO
inpax edit MS43.IPO --codepage cp1250            # Polish install
inpax edit MS43.IPO --readonly                   # browse only
inpax edit MS43.IPO --no-backup                  # don't write .bak on save
```

| Flag | Description |
|---|---|
| `--codepage <name>` | Codepage for string decode/encode (default `cp1252`) |
| `--no-backup` | Don't write `<file>.bak` on save |
| `--allow-ffi` | Edit strings that look like FFI descriptors |
| `--readonly` | View only — no edits or save |

### `inpax patch`

Non-interactive workflow for distributing translations / overrides
without shipping modified IPOs. `init` snapshots the current
constants into a YAML file; humans edit the YAML; `apply` writes the
edits back to the IPO with checksum verification.

```bash
# Snapshot the IPO's string constants into a starter patch
inpax patch init MS43.IPO --types string --output ms43.patch.yaml

# Apply one or more patches; dry-run first to see what changes
inpax patch apply MS43.IPO ms43.patch.yaml --dry-run
inpax patch apply MS43.IPO ms43.patch.yaml -o MS43.translated.ipo
```

The patch format is small enough to hand-edit; see the
[ipo-community-patches](https://github.com/emdzej/ipo-community-patches)
repo for examples.

### `inpax bundle`

Curate a BMW software install (INPA / EDIABAS / NCS) into a small zip
the web tools can mount into OPFS. `.bimmerzignore` patterns work like
`.gitignore` and are matched case-insensitively.

```bash
# One-shot
inpax bundle ~/inpa -o inpa-bundle.zip

# Custom ignore + dry-run preview
inpax bundle ~/inpa -i my-ignore --dry-run --verbose

# Scaffold the default ignore file to edit
inpax bundle init
inpax bundle ~/inpa -i .bimmerzignore -o inpa-bundle.zip
```

| Flag | Description |
|---|---|
| `-o, --output <file>` | Output zip path (default `./bimmerz-bundle.zip`) |
| `-i, --ignore <file>` | Gitignore-style file (default `<input>/.bimmerzignore` if present) |
| `--no-default-ignore` | Skip the built-in install-junk patterns |
| `--dry-run` | Walk + match but don't write the zip |
| `--verbose` | Log every kept and skipped file |

## Logging

Powered by [`@emdzej/bimmerz-logger`](https://github.com/emdzej/bimmerz/tree/main/packages/logger).
The library never reads `process.env`; the CLI translates env vars
into the central logger config at boot.

| Variable | Values | Effect |
|---|---|---|
| `INPAX_LOG_LEVEL` | `trace\|debug\|info\|warn\|error\|fatal\|silent` | Default level |
| `INPAX_LOG_CATEGORIES` | `cat=lvl,cat=lvl,…` | Per-category overrides (hierarchical) |
| `INPAX_LOG_DESTINATION` | path | Write to file instead of stdout |
| `INPAX_LOG_FORMAT` | `pretty\|json` | Output format |

Examples:

```bash
# Everything to debug
INPAX_LOG_LEVEL=debug inpax run MS43.IPO --trace

# Just the VM dispatcher + state machine
INPAX_LOG_CATEGORIES="INPAX.vm=trace,INPAX.state-machine-executor=debug" \
  inpax run MS43.IPO

# JSON output to file
INPAX_LOG_FORMAT=json INPAX_LOG_DESTINATION=/tmp/inpax.log \
  inpax run MS43.IPO
```

Categories: hierarchical dot-paths — a rule for `INPAX` covers every
subcategory unless overridden. Current set: `INPAX`, `INPAX.vm`,
`INPAX.dispatcher`, `INPAX.internal-functions`, `INPAX.main-scheduler`,
`INPAX.screen-executor`, `INPAX.state-machine-executor`,
`INPAX.signature-handler`, `INPAX.ui-provider`, `INPAX.interpreter-cli`.

The web app's Settings dialog has the same surface plus the
`EDIABASX.*` categories from `@emdzej/ediabasx-ediabas` — see
[`@emdzej/bimmerz-logger`'s README](https://github.com/emdzej/bimmerz/tree/main/packages/logger)
for the full API.

## Development

```bash
pnpm --filter @emdzej/inpax-cli build   # tsc
pnpm --filter @emdzej/inpax-cli dev     # tsc --watch
```

Inside the workspace, `pnpm cli <subcommand>` runs the local build:
`pnpm cli decompile script.ipo` is identical to running the installed
binary.

Workspace aliases also exist for the most-used subcommands:

```bash
pnpm compile script.ips      # = pnpm cli compile script.ips
pnpm editor script.ipo       # = pnpm cli edit script.ipo
```

## Related

- [@emdzej/inpax-web](../web) — same VM in the browser, paints onto a
  canvas, talks to a K+DCAN cable via Web Serial. Live at
  <https://inpax.bimmerz.app>.
- [ipo-community-patches](https://github.com/emdzej/ipo-community-patches) —
  community-contributed patch files (translations, label corrections)
  that apply via `inpax patch apply`.

## License

[PolyForm Noncommercial 1.0.0](../../LICENSE) — free for personal,
research, and hobby use. Commercial use needs a separate licence.
