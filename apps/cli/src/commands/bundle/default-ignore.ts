/**
 * Default exclude patterns shipped with `bimmerz-bundle`.
 *
 * Written as a single string so it doubles as:
 *
 *   1. The built-in filter layer (applied unless `--no-default-ignore`).
 *   2. The starting template the `init` subcommand writes to disk
 *      (`.bimmerzignore` next to the user's install) so the user can
 *      edit + extend before running a bundle.
 *
 * The format is gitignore-spec — parsed by the `ignore` npm package,
 * supports `**`, `!negation`, directory-only matches with trailing
 * `/`, etc. Matching is case-insensitive (Windows installs use mixed
 * casing, Linux / macOS exports may be all lowercase) — we set
 * `ignorecase: true` when constructing the matcher.
 *
 * Notable kept-by-default file types (NOT excluded here):
 *
 *   - `*.ipo`, `*.IPO`        — script content
 *   - `*.prg` / `*.grp` (any case)  — SGBDs
 *   - `*.ini` / `*.INI` / `*.INIX`  — config (`scriptselect` reads
 *                                    INPA.INI; INPAapiInit reads
 *                                    EDIABAS.INI)
 *   - `*.ENG` / `*.GER`        — language INIs `scriptselect` reads
 *
 * If you add new patterns: gitignore semantics treat `pattern/` as
 * "directory only", `pattern` as "file or dir". A leading two-star
 * glob (followed by a slash) means "any depth".
 */
export const DEFAULT_IGNORE = `# bimmerz-bundle default exclude patterns
#
# Edit and re-bundle to suit your install. Anything not matched here
# (or by a user-supplied .bimmerzignore) is kept. Matching is case-
# insensitive so \`*.exe\` catches \`INPA.EXE\` and \`Inpa.Exe\`.
#
# This file works the same way for INPA, NCS, EDIABAS — the defaults
# below trim install-wide junk (executables, OS files, runtime dirs)
# that's common across BMW tooling. Add product-specific allowlist
# patterns in the project-specific section at the bottom.

# ---- Executables / system binaries ----
*.exe
*.dll
*.so
*.bat
*.cmd
*.ps1
*.com
*.sys
*.drv
*.lib

# ---- Help / docs (not script content) ----
*.chm
*.hlp
*.pdf
*.html
*.htm
*.txt
*.rtf
*.doc
*.docx

# ---- Backups / temp / lock files ----
*.bak
*.tmp
*.old
*.lck
*.~*
~$*
*.swp

# ---- OS / IDE junk ----
.DS_Store
Thumbs.db
desktop.ini
*.lnk

# ---- INPA runtime / install-time dirs we never read ----
# Trailing slash = directory-only match; **/ = any depth.
**/Log/
**/Logs/
**/NET/
**/Pic/
**/Server/
**/Utils/
**/Setup/
**/UNINSTALL/

# ---- Bin/ in EDIABAS: keep INI(X), drop everything else ----
# A whitelist island — first exclude wide, then negate the bits we
# want. The negation order matters; \`!\` after the broader rule
# brings the file back.
EDIABAS/Bin/**
!EDIABAS/Bin/
!EDIABAS/Bin/EDIABAS.INI
!EDIABAS/Bin/EDIABAS.INIX
!EDIABAS/Bin/*.ini
!EDIABAS/Bin/*.INI
!EDIABAS/Bin/*.INIX

# ---- EC-APPS that aren't INPA ----
# Keep only EC-APPS/INPA. Everything else under EC-APPS is unused
# by inpax (Tool32, NCS, etc.). Uncomment if your zip should
# include the lot.
# EC-APPS/!(INPA)/

# ---- Project-specific overrides ----
# Add your own patterns below. Examples:
#
#   # Only keep E46 / E60 / E90 SGBDs:
#   EDIABAS/Ecu/**.{prg,grp,PRG,GRP}
#   !EDIABAS/Ecu/MS43*
#   !EDIABAS/Ecu/MS45*
#   !EDIABAS/Ecu/MSV70*
#   !EDIABAS/Ecu/MSV80*
#   !EDIABAS/Ecu/EWS*
#   !EDIABAS/Ecu/AGS*
#
#   # Or strip language packs you don't need:
#   EC-APPS/INPA/CFGDAT/*.GER
`;
