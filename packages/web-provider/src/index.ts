/**
 * Public surface of `@emdzej/inpax-web-provider`.
 *
 * The package ships Svelte 5 source — consumers compile via their own
 * Vite + `@sveltejs/vite-plugin-svelte`. There's no precompiled
 * `dist/`; the `svelte` and `types` fields in `package.json` point
 * here, and Svelte's resolver picks up the `.svelte` exports directly.
 */

// ─── Provider class ─────────────────────────────────────────────────
export { WebUIProvider } from "./lib/web-ui-provider.svelte.js";

// ─── Theme — palette objects + context API ──────────────────────────
export {
  classicInpaTheme,
  darkInpaTheme,
  paletteColor,
  type InpaTheme,
} from "./lib/theme.js";
export { getLibTheme, setLibTheme } from "./lib/theme-context.svelte.js";

// ─── External / viewer provider ─────────────────────────────────────
// `ViewerState` lives in a sibling .ts file (not the .svelte.ts) so
// Rollup's `.svelte.ts` parser doesn't choke on the type re-export.
export { BrowserExternalProvider } from "./lib/browser-external.svelte.js";
export type { ViewerState } from "./lib/browser-external-types.js";

// ─── ScriptSelect ───────────────────────────────────────────────────
// `loadScriptSelect` covers the common case where the host has a
// `FileSystemDirectoryHandle` for CFGDAT. Hosts whose source isn't a
// directory handle (bundled fixtures, custom asset fetch) call
// `parseScriptSelect` directly and pass the result through their own
// `<ScriptSelectDialog loader={...}>` callback.
export {
  parseScriptSelect,
  loadScriptSelect,
  type ScriptSelectEntry,
  type ScriptSelectNode,
} from "./lib/script-select.js";

// ─── INPA install discovery (FileSystemDirectoryHandle-shaped) ──────
// `discoverInpaInstall` walks the canonical INPA tree (EC-APPS/INPA/
// CFGDAT, SGDAT, EDIABAS/Ecu, EDIABAS/Bin) case-insensitively and
// returns the four subdirectory handles. `isCompleteInstall` is a
// quick gate the UI uses to show a "missing pieces" warning.
// `isFileSystemAccessSupported` is the browser-feature check.
export {
  discoverInpaInstall,
  isCompleteInstall,
  isFileSystemAccessSupported,
  type InpaInstall,
} from "./lib/inpa-install.js";

// ─── IPO file enumeration ───────────────────────────────────────────
export {
  listIpoFiles,
  type IpoEntry,
} from "./lib/ipo-browser.js";

// ─── SGBD loader (`.prg` / `.grp` reader for an Ecu dir handle) ─────
// Drop the returned function into `Ediabas`'s `loadSgbdResolver`
// config slot; it handles both initial loads and the post-IDENT
// .grp → .prg variant swap with case-insensitive matching.
export { makeBrowserSgbdResolver } from "./lib/sgbd-loader.js";

// ─── Native imports provider (BEST2 CALLE shim) ─────────────────────
// Wires INPA's CALLE imports (kernel32 INI / system / strings, api32
// __apiGetConfig, etc.) to the browser. Constructor takes an
// `InpaInstall`; `prefetchIniFiles()` populates the INI cache the
// synchronous CALLE dispatcher needs.
export {
  BrowserNativeImportProvider,
  type BrowserNativeImportConfig,
} from "./lib/native-imports.js";

// ─── Components ─────────────────────────────────────────────────────
export { default as ScreenCanvas } from "./components/ScreenCanvas.svelte";
export { default as FKeyBar } from "./components/FKeyBar.svelte";
export { default as MenuTitleBar } from "./components/MenuTitleBar.svelte";
export { default as DialogOverlay } from "./components/DialogOverlay.svelte";
export { default as UserBoxOverlay } from "./components/UserBoxOverlay.svelte";
export { default as ViewerDialog } from "./components/ViewerDialog.svelte";
export { default as ScriptSelectDialog } from "./components/ScriptSelectDialog.svelte";
export { default as LiveIndicator } from "./components/LiveIndicator.svelte";
export { default as EdiabasBusyIndicator } from "./components/EdiabasBusyIndicator.svelte";
export { default as ScrollIndicator } from "./components/ScrollIndicator.svelte";
