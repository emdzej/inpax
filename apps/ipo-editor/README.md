# @emdzej/inpax-ipo-editor

Terminal UI for editing constants in compiled INPA `.ipo` files, plus a
patch system for distributing changes (translations, overrides) without
shipping the modified IPO itself.

## What it does

INPA scripts (`.IPO`) carry their string literals, numeric constants,
and other compile-time values in a **constant data block**. Translating
a script's UI labels, swapping in different default thresholds, or
correcting a typo doesn't require recompiling from `.IPS` source —
those bytes can be rewritten in place.

This tool gives you three ways to do that:

1. **TUI editor** — interactive, browse-and-edit with filters,
   keyboard navigation, undo, and per-string codepage handling.
2. **Patch `init`** — dump an IPO's constants into a human-readable
   YAML file ready for a translator to edit.
3. **Patch `apply`** — apply one or more patch files to an IPO with
   SHA-256 verification, type-checking, and conflict resolution.

## Install / build

```bash
pnpm --filter @emdzej/inpax-ipo-editor build
```

After build the binary is at `dist/index.js` and is registered via
`bin`, so `pnpm exec ipo-editor` works inside the workspace.

## Commands

### `ipo-editor edit <file>` (default)

Open a `.ipo` in the TUI for interactive editing. Works without a
subcommand — `ipo-editor RADIO.IPO` is shorthand for
`ipo-editor edit RADIO.IPO`.

```bash
pnpm exec ipo-editor RADIO.IPO

# Read-only browse
pnpm exec ipo-editor RADIO.IPO --readonly

# Different codepage (e.g. files that were edited under cp1250)
pnpm exec ipo-editor RADIO.IPO --codepage cp1250

# No .bak file on save
pnpm exec ipo-editor RADIO.IPO --no-backup
```

#### TUI keymap (list mode)

| Key | Action |
|---|---|
| `↑` / `↓` / `j` / `k` | Move cursor |
| `PgUp` / `PgDn` | Page |
| `g` / `G` | Jump to first / last |
| `/` | Substring filter |
| `t` | Cycle type filter (all → string → number → bool) |
| `m` | Show modified only |
| `Enter` | Edit current constant |
| `u` / `U` | Undo / undo all |
| `s` | Save (overwrites the `.ipo`) |
| `P` | **Save edits as a patch (`<file>.patch.yaml`)** |
| `q` | Quit |
| `?` | Toggle help |

### `ipo-editor patch init <file>`

Emit a starter patch file containing every (filtered) constant from
the IPO. The translator opens the YAML, changes `value:` fields, and
hands the patch back.

```bash
# Default: only string constants, no notes
pnpm exec ipo-editor patch init RADIO.IPO -o radio.patch.yaml

# Include numeric constants too
pnpm exec ipo-editor patch init RADIO.IPO --types string,int,real -o radio.patch.yaml

# Add per-entry hints (offset / byte length info)
pnpm exec ipo-editor patch init RADIO.IPO --with-notes -o radio.patch.yaml

# Stamp install-tree + description metadata
pnpm exec ipo-editor patch init RADIO.IPO \
  --location inpa \
  --description 'Polish translation of MS43 status screens' \
  -o radio-pl.patch.yaml
```

Options:

| Flag | Default | Description |
|---|---|---|
| `-o, --output <path>` | `<file>.patch.yaml` | Output path |
| `--input-encoding <name>` | `cp1252` | Codepage used to decode IPO strings |
| `--target-encoding <name>` | `cp1252` | Codepage strings will be encoded into when applied |
| `--types <list>` | `string` | Comma-separated: `bool`, `byte`, `int`, `long`, `real`, `string` |
| `--with-notes` | off | Add per-entry offset / length notes |
| `--location <name>` | `unknown` | Install-tree tag (`inpa`, `nfs`, `ncsexpert`, …) |
| `--description <text>` | — | Free-form description carried in the patch |

### `ipo-editor patch apply <file> <patch>…`

Apply one or more patches to an IPO. Verifies each patch's SHA-256
against the actual IPO (override with `--ignore-checksum`), refuses
on type mismatches (never overridable — that would corrupt bytes),
and decides how to handle overlapping entries via `--on-conflict`.

```bash
# Single patch, overwrites the source IPO
pnpm exec ipo-editor patch apply RADIO.IPO radio-pl.patch.yaml

# Apply to a fresh copy
pnpm exec ipo-editor patch apply RADIO.IPO radio-pl.patch.yaml -o RADIO-pl.IPO

# Multiple patches in one go (e.g. translation + threshold overrides)
pnpm exec ipo-editor patch apply RADIO.IPO \
  radio-pl.patch.yaml \
  radio-thresholds.patch.yaml \
  -o RADIO-pl-tuned.IPO

# Dry run — verify and report what would change, write nothing
pnpm exec ipo-editor patch apply RADIO.IPO radio-pl.patch.yaml --dry-run

# Last-wins overlap (e.g. you want a later patch to override an earlier one)
pnpm exec ipo-editor patch apply RADIO.IPO base.patch.yaml override.patch.yaml \
  --on-conflict last-wins

# Apply a stale patch anyway (file changed since the patch was made)
pnpm exec ipo-editor patch apply RADIO.IPO old.patch.yaml --ignore-checksum
```

