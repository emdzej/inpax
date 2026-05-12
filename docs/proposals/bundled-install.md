# Proposal: import-and-cache INPA install in the browser

**Status:** sketch, not yet scoped.
**Audience:** users without a local INPA install — students, casual
diagnostic users, anyone evaluating inpax-web before committing to
downloading 500 MB of BMW software.

## Problem

inpax-web today requires the user to point the File System Access
picker at a locally-installed INPA tree (`EC-APPS/`, `EDIABAS/Ecu/`).
For someone evaluating the app, downloading + installing BMW INPA
on Windows just to try a browser demo is a non-starter.

## Goal

Let the user supply an INPA tree once as a zip upload; the app
unpacks it into IndexedDB and reads from there on subsequent loads,
so the user gets the same UX as a real local install without the
File System Access picker dance every session.

Explicit non-goal: **we don't host or distribute INPA ourselves.**
The bundle is the user's own data — same legal posture as today,
just a different ingestion path.

## Storage shape

Two viable backends; pick OPFS if available, fall back to IDB:

| Option | Pros | Cons |
| --- | --- | --- |
| **OPFS** (Origin Private File System) | filesystem-like API (`FileSystemFileHandle`); easy to slot in next to the real handle | Chromium-only API surface, slightly less ubiquitous than IDB; same quota source |
| **IndexedDB** | works everywhere; one `files` object store keyed by relative path | manual `getFile()` translation; no native streaming, must blob |

For consistency with the current code path (which everywhere expects
`FileSystemFileHandle`), OPFS is the better target. The fallback to
IDB is only useful if we hit a browser where OPFS misbehaves.

### Quotas (Chromium)

- Per-origin: typically a single-digit-% of free disk, often GBs.
  Measurable at runtime via `navigator.storage.estimate()`.
- Origin group cap: ~60% of free disk total.
- Eviction: non-persistent storage can be evicted under disk
  pressure. Need to call `navigator.storage.persist()` once to flip
  to persistent.

INPA's hot parts (SGDAT / CFGDAT IPOs + EDIABAS/Ecu SGBDs) are well
under 200 MB, so quotas are not the constraint.

## Architecture

Introduce a single `InpaInstallSource` abstraction that the rest of
the app reads through. Two implementations:

```
InpaInstallSource
├── FsAccessInstallSource    // current behaviour, wraps a
│                            // FileSystemDirectoryHandle picked
│                            // by the user
└── BundledInstallSource     // reads from OPFS (or IDB) using the
                             // same shape
```

The interface looks roughly like the existing `InpaInstall`:

```ts
interface InpaInstallSource {
  root:   DirLike;
  ecu?:   DirLike;
  sgdat?: DirLike;
  cfgdat?: DirLike;
}

interface DirLike {
  name: string;
  entries(): AsyncIterable<[string, FileLike | DirLike]>;
  getFile(name: string): Promise<FileLike>;
}

interface FileLike {
  name: string;
  getFile(): Promise<File>;   // matches FileSystemFileHandle.getFile()
}
```

Both `FileSystemFileHandle` and a small OPFS / IDB-backed shim
implement this. Nothing else in the runtime cares which backend it's
talking to — `BrowserNativeImportProvider`, `makeBrowserSgbdResolver`,
and `IpoBrowser.listIpoFiles` all become source-agnostic.

## Import flow

1. **Welcome screen** (`InstallPicker`): two cards instead of one —
   "Pick a folder" (existing path) and "Upload an INPA zip".
2. **Upload card** triggers `<input type="file" accept=".zip">`.
3. **Unzip in-browser**: use a tiny zip library (e.g. `fflate`, ~15 KB
   gzipped) to stream the zip contents. We don't have to hold the
   whole archive in memory.
4. **Write to OPFS**: for each entry, mirror the path into OPFS.
   `EC-APPS/INPA/SGDAT/MS430.IPO` → `<root>/EC-APPS/INPA/SGDAT/MS430.IPO`.
5. **Request persistent storage**: `navigator.storage.persist()` so
   the browser doesn't evict the cache on first disk-pressure event.
6. **Save a marker** in localStorage: `{ source: "bundled", root:
   "<opfs-root-name>", bundledAt: <ts>, bytes: <size> }`. The
   landing screen reads this on mount and skips straight to the
   browse view (same as the existing IndexedDB-handle restore).
7. **Discover install layout** (`discoverInpaInstall`) — already
   tolerant of partial trees, so it works against the OPFS root
   the same way as a real folder.

## UX

- Welcome screen gains "Use a packaged INPA install" affordance.
- File picker accepts `.zip`. While unpacking, show a progress bar
  (entries processed / total entries from `fflate`'s file index).
- After import, the install is "active" identically to a local-FS
  one. Change folder lets the user wipe the OPFS root and re-import
  or pick a real folder.
- Settings gets a "Manage cached install" row showing the bundle's
  size + import date + an "Evict" button.

## Trade-offs

| | FS picker (today) | Bundled (proposed) |
| --- | --- | --- |
| First-load friction | folder picker + permission grant | one-time zip upload |
| Subsequent loads | one re-grant prompt if browser dropped permission | seamless |
| Cross-device | per-device | one zip, copy anywhere |
| Update path | edit the on-disk install | re-import zip |
| Disk usage | shared with OS install | duplicated into browser storage |
| Origin lock-in | none | data is browser-origin scoped — can't share with the desktop INPA app |
| Quota / eviction | not a concern | needs `navigator.storage.persist()` |

## Phasing

1. **VFS abstraction** — refactor everything that takes a
   `FileSystemDirectoryHandle` to take `DirLike`. Zero
   behaviour change. Wrap the current FS-access path as
   `FsAccessInstallSource`.
2. **OPFS backend** — implement `BundledInstallSource` reading from
   OPFS. No UI yet; can be exercised in a unit test or a hidden dev
   flag that pre-seeds OPFS.
3. **Zip import UI** — file input on the landing screen, unzip
   with `fflate`, write to OPFS, request persist. Welcome card
   to switch between local FS and bundled.
4. **Eviction / management** — Settings row that shows usage
   (`navigator.storage.estimate()`), import date, and an "Evict"
   button. Optionally a "Re-import zip" affordance.

Each phase is independently shippable.

## Open questions

- **Update story**: when a user re-imports a newer zip, do we
  diff-and-overlay or replace the whole tree? Probably replace
  — INPA install layouts don't merge cleanly.
- **Per-device sync**: out of scope. If the user wants the same
  setup on a different device, they re-upload the zip.
- **CFGDAT writes**: today we don't write to the install. If a
  future feature needs to (e.g. saving the per-IPO `.ini` UI state
  documented in `research/per-ipo-ini-files.md`), OPFS handles that
  trivially; FS-access does too with `mode: "readwrite"`. Either
  way unified through the VFS abstraction.
- **Compatibility with the FS-access path**: do we let the user
  flip between bundled and FS-access mid-session, or is one
  exclusively active per origin? Simpler is "one active source at
  a time" — settings can swap.

## Out of scope

- Hosting an INPA bundle ourselves. Always user-provided.
- P2P / sync between user devices.
- Partial / streaming load (load IPO + SGBD on demand from a
  remote zip) — possible later, but more complex than the cache-
  everything-locally model.
