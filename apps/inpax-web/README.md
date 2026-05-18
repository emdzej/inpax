# @emdzej/inpax-web

Browser SPA for INPAX — pick an INPA install root, browse `.IPO`
scripts, run them against a live ECU through Web Serial or a remote
WebSocket gateway. Pure client-side, no backend. Deploys to
[inpax.bimmerz.app](https://inpax.bimmerz.app) as a PWA.

## Run locally

From the repo root:

```bash
pnpm dev:web          # Vite dev server on http://localhost:5174
pnpm dev:web:host     # same, but bound to 0.0.0.0 for LAN testing
pnpm build:web        # production build into apps/inpax-web/dist
```

Or directly:

```bash
pnpm --filter @emdzej/inpax-web dev
pnpm --filter @emdzej/inpax-web typecheck
```

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
[`@emdzej/bimmerz-bundler`](../bimmerz-bundler) instead. The zip is
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
