# @emdzej/bimmerz-bundler

CLI tool that curates a BMW software install (INPA / EDIABAS / NCS)
into a small zip web tools — [inpax-web](../inpax-web), and future
ediabasx-web / ncsx — can import into OPFS.

## Why

A real BMW install can be **multiple GB** — most of it executables,
DLLs, help files, label-printer assets, and other content the
browser tools never read. Uploading the whole thing wastes user
time and OPFS quota. This tool walks the install with
gitignore-style filtering so users can produce a zip with just the
content their target tool needs.

Also sidesteps Chrome's [`.ini` File System Access blocklist on
Windows](../../docs/research/chrome-ini-blocklist.md) — anything
that goes into OPFS is readable, regardless of extension.

The CLI is product-agnostic: the same binary serves inpax (INPA
scripts + SGBDs), the future ediabasx-web (just EDIABAS/Bin +
EDIABAS/Ecu), and a future ncsx (NCSEXPER + EDIABAS/Ecu). The
ignore patterns are how you scope to the product you care about.

## Install / build

```bash
pnpm --filter @emdzej/bimmerz-bundler build
```

After build the binary is at `dist/cli.js` and is registered via
`bin` so `pnpm exec bimmerz-bundle` works inside the workspace.

## Quick start

```bash
# 1. Get a starter .bimmerzignore next to your BMW install.
pnpm exec bimmerz-bundle init ~/Downloads/inpa/.bimmerzignore

# 2. Open the file, add product-specific overrides if you want.
${EDITOR:-vi} ~/Downloads/inpa/.bimmerzignore

# 3. Build the bundle.
pnpm exec bimmerz-bundle ~/Downloads/inpa --output ~/inpa-bundle.zip
```

The bundle is the file you upload via the web tool's "Import
bundled install" UI (coming soon).

## Reusing the bundle without a web tool

A bundle is just a standard zip with paths preserved relative to
the install root (`EC-APPS/INPA/SGDAT/MS43.IPO`, `EDIABAS/Ecu/MS43.prg`,
…). Nothing forces you to feed it to a browser — you can also
**extract it back to disk** and use the result as a smaller, curated
copy of the install for any tool that takes a folder path (Tool32,
NCS Expert, the inpax-web "Pick folder" picker, etc.). Round-trip
example:

```bash
bimmerz-bundle ~/Downloads/inpa --output ~/inpa-trimmed.zip
unzip ~/inpa-trimmed.zip -d ~/inpa-trimmed/
# now point INPA / Tool32 / inpax-web at ~/inpa-trimmed
```

## Subcommands

### `bundle <input-dir>` (default)

Walks the install, applies the ignore filter, writes a zip.

| Flag | Meaning |
| --- | --- |
| `-o, --output <file>` | Where the zip lands. Defaults to `./bimmerz-bundle.zip`. |
| `-i, --ignore <file>` | Path to a `.bimmerzignore`. Defaults to `<input-dir>/.bimmerzignore` if it exists. |
| `--no-default-ignore` | Skip the built-in install-junk patterns (only your file applies). |
| `--dry-run` | Walk + match without writing the zip. Prints what would be kept. |
| `--verbose` | Log every kept and skipped file. Slow on full installs; pipe to a file. |

### `init [path]`

Writes the canonical default exclude patterns to disk as a starter
template. `path` defaults to `./.bimmerzignore`.

| Flag | Meaning |
| --- | --- |
| `-f, --force` | Overwrite an existing file (otherwise refuses). |

## Pattern language

Standard gitignore semantics, parsed by the
[`ignore`](https://www.npmjs.com/package/ignore) package. Highlights:

- `*.exe` — match any file whose name ends in `.exe`.
- `Log/` — trailing slash = directory only.
- `**/Pic/` — leading two-star glob = any depth. Matches `Pic/`
  anywhere in the tree.
- `!pattern` — negation. Bring something back that an earlier
  pattern excluded.
- Order matters with negations; later wins.

Matching is **case-insensitive** so `*.exe` catches `INPA.EXE`,
`Inpa.Exe`, and `inpa.exe` alike. This is important — Windows
installs use mixed casing, Linux mirrors may be all lowercase, and
macOS-imported copies sometimes shuffle case in unicode-
normalisation-sensitive paths.

## Defaults shipped

See [`src/default-ignore.ts`](./src/default-ignore.ts) for the
authoritative list. Summary of what's excluded by default — these
apply across INPA / EDIABAS / NCS because they're install-wide junk
(executables, OS files, runtime directories):

- Executables / DLLs / scripts (`*.exe`, `*.dll`, `*.bat`, …)
- Help files (`*.chm`, `*.hlp`, `*.pdf`)
- Backups / temp / OS junk (`*.bak`, `.DS_Store`, `Thumbs.db`)
- Runtime / install-time dirs (`Log/`, `NET/`, `Pic/`, `Server/`,
  `Utils/`, `Setup/`)
- `EDIABAS/Bin/**` except `*.INI` / `*.INIX` (cable cfg files only)

Notable **kept**: `*.ipo`, `*.prg`, `*.grp`, `*.ini`, `*.inix`,
`*.eng`, `*.ger`, `*.cps`, `*.ipx` — i.e. all the things scripts
or NCS tooling actually read.

## Product-specific tightening

Use a project `.bimmerzignore` to narrow what gets bundled:

```
# inpax-web setup (no NCSEXPER, no Doku/Source/Hardware/Api):
NCSEXPER/
EDIABAS/Doku/
EDIABAS/Source/
EDIABAS/Hardware/
EDIABAS/Api/
EDIABAS/HELP/

# Only specific chassis SGBDs:
EDIABAS/Ecu/**.{prg,grp,PRG,GRP}
!EDIABAS/Ecu/MS43*
!EDIABAS/Ecu/EWS*
!EDIABAS/Ecu/AGS*
```

## Dry-run example

```bash
pnpm exec bimmerz-bundle ~/Downloads/inpa --dry-run
```

Sample output:

```
Done.
  kept    : 12469 files (1.72 GB)
  skipped : 287 files
  output  : (dry-run, no zip written)
  elapsed : 0.52s
```

If `kept` is 0 you almost certainly have a too-broad negation in
your `.bimmerzignore`. A bundle warning fires above 500 MB —
tighten the ignore file or pick a narrower input subtree.

## Symlinks / case-collisions

- **Symlinks**: skipped with a `[symlink]` reason in `--verbose`.
  BMW installs don't use them; following risks loops or escaping
  the walk root.
- **Case-colliding entries** (e.g. both `MS43.IPO` and `ms43.ipo`
  in the same dir after a cross-platform sync): both go into the
  zip; the browser-side reader on the OPFS side is already case-
  insensitive everywhere, so first-seen wins.

## Nested ignore files (not yet supported)

Currently the tool reads **one** ignore file (from `--ignore`, or
auto-picked from `<input>/.bimmerzignore`). Per-directory nested
`.bimmerzignore` files like git's nested `.gitignore` aren't
supported yet — the install tree is flat enough that one root file
covers the typical cases. If you have a use case that needs nested
scoping, file an issue.

## What this tool does NOT do

- Doesn't connect to BMW, doesn't read your data — purely a
  local file packaging utility.
- Doesn't validate that the install is "complete" — that's the
  target tool's job (`inpax-web/discoverInpaInstall`, etc.).
- Doesn't ship sample BMW content — the bundle is your own data.
