# @emdzej/inpax-web-provider

Svelte 5 UI provider, browser primitives, and reusable components for
embedding the INPA runtime in a web app. Pairs with
`@emdzej/inpax-interpreter`, `@emdzej/inpax-dispatcher`,
`@emdzej/inpax-ediabasx-provider`, and a transport of your choice
(Web Serial via `@emdzej/ediabasx-interface-serial`, or a remote
WebSocket gateway via `@emdzej/ediabasx-interfaces/client`).

What's in the box:

### UI provider

- **`WebUIProvider`** — concrete `UIProvider` subclass for the browser.

### Components

- **`ScreenCanvas`** — canvas-based renderer for the BEST2 screen
  buffer (cell grid + analog gauges + digital LEDs + sized text
  overlays).
- **`FKeyBar`** — F1–F10 input bar with native + digit-fallback key
  routing.
- **`MenuTitleBar`** — menu title display.
- **`DialogOverlay`** — text / number / hex / digital / connect input
  modals.
- **`UserBoxOverlay`** — `userbox` opcode overlay.
- **`ViewerDialog`** — `viewopen` modal, backed by
  `BrowserExternalProvider`.
- **`ScriptSelectDialog`** — `scriptselect` picker. Takes a `loader`
  prop so the dialog stays host-agnostic; pair with `loadScriptSelect`
  for the common CFGDAT-directory case.
- **`LiveIndicator`** — green pulsing dot for cyclic screens (the
  `setscreen(handle, true)` case — "this screen is on a refresh cycle").
- **`EdiabasBusyIndicator`** — amber pulsing dot that lights up whenever
  the EDIABAS bridge has any `INPAapi*` async call in flight (init /
  end / job / fsLesen / fsLesen2). Subscribes to the
  `busy:changed` event on `IEdiabasProvider`. Complementary to
  `LiveIndicator`: green = screen-level refresh, amber = per-call ECU
  I/O. Both can be lit simultaneously.
- **`ScrollIndicator`** — pagination hint when a SCREEN has more LINE
  blocks than the viewport.

### Browser primitives

These wrap the File System Access API (or OPFS — same handle shape)
so any inpax-style web app gets the same INPA-aware behaviour without
re-implementing the walks.

- **`discoverInpaInstall(root)`** — walks the canonical INPA layout
  (`EC-APPS/INPA/CFGDAT`, `SGDAT`, `EDIABAS/Ecu`, `EDIABAS/Bin`)
  case-insensitively, returns the four subdirectory handles.
- **`isCompleteInstall(install)`** — true when CFGDAT / SGDAT / Ecu
  are all resolved.
- **`isFileSystemAccessSupported()`** — feature gate for the picker
  UI (Chromium-only as of 2026).
- **`listIpoFiles(dir, origin)`** — enumerate `.ipo` entries in a
  directory handle, sorted, with the origin label preserved.
- **`makeBrowserSgbdResolver(ecuDir)`** — build the
  `loadSgbdResolver` callback Ediabas uses for both initial loads and
  the post-IDENT `.grp → .prg` variant swap.
- **`BrowserNativeImportProvider`** — concrete `INativeImportProvider`
  for browser hosts. Wires INPA's CALLE imports (`kernel32` INI /
  system / strings, `api32 __apiGetConfig`, …) to the picked directory
  handle. Call `prefetchIniFiles()` once during runtime setup so the
  synchronous CALLE dispatcher hits cache.
- **`BrowserExternalProvider`** — concrete `IExternalProvider` for
  `viewopen` / `viewclose`. Pairs with `ViewerDialog`.

### Scriptselect

- **`parseScriptSelect(content)`** — pure parser for `.ENG` / `.GER`
  / `.CPS` catalogue files into a navigable tree.
- **`loadScriptSelect(cfgdat, filename)`** — case-insensitive lookup
  + read via a `FileSystemDirectoryHandle`. Drop into
  `<ScriptSelectDialog loader={...}>` directly.

## Theme

Components read their colour palette from a Svelte context. Set it
once at the root of your app:

```svelte
<script>
  import { setLibTheme, classicInpaTheme, darkInpaTheme } from "@emdzej/inpax-web-provider";

  $effect(() => {
    setLibTheme(isDark ? darkInpaTheme : classicInpaTheme);
  });
</script>
```

If no context is set, components fall back to `classicInpaTheme`.

## Paint coalescing

`ScreenCanvas` accepts an `onFrameReady` prop — a subscribe function
that takes a callback and returns an unsubscribe. Wire it to the
runtime's `cycle:complete` event so paints fire on full SCREEN cycle
boundaries instead of per-cell writes. Without it the canvas falls
back to a free `requestAnimationFrame` loop.

## Putting it together

A minimal embedding looks roughly like this (omitting cable transport
setup for brevity — that lives in `@emdzej/ediabasx-interface-serial`
or `@emdzej/ediabasx-interfaces/client`):

```svelte
<script lang="ts">
  import {
    WebUIProvider,
    BrowserExternalProvider,
    BrowserNativeImportProvider,
    discoverInpaInstall,
    listIpoFiles,
    makeBrowserSgbdResolver,
    loadScriptSelect,
    setLibTheme,
    classicInpaTheme,
    ScreenCanvas,
    FKeyBar,
    DialogOverlay,
    ViewerDialog,
    ScriptSelectDialog,
  } from "@emdzej/inpax-web-provider";

  // 1. Install discovery
  const root = await showDirectoryPicker();
  const install = await discoverInpaInstall(root);

  // 2. Theme
  setLibTheme(classicInpaTheme);

  // 3. Providers
  const ui = new WebUIProvider();
  const external = new BrowserExternalProvider();
  const native = new BrowserNativeImportProvider({ install });
  await native.prefetchIniFiles();

  // 4. Ediabas + runtime — see @emdzej/inpax-interpreter docs for the rest
  //    Pass `makeBrowserSgbdResolver(install.ecu)` as `loadSgbdResolver`.
</script>

<ScreenCanvas screen={ui.screenBuffer} {ui} onFrameReady={runtime.onFrame} />
<FKeyBar {ui} />
<DialogOverlay {ui} />
<ViewerDialog {external} />
<ScriptSelectDialog
  {ui}
  loader={(name) => loadScriptSelect(install.cfgdat!, name)}
/>
```

## Why a Svelte 5 source package

The package ships its `.svelte` and `.ts` files directly — no build
step. Consumer apps already use Vite with `@sveltejs/vite-plugin-svelte`
and compile per-app, so a separate compile step here would duplicate
work and produce identical output. Add `@sveltejs/package` later if
you need to publish standalone artifacts to npm.

### Consumer tsconfig + Vite setup

Three settings the host app's tsconfig / vite config / tailwind
config needs because of how the source is shipped:

- **`tsconfig.json`: `verbatimModuleSyntax: false`.** Svelte's
  `.svelte.ts` module parser rejects the `type` keyword in import
  specifiers — TS elides type-only imports automatically when this
  flag is off.
- **`vite.config.ts`: don't add this package to `optimizeDeps.include`.**
  Vite's pre-bundling step uses esbuild which doesn't run the Svelte
  plugin's TS preprocessor; `.svelte.ts` files fail to parse there.
  Leaving it out routes the package through the main transformation
  pipeline (which does include the plugin).
- **`tailwind.config.ts`: scan the library's source.** Tailwind's JIT
  only emits classes it finds in the `content` glob. Add
  `"<path-to>/packages/web-provider/src/**/*.{ts,svelte}"` to the
  glob so utilities used inside library components end up in the CSS
  bundle. (Without it, e.g. `FKeyBar` stacks vertically because
  `flex` never made it in.)