Options:

| Flag | Default | Description |
|---|---|---|
| `-o, --output <path>` | overwrite input | Output IPO path |
| `--dry-run` | off | Verify + report only, write nothing |
| `--ignore-checksum` | off | Apply even if checksum mismatches (warns) |
| `--on-conflict <policy>` | `refuse` | `refuse` (error on overlap) or `last-wins` |
| `--input-encoding <name>` | `cp1252` | Codepage to decode source IPO |
| `--output-encoding <name>` | patch's `target_encoding` | Override the patch's declared encoding |

## Patch file format

YAML, UTF-8, one document per file:

```yaml
inpax_patch_version: 1
original:
  name: RADIO.IPO
  location: inpa
  checksum:
    algorithm: sha256
    value: 8b3edfee580000ac8b71b79660daf2cdb922e4ab511ab82bd77def28b89e3341
target_encoding: cp1252
description: |
  Polish translation of MS43 status screens
created_at: 2026-05-15T07:21:26.402Z
patches:
  - index: 13
    type: string
    value: Hauptmenü
    notes: |
      const[13] in inpainit, top of main menu
  - index: 15
    type: string
    value: Info
```

The `original.checksum` stamps the IPO this patch was generated
against. When multiple patches target the same IPO, every patch's
expected checksum must match the *current* input file (so all
patches were authored against the same base — order of application
doesn't matter for the checksum gate).

Type mismatches are **never** overridable: a patch claiming `type: string`
applied to an `int` constant would silently corrupt the file. Apply
refuses such patches.

## Common workflows

### Translation

```bash
# 1. Generate a starter patch listing every string in the IPO.
pnpm exec ipo-editor patch init RADIO.IPO --with-notes -o radio-pl.patch.yaml

# 2. Hand the YAML to a translator. They change `value:` fields; the
#    `notes:` lines tell them where each string lives.

# 3. Apply the result to a fresh copy.
pnpm exec ipo-editor patch apply RADIO.IPO radio-pl.patch.yaml -o RADIO-pl.IPO
```

### TUI edit → patch (preferred for ad-hoc fixes)

```bash
# 1. Open the IPO in the TUI, make changes interactively.
pnpm exec ipo-editor RADIO.IPO

# 2. Inside the TUI: press `P` to export edits as RADIO.IPO.patch.yaml.
#    The original .ipo is untouched.

# 3. Apply later, on this or another machine.
pnpm exec ipo-editor patch apply RADIO.IPO RADIO.IPO.patch.yaml -o RADIO-edited.IPO
```

### Layered overlays

```bash
# Base translation + a small override that fixes one term
pnpm exec ipo-editor patch apply RADIO.IPO \
  base-de.patch.yaml \
  fix-typo.patch.yaml \
  --on-conflict last-wins \
  -o RADIO-fixed.IPO
```

## Encoding caveat

Real INPA.exe **always** reads `.ipo` string constants as cp1252,
because the IPO format has no embedded encoding marker. If you set
`target_encoding` to anything other than `cp1252` (e.g. `cp1250` for
Polish characters), the patcher will:

- Encode bytes correctly per your declared encoding,
- Warn loudly at both `init` and `apply` time,
- Produce a file that **stock INPA misrenders** (it'll read your
  cp1250 bytes as cp1252 — `ł` becomes `³`, `ó` becomes `ó`, etc.).

Our own runtime (`inpax-web`, `inpax-cli`) can read non-cp1252 IPOs
with `--input-encoding cp1250`, but stock INPA can't. The full
explanation lives in
[`docs/research/ipo-encoding.md`](../../docs/research/ipo-encoding.md).

For practical purposes: **keep `target_encoding` at `cp1252` unless
you're consciously targeting our forked runtime**.

## Development

```bash
pnpm --filter @emdzej/inpax-ipo-editor build      # tsc
pnpm --filter @emdzej/inpax-ipo-editor test       # vitest (46 tests)
pnpm --filter @emdzej/inpax-ipo-editor dev        # tsc --watch
```

Patch logic + tests live under `src/patch/`. The TUI lives under
`src/components/`. They share `src/lib/walker.ts` (IPO parser),
`src/lib/codepage.ts` (encoding helpers) and `src/lib/save.ts`
(byte-preserving writer).
