# @emdzej/inpax-compiler

CLI for compiling INPA `.IPS` source files to `.IPO` bytecode. Thin
wrapper around the [`@emdzej/inpax-compiler-core`](../../packages/compiler-core)
library — lexer / parser / semantic / codegen / writer pipeline.

## Install / build

```bash
pnpm --filter @emdzej/inpax-compiler build
```

After build the binary is at `dist/index.js` and registered via `bin`
so `pnpm exec inpax-compile` works inside the workspace. Or invoke
the root-level shortcut from anywhere:

```bash
pnpm compile <input.ips> [options]
pnpm compile:debug <input.ips>     # node --inspect-brk for VS Code attach
```

## Usage

```bash
inpax-compile myscript.ips                  # → myscript.ipo
inpax-compile myscript.ips -o build/        # → build/myscript.ipo
inpax-compile *.ips                         # batch mode
inpax-compile myscript.ips --encoding cp1252
```

The `--encoding cp1252` flag is the right default for legacy BMW
INPA sources written on Windows; UTF-8 is the default when the flag
is omitted.

## Subcommands

- `inpax-compile <file>` — compile one or more `.ips` files.
- `inpax-compile new <name>` — scaffold a starter `.ips` with
  `inpainit` / `inpaexit` / a single screen so a new script
  compiles cleanly.

## CI / validation

The exit code is non-zero on parse / semantic / codegen errors. Pipe
stderr to a logfile and use the standard exit code in CI:

```bash
inpax-compile MY_SCRIPT.IPS 2> compile-errors.log || exit 1
```

## See also

- [`@emdzej/inpax-compiler-core`](../../packages/compiler-core) — the
  underlying pipeline that does the actual work.
- `AGENTS.md` covers the bytecode format,
  [INPACOMP.EXE](../../AGENTS.md#compilation) compatibility notes, and
  the language reference.
