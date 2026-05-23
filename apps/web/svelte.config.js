import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

export default {
  preprocess: vitePreprocess(),
  compilerOptions: {
    // Force runes mode globally. Svelte 5 falls back to legacy mode for
    // components that don't *visibly* use runes in their <script>, which
    // breaks reactivity on `$state` mutations made via stores defined in
    // a sibling .svelte.ts file. Forcing runes everywhere keeps the
    // reactivity model consistent.
    runes: true,
  },
};
