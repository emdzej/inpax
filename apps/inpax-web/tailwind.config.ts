import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,svelte}"],
  // Class-based dark mode so the theme switcher can toggle by toggling
  // a `dark` class on <html>. App.svelte writes that class based on
  // the user's chosen theme (light / dark / system).
  darkMode: "class",
  theme: {
    extend: {
      // Tailwind's Preflight defaults `border-color` to `gray-200` — a
      // light grey that looks fine in light mode but renders as a stark
      // bright line against our dark surfaces. Override the default so
      // a bare `class="border"` (no explicit colour) follows the theme,
      // matching what `border-divider` does explicitly elsewhere.
      borderColor: {
        DEFAULT: "rgb(var(--theme-border-subtle) / <alpha-value>)",
      },
      colors: {
        accent: {
          // Tailwind blue-500 / blue-700. Visually distinct from
          // ediabasx-web's cyan accent while keeping the same step
          // ratio (DEFAULT for highlights, muted for hover/pressed).
          DEFAULT: "#3b82f6",
          muted: "#1d4ed8",
        },
        // Semantic theme tokens, driven by CSS variables defined in
        // app.css. Components reference these (e.g. `bg-surface`,
        // `text-foreground`) so toggling the variable values in
        // `:root` vs `.dark` flips the whole UI without per-component
        // class swaps.
        //
        //   bg-base         page / canvas background
        //   bg-surface      cards, panels, sidebar
        //   bg-elevated     hover, dropdowns, raised elements
        //   border-divider  subtle separators
        //   border-rule     strong separators (form fields, etc.)
        //   text-foreground primary text
        //   text-muted      secondary text
        //   text-faint      tertiary text
        base: "rgb(var(--theme-bg) / <alpha-value>)",
        surface: "rgb(var(--theme-surface) / <alpha-value>)",
        elevated: "rgb(var(--theme-elevated) / <alpha-value>)",
        divider: "rgb(var(--theme-border-subtle) / <alpha-value>)",
        rule: "rgb(var(--theme-border-strong) / <alpha-value>)",
        foreground: "rgb(var(--theme-text-primary) / <alpha-value>)",
        muted: "rgb(var(--theme-text-secondary) / <alpha-value>)",
        faint: "rgb(var(--theme-text-muted) / <alpha-value>)",
      },
      fontFamily: {
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
