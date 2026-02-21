# @inpax/cli

Command-line interface for INPAX toolchain.

## Installation

```bash
npm install -g inpax
```

## Commands

### `inpax dis <file>`

Disassemble IPO bytecode to readable assembly.

```bash
inpax dis script.ipo
inpax dis script.ipo -o output.asm
```

### `inpax info <file>`

Show IPO file information (header, screens, menus).

```bash
inpax info script.ipo
```

### `inpax run <file>`

Execute IPO file with TUI or headless mode.

```bash
# TUI mode (default)
inpax run script.ipo

# Headless mode
inpax run script.ipo --headless

# Debug mode
inpax run script.ipo --debug
```

Options:
- `-f, --function <name>` — Entry function (default: `inpainit`)
- `-d, --debug` — Enable debug output
- `--trace` — Trace VM execution
- `--headless` — Use CLI provider instead of TUI
- `--sgbd <path>` — Path to SGBD files

### `inpax compile <file>` (WIP)

Compile IPS source to IPO bytecode.

```bash
inpax compile script.ips -o script.ipo
```

## TUI Keyboard Shortcuts

| Key | Action |
|-----|--------|
| 1-0 | F1-F10 |
| Shift+1-0 | F11-F20 |
| C | Copy screen to clipboard |
| P | Pause/Resume |
| Q | Quit |
