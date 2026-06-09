/// <reference types="svelte" />
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Injected by Vite's `define` at build time — see vite.config.ts.
// Always present in any build; declared `const string` so call sites
// can use it without optional-chaining ceremony.
declare const __APP_VERSION__: string;
/**
 * `true` when the SPA was built with `vite --mode embedded` (the
 * dongle scenario — SPA served by the device's HTTP server at
 * `/inpax/`, talks back to the same origin's `/rpc/ediabasx` for
 * IEdiabas dispatches and `/data` for the install VFS). `false`
 * for the regular browser build. Vite's `define` replaces this at
 * build time, so dead code under `if (!__EMBEDDED__)` tree-shakes
 * out of the embedded bundle (and vice versa).
 */
declare const __EMBEDDED__: boolean;
