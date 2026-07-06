# @emdzej/inpax-web

Browser SPA for INPAX — pick an INPA install root, browse `.IPO`
scripts, run them against a live ECU through Web Serial or a remote
WebSocket gateway. Pure client-side, no backend. Deploys to
[inpax.bimmerz.app](https://inpax.bimmerz.app) as a PWA.

## Run locally

From the repo root:

```bash
pnpm web              # Vite dev server on http://localhost:5174
pnpm build:web        # production build into apps/web/dist
```

Or directly:

```bash
pnpm --filter @emdzej/inpax-web dev
pnpm --filter @emdzej/inpax-web typecheck
```

## Embedded build (dongle-hosted)

The `embedded` mode targets the [Bimmerz Box](https://github.com/emdzej/bimmerz-box)
dongle scenario, where this SPA is served by the dongle itself at
`http://172.16.7.1/inpax/` alongside the `ediabasx-server` process
that owns the K-line / CAN cable and the HTTP-VFS install tree at
`/data/`. The build differs from the default browser build in four ways:

- **Connection is locked to the dongle** — `mode: client`,
  `connectionMethod: direct`, `serverUrl: ${origin}/rpc/ediabasx`, and
  the install auto-mounts from `${origin}/data` on boot. No install
  picker, no mode toggle.
- **Auto-connect on open** — the `useEmbeddedAutoConnect` hook from
  `@emdzej/bimmerz-ui` opens the RPC session once the install has
  mounted (readiness gate: `app.install !== null`), retries with
  exponential backoff on transient drops (1 → 2 → 4 → 8 → 16 → 30 s
  cap), and disconnects cleanly on `beforeunload` / `pagehide`. The
  manual Connect button is still rendered but is a fallback path.
- **No PWA / service worker** — the dongle has no internet, precache +
  autoUpdate flows are noise on a device the user doesn't manage.
  Source-maps are stripped and the base path is rewritten to `/inpax/`.
- **Bimmerz Box `manifest.json`** — a small Vite plugin emits
  `dist-embedded/manifest.json` (name, description, version pulled
  from `package.json`, icon, hardware requirements) so the dongle
  dashboard auto-discovers the app and renders a tile. Schema is
  documented in [bimmerz-box's App manifest section](https://github.com/emdzej/bimmerz-box#app-manifest).

```bash
pnpm build:web:embedded          # → apps/web/dist-embedded/
pnpm preview:web:embedded        # serve dist-embedded/ locally on :4173
# → http://localhost:4173/inpax/  (note the /inpax/ prefix)
```

Ship `dist-embedded/` to the dongle's HTTP root under `/inpax/`. The
Bimmerz Box firmware picks it up from `/sdcard/apps/inpax/` — see
[`bimmerz-box`](https://github.com/emdzej/bimmerz-box) for the exact
layout and OTA / SD-card upload paths.

Release builds attach `inpax-web-embedded-<version>.zip` to the GitHub
Release so dongle packagers can drop the zip straight onto the SD
card without cloning + building the monorepo.

## What's in the app

The app is the thin orchestration layer around the reusable
`@emdzej/inpax-web-provider` library. Everything that's BMW-INPA-aware
about the rendering — the canvas, the F-key bar, the screen executor's
result overlays, the install discovery, the SGBD resolver — lives in
the library. The app itself owns:

- **Welcome / install picking** (`InstallPicker.svelte`) — File System
  Access folder pick or bundled-zip import into OPFS.
- **Sidebar** (`IpoSidebar.svelte`) — searchable list of `.ipo` files
  under SGDAT / CFGDAT.
- **Runner orchestration** (`IpoRunner.svelte`) — mounts the runtime
  for the selected script, hosts the library's canvas + F-key bar,
  passes the install handles into the loader props.
- **Settings modal** (`ConfigPanel.svelte`) — connection (Web Serial
  vs WebSocket gateway), install storage (folder vs OPFS bundle),
  developer toggles.
- **Connect modal** (`ConnectDialog.svelte`) — script-driven
  `INPAapiInit` gate that opens the cable inside a user gesture
  (Web Serial requirement).
- **Theme toggle** (`ThemeToggle.svelte`).

## Browser support

Chromium-only by design: requires both the File System Access API
(for the install picker) and Web Serial (for the local cable). Firefox
and Safari users see an "unsupported browser" banner.

The remote-gateway path (`@emdzej/ediabasx-interfaces/client` via a
`ws://` / `wss://` URL) sidesteps the Web Serial requirement, so a
remote browser can drive a cable running behind `ediabasx gateway`
on the workshop machine.

## Bundled installs (OPFS)

If `showDirectoryPicker` is awkward (e.g. Chrome's `.ini` blocklist
on Windows), the user can drop in a zip produced by
[`inpax bundle`](../cli/README.md#inpax-bundle) instead. The zip is
streamed into OPFS and exposed through the same
`FileSystemDirectoryHandle` shape downstream consumers expect —
no separate code path.

## PWA

`vite-plugin-pwa` with `registerType: "autoUpdate"` precaches the
build output and serves an SPA fallback for `/index.html`. New builds
silently activate after the next reload (no user-facing refresh
prompt — keep version bumps user-visible by relying on the
`__APP_VERSION__` pill in the header).

## See also

- [`@emdzej/inpax-web-provider`](../../packages/web-provider) — the
  reusable rendering library this app consumes.
- [`AGENTS.md`](../../AGENTS.md#repository-orientation) — workspace
  map, release workflow, known gotchas.
