import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,svelte}"],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "#f59e0b", // amber — distinguish inpax from ediabasx (cyan)
          muted: "#b45309",
        },
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
