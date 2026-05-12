# Per-IPO `.ini` files (INPA UI-state persistence)

INPA keeps a sibling `.ini` next to each `.ipo` in `EC-APPS/INPA/SGDAT/`
(and `CFGDAT/` for entry-point scripts). The filename matches the
IPO basename: `MS430.IPO` → `MS430.ini`. It's the script's
**per-script persistent UI state** — written by INPA as the user
navigates the script, read back on the next launch.

## What's in it

Two section kinds (real example from `inpa/EC-APPS/INPA/SGDAT/MS430.ini`):

### `[SCREEN_<screen_name>]` — one per SCREEN block

```
[SCREEN_s_pwg_mdk]
SelectSetCount=0
[SCREEN_s_vanos_lage]
SelectSetCount=0
...
```

Stores the user's choice in any multi-select control on that screen.
`SelectSetCount=N` plus `SelectSet{1..N}=<id>` lines when non-zero.
On startup INPA replays those so the user's view is restored.

`SelectSetCount=0` everywhere = pristine state, user hasn't tweaked
any analog/digital selection set yet.

### `[OBT_SCREEN]` — screen inventory

```
[OBT_SCREEN]
ScreenCount=41
Screen1=s_ls_heizung
Screen2=slp_systemtest
Screen3=tev_systemtest
…
Screen41=s_info
```

Inventory of every SCREEN block in the IPO with its name. Two
purposes:

1. Look screens up by index when restoring SelectSet state.
2. Cheap "did the IPO get recompiled?" check — if the IPO's
   actual screen list no longer matches `[OBT_SCREEN]`, the cached
   state is stale and INPA can throw it out.

## What it is NOT

| File                            | Role                                                    |
| ------------------------------- | ------------------------------------------------------- |
| `CFGDAT/INPA.INI`               | Global INPA config (language, paths, …).                |
| `CFGDAT/<install>.ENG / .GER`   | Script-select tree per language. Already wired in inpax-web. |
| `ATRCSettings.ini`              | Trace + viewer path (per FUN_0042fcb1 in INPA.exe).     |
| **`<IpoName>.ini`** (this doc)  | **Per-script UI state**, written by INPA at runtime.    |

So this file is closer to a JetBrains `*.iml` or VS Code's
`.vscode/state.json` than user-facing configuration. It's never
something a user would hand-edit.

## When INPA touches it

- **Read**: at SCREEN-block initialisation. INPA looks up the
  `[SCREEN_<name>]` section for the screen it's about to render
  and applies the saved SelectSet choices.
- **Write**: at SCREEN-block disposal (or via explicit "save
  state" paths in some scripts). The new SelectSet state is
  flushed back through `WritePrivateProfileStringA`.

Note: `GetPrivateProfileStringA` calls from `inpainit` (which
inpax-web already routes through `BrowserNativeImportProvider`) do
NOT read this file — `inpainit` is reading `INPA.INI` for global
config. The per-script `.ini` is only touched by the SCREEN
lifecycle, which doesn't currently go through any of our INI
plumbing.

## Implications for inpax-web

We don't persist any of this today — each session starts with no
SelectSet history. Acceptable for the diagnostic use case where
people are running scripts to see live data, not setting up
custom views.

If we ever want this:

- Natural storage: the `inpax.web.settings.v1` localStorage bucket
  we already use for `startupIpo` / `sidebarCollapsed`. Add a
  `screenState: Record<string /* ipoName */, Record<string /*
  screenName */, { setCount: number; sets: string[] }>>` field.
- Wire-up: hook the SCREEN executor's `init` / `dispose`
  callbacks. On `init`, read from settings and seed the SelectSet
  state. On `dispose`, write the current SelectSet state back.
- Invalidation: optional. If we ever support recompiling IPOs in
  the browser, mirror INPA's `[OBT_SCREEN]` integrity check.

Lowest priority — none of the BMW INPA workflows users actually
run hinge on persisting view state across sessions.
