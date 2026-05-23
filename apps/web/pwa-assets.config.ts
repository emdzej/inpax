import {
  defineConfig,
  minimal2023Preset,
} from "@vite-pwa/assets-generator/config";

/**
 * Source for all generated PWA icons. The asset generator reads
 * `public/icon.svg`, produces favicon.ico, apple-touch-icon.png,
 * pwa-192x192.png, pwa-512x512.png, and the maskable variant; all
 * written back into `public/` and referenced from the manifest in
 * vite.config.ts. Run with `pnpm pwa-assets` (added as a script
 * below); the output is committed so we don't depend on `sharp`
 * being present in the CI deploy environment.
 */
export default defineConfig({
  preset: minimal2023Preset,
  images: ["public/icon.svg"],
});
