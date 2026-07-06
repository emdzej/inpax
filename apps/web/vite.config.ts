import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { VitePWA } from "vite-plugin-pwa";

// Surface package.json version in the app UI without bundling the
// whole manifest. Vite's `define` replaces the identifier at build
// time, so the production bundle just contains the string literal
// (e.g. "0.3.1"). The dev server picks up changes on Vite restart.
const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf8")
) as { version: string };

/**
 * Build modes:
 *
 *   • `pnpm web:build` — default. Full browser SPA: install picker
 *     (FSA + bundled + remote), mode toggle, settings, PWA service
 *     worker, persisted config. Deployed to inpax.bimmerz.app etc.
 *
 *   • `pnpm web:build:embedded` — dongle build. The SPA is hosted by
 *     the dongle itself (ESP32-P4) at `/inpax/`, talking back to the
 *     same origin for IEdiabas + install:
 *       - `__EMBEDDED__` is `true` (compile-time constant).
 *       - Mode / connection method / server URL locked to client +
 *         direct + `${origin}/rpc/ediabasx` (see `lib/embedded.ts`).
 *       - Install auto-mounts from `${origin}/data` over HTTP VFS on
 *         boot — picker is skipped, mounting state never persists.
 *       - Settings hide Mode + Server + Connect + InstallPicker
 *         panels.
 *       - PWA service worker dropped (no internet on the dongle, no
 *         autoUpdate noise on hardware the user doesn't manage).
 *     Persisted logging level + theme + UI prefs ride along normally.
 *
 * The two outputs live side-by-side: `dist/` and `dist-embedded/`.
 */
