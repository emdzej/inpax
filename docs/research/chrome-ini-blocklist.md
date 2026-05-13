# Chrome's File System Access API hides `.ini` files

When inpax-web reads a real INPA install on **Windows** via Chrome's
File System Access API, iteration of a granted directory (`for await
const [name, entry] of dir.entries()`) **silently skips `.ini` files**.
The files exist on disk and are readable by every other tool — Chrome
just won't expose them to web pages.

This is by design: Chrome has a blocklist of "sensitive file types"
that the File System Access API filters from iteration to protect
users from web pages snooping credentials and host config (think
`.env`, password databases, …). `.ini` is on that list. The blocklist
is **enforced at iteration time**, not at picker time, and there is
no escape hatch from web code.

## How we discovered it

User reported `EDIABAS.INI not found in Bin/` warnings on Windows
Chrome. Windows Explorer (`dir *.ini` in cmd) listed nine `.ini`
files in `C:\EDIABAS\Bin\`. The diagnostic we added to
`cacheIniFile` then revealed the smoking gun:

```
EDIABAS.INI not found in Bin/ — nearby: (none);
  INI files: (none) (54 entries total)
```

Chrome returned 54 entries — all the `.exe`, `.dll`, `.xml`, `.lib`,
`.chm` files came through fine. The nine `.ini` files were filtered
out. The user then created a copy with a different extension:

```
EDIABAS.INI not found in Bin/ — nearby: EDIABAS.INIX;
  INI files: (none) (55 entries total)
```

`.INIX` is **not** on the blocklist — visible immediately.

## The workaround

Ask the user to **copy** (or rename) their `.INI` files to `.INIX`
on disk:

```
C:\EDIABAS\Bin\EDIABAS.INI       →  EDIABAS.INIX
C:\EC-APPS\INPA\CFGDAT\INPA.INI  →  INPA.INIX
```

Then `cacheIniFile` (in `apps/inpax-web/src/lib/native-imports.ts`)
falls back to the `.INIX` variant when the `.INI` lookup misses,
parses it, and stores it in the in-memory INI cache under the
**canonical `.ini`** cache key. The BEST2 scripts continue to call
`GetPrivateProfileStringA(section, key, default, "INPA.INI")` and
get the right data; they never see the `.INIX` rename.

Copy (not rename) is the safer instruction — keeps the original
`.INI` in place for Windows-native INPA / Tool32 / EDIABAS itself.

## Why we don't try to defeat the blocklist

We can't. The filter lives in the browser's File System Access
backend; web code can't see what got filtered, can't ask Chrome to
expose it, can't `getFileHandle()` it directly (the entry doesn't
exist as far as the API is concerned).

## Alternatives we considered

1. **`showOpenFilePicker` per-file** — the explicit per-file picker
   doesn't filter by extension at iteration time (because it's not
   iterating), so the user could grant `INPA.INI` directly. Friction:
   the user has to do this every time the directory permission is
   re-granted, and we'd need two extra picker steps in onboarding.
2. **Hard-coded defaults** — ship a stand-in `INPA.INI` with the
   keys that BMW scripts care about (`[INFO] VERSION=5.06`, the
   path keys). Works for most scripts but breaks anything that
   reads a real customised value (rare but possible).
3. **OPFS-backed bundled install** — see
   `docs/proposals/bundled-install.md`. Importing INPA as a zip into
   OPFS sidesteps the blocklist entirely because OPFS uses a
   different API surface that Chrome trusts (origin-private,
   not user-facing). Long-term right answer; bigger refactor.

The `.INIX` rename is the lowest-friction path for users who have a
real Windows INPA install and just want to use inpax-web today.

## Verification matrix

Confirmed on:
- Chrome 132, Windows 11 — `.ini` filtered, `.inix` allowed.

Likely on (not yet tested):
- Edge (Chromium) on Windows.
- Brave / Opera / other Chromium derivatives.

Not affected:
- macOS / Linux Chrome — the blocklist exists per-platform but
  generally only kicks in for paths Chrome considers user-sensitive;
  the `.ini` family in BMW INPA's macOS-ported install layout has
  worked through iteration in our tests.
- Firefox / Safari — these don't ship the File System Access API
  yet anyway; inpax-web requires Chromium.
