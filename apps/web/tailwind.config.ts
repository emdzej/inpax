import type { Config } from "tailwindcss";
import bimmerzPreset from "@emdzej/bimmerz-theme";

// Token names (bg-base/surface/elevated, text-foreground/muted/faint,
// border-divider/rule, fontFamily.mono) + light/dark behaviour come
// from the shared @emdzej/bimmerz-theme preset. The CSS variables
// they reference are imported into app.css via
// `@import "@emdzej/bimmerz-theme/tokens.css"`.
//
// This config only adds the per-app accent — inpax is blue-500,
// distinct from ediabasx (cyan-500) and ncsx (blue-600). Everything
// else inherits from the preset to keep the bimmerz family visually
// aligned.
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,svelte}",
    // The web-provider library ships Svelte source that uses
    // Tailwind utilities (flex, gap-x-2, …). Tailwind's JIT only
    // emits classes it finds in the content glob, so the library
    // source has to be scanned here too — otherwise its components
    // render unstyled (e.g. FKeyBar stacks vertically because
    // `flex` never made it into the CSS bundle).
    "../../packages/web-provider/src/**/*.{ts,svelte}",
    // Shared UI components from @emdzej/ediabasx-web-ui live in
    // node_modules — Tailwind's JIT needs to scan their source so
    // the utility classes they reference actually get generated.
    "../../node_modules/@emdzej/ediabasx-web-ui/src/**/*.{ts,svelte}",
  ],
  presets: [bimmerzPreset],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "#3b82f6",
          muted: "#1d4ed8",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
