import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte()],
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
      "@emdzej/inpax-tui-provider",
      "@emdzej/inpax-ediabasx-provider",
      "@emdzej/inpax-ini-parser",
      "@emdzej/inpax-logger",
      "@emdzej/ediabasx-ediabas",
      "@emdzej/ediabasx-interfaces",
      "@emdzej/ediabasx-interface-base",
      "@emdzej/ediabasx-interface-serial",
    ],
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/, /packages\//],
      transformMixedEsModules: true,
    },
  },
});