export default defineConfig(({ mode }) => {
  const isEmbedded = mode === "embedded";
  return {
  /* Embedded build is mounted at `/inpax/` on the dongle — the
     firmware serves multiple apps (`/ediabasx/`, `/inpax/`,
     `/ncsx/`, `/nfsx/`) under one HTTP root, with `/rpc/ediabasx`
     and `/data/` as siblings at `/`. Vite rewrites all asset URLs
     + the SPA fallback to that prefix. Default browser build stays
     at `/`. */
  base: isEmbedded ? "/inpax/" : "/",
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __EMBEDDED__: JSON.stringify(isEmbedded),
  },
  plugins: [
    svelte(),
    /* Bimmerz Box app manifest. The dongle's dashboard auto-discovers
       apps under `/sdcard/apps/<slug>/` and reads each folder's
       `manifest.json` to render a tile — see
       https://github.com/emdzej/bimmerz-box#app-manifest. Emitting
       from the plugin (not a static file in `public/`) keeps the
       `version` field in lockstep with package.json without a manual
       bump on every release. Only relevant to the embedded build. */
    isEmbedded && {
      name: "inpax-embedded-manifest",
      apply: "build" as const,
      generateBundle(): void {
        this.emitFile({
          type: "asset",
          fileName: "manifest.json",
          source: JSON.stringify(
            {
              name: "INPAX",
              description: "BMW INPA scripts in the browser — .IPO runner over K-line & CAN",
              version: pkg.version,
              icon: "icon.svg",
              /* Advisory — the dashboard flags tiles whose requirements
                 aren't met by the dongle hardware. Inpax needs the
                 K-line transceiver to drive the diagnostic bus; the
                 install VFS is bundled with the SPA at build time so
                 no additional capability tag is needed. */
              requires: ["kline"],
            },
            null,
            2,
          ) + "\n",
        });
      },
    },
    // PWA — generates a Web App Manifest, registers a service worker
    // that precaches the build output, and gives users an "install"
    // affordance on Chromium / Edge. The SW is regenerated on every
    // build, scoped to "/" (the deploy root at inpax.bimmerz.app).
    //
    // `registerType: "autoUpdate"` means new builds replace the
    // running SW silently after the next reload (no user prompt) —
    // appropriate for a sync-to-deploy diagnostic tool where stale
    // bundles can be surprising. Swap to `"prompt"` if we want a
    // user-controlled refresh later.
    //
    // `workbox.maximumFileSizeToCacheInBytes` is bumped because the
    // inpax-web bundle is currently ~750 KB minified (mostly the
    // VM + ediabasx interpreter) and Workbox's default 2 MB cap
    // would refuse to precache it on bundles that grow.
    //
    // Skipped in the embedded build — see top-of-file comment.
    !isEmbedded && VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "icon.svg",
        "favicon.ico",
        "apple-touch-icon-180x180.png",
      ],
      manifest: {
        name: "INPAX",
        short_name: "INPAX",
        description:
          "BMW INPA in the browser — run diagnostic scripts against a live ECU over Web Serial.",
        // Match the in-app accent blue (#3b82f6) so the splash screen
        // and Android theme bar pick up the brand colour.
        theme_color: "#3b82f6",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        scope: "/",
        // Icon set generated by `pnpm pwa-assets` (see
        // `pwa-assets.config.ts`). Filenames must match the
        // generator's output; if you re-run the generator, update
        // this list too.
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
          { src: "icon.svg", sizes: "any", type: "image/svg+xml" },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        // Vite + SPA fallback so direct-URL navigation works offline.
        navigateFallback: "/index.html",
      },
    }),
  ],
  server: {
    port: 5174, // 5173 is ediabasx-web's port — sidestep so both can run
  },
  // Workspace packages compile to CommonJS-ish ESM (`tsconfig.base.json`
  // is `module: NodeNext` with no `"type": "module"` in package.jsons),
  // and Rollup's named-import analyzer trips over `Object.defineProperty`
  // exports unless we include them in `commonjsOptions`. `optimizeDeps`
  // makes Vite's dev-server pre-bundle them too so the dev/build paths
  // behave identically. Mirrors `ediabasx/apps/web/vite.config.ts`.
  optimizeDeps: {
    include: [
      "@emdzej/inpax-core",
      "@emdzej/inpax-parser",
      "@emdzej/inpax-interpreter",
      "@emdzej/inpax-dispatcher",
      "@emdzej/inpax-interfaces",
      "@emdzej/inpax-ui-provider-core",
      // Intentionally NOT in optimizeDeps: `@emdzej/inpax-web-provider`
      // ships `.svelte.ts` source files. esbuild (Vite's pre-bundler)
      // doesn't run the svelte plugin's TS preprocessor, so it choke on
      // TS-specific syntax. Leaving the package out of the include
      // list lets Vite's main transformation pipeline (which DOES
      // include the svelte plugin) handle it on-demand.
      "@emdzej/inpax-ediabasx-provider",
      "@emdzej/inpax-ini-parser",
      "@emdzej/bimmerz-logger",
      "@emdzej/ediabasx-ediabas",
      // Browser-safe subpath: pulls in `GatewayClient` only, skipping
      // the gateway server (which statically requires `node:net` /
      // `node:http` / `ws` and would break the bundle). Mirrors the
      // pattern ediabasx/apps/web uses.
      "@emdzej/ediabasx-interfaces/client",
      "@emdzej/ediabasx-interface-base",
      "@emdzej/ediabasx-interface-serial",
    ],
    /* `@emdzej/bimmerz-ui` ships source-only `.svelte` + `.svelte.ts`.
       Same reasoning as the `inpax-web-provider` exclusion above —
       esbuild pre-bundling doesn't run the svelte plugin's TS
       preprocessor, so `.svelte.ts` rune helpers (like
       `useEmbeddedAutoConnect`) trip on `interface` / type-only
       syntax. Excluding routes them through vite-plugin-svelte's
       transform on-demand. */
    exclude: ["@emdzej/bimmerz-ui"],
  },
  build: {
    /* Separate output for the embedded build — firmware packagers
       ship dist-embedded/ as static assets at the dongle's `/inpax/`
       prefix. Default build still goes to dist/ for the hosted
       deployment. */
    outDir: isEmbedded ? "dist-embedded" : "dist",
    /* Drop sourcemaps on the dongle — flash is precious. */
    sourcemap: !isEmbedded,
    commonjsOptions: {
      include: [/node_modules/, /packages\//],
      transformMixedEsModules: true,
    },
    /* Embedded build drops the PWA plugin (no offline cache benefit
       on a dongle with no internet, autoUpdate is confusing on
       hardware the user doesn't manage). The dynamic
       `import("virtual:pwa-register")` in main.ts is gated behind
       `if (!isEmbedded)` and tree-shakes out, but Rollup still
       resolves the virtual specifier statically — fails because the
       PWA plugin (which provides the virtual module) isn't loaded.
       Mark it external so Rollup leaves the unreachable call site
       alone. */
    rollupOptions: isEmbedded
      ? { external: ["virtual:pwa-register"] }
      : undefined,
  },
  };
});
