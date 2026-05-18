/**
 * Renderer themes — palette, font, cell metrics.
 *
 * Palette per the authoritative INPA convention (BMW utility headers,
 * matches `docs/reference/ui-system.md#color-values`):
 *
 *   0  C_WHITE       8  C_YELLOW
 *   1  C_BLACK       9  C_BROWN       (dark yellow)
 *   2  C_GREY       10  C_GREEN
 *   3  C_DARK_GREY  11  C_DARK_GREEN
 *   4  C_RED        12  C_CYAN
 *   5  C_DARK_RED   13  C_TEAL
 *   6  C_MAGENTA    14  C_BLUE
 *   7  C_PURPLE     15  C_DARK_BLUE
 *
 * Two themes ship: `classicInpaTheme` reproduces the Win95-era INPA
 * workshop look (white field, black text); `darkInpaTheme` inverts
 * the structural axis (0 / 1 / 2 / 3 — field/text/greys) while
 * lifting the semantic accents (red / yellow / green / blue) into a
 * range that stays readable on a dark slate background. Tailwind's
 * 400–600 ramp so canvas glyphs visually agree with surrounding
 * app chrome.
 *
 * Tradeoff: scripts that explicitly call `setcolor(C_WHITE, C_BLACK)`
 * to draw a "highlighted note" effect render as dark-on-light in the
 * dark theme — visually opposite to their intent. Rare in practice;
 * most scripts use the default pair `(C_BLACK, C_WHITE)` which flips
 * correctly.
 */

export interface InpaTheme {
  /** 16 entries — index = INPA fg/bg code (0..15). */
  palette: string[];
  font: {
    family: string;
    size: number; // px
  };
  /** Background fill behind the whole canvas (covers gaps where no cell exists). */
  background: string;
  /** Pixel padding inside cells when painting glyphs. */
  cellPadding: { x: number; y: number };
  /**
   * Analog-gauge colour roles. The gauge overlays a *needle* (solid
   * fill from min to current value) on top of red/green/red *zone*
   * backdrops. Needle contrast is judged against the *zone* colour,
   * not the canvas background — so these can't track `palette[1]`
   * blindly, because flipping the structural axis (light↔dark) would
   * also invert the needle and wash it out on the lifted-for-dark
   * accent zones. Each theme picks a pair that keeps the needle
   * legible against its own zone colours.
   */
  gauge: {
    /** Red zone fill — low/high invalid regions of the bar. */
    invalid: string;
    /** Green zone fill — valid mid region. */
    valid: string;
    /** Solid bar from x0 to current value. */
    needle: string;
    /** Bar outline + numeric value label. */
    outline: string;
  };
}

export const classicInpaTheme: InpaTheme = {
  palette: [
    "#ffffff", // 0  C_WHITE
    "#000000", // 1  C_BLACK
    "#c0c0c0", // 2  C_GREY
    "#808080", // 3  C_DARK_GREY
    "#ff0000", // 4  C_RED
    "#800000", // 5  C_DARK_RED
    "#ff00ff", // 6  C_MAGENTA
    "#800080", // 7  C_PURPLE
    "#ffff00", // 8  C_YELLOW
    "#808000", // 9  C_BROWN
    "#00ff00", // 10 C_GREEN
    "#008000", // 11 C_DARK_GREEN
    "#00ffff", // 12 C_CYAN
    "#008080", // 13 C_TEAL
    "#0000ff", // 14 C_BLUE
    "#000080", // 15 C_DARK_BLUE
  ],
  font: {
    family: '"SF Mono", "Menlo", "Consolas", monospace',
    size: 14,
  },
  // INPA's default canvas is white — scripts paint with
  // `setcolor(C_BLACK, C_WHITE)` and rely on the white field. Cells
  // with `bg=0` (C_WHITE) are skipped in the paint loop and let this
  // background bleed through.
  background: "#ffffff",
  cellPadding: { x: 0, y: 0 },
  gauge: {
    // Vibrant red/green against white canvas — classic INPA workshop look.
    invalid: "#ff0000",
    valid: "#00ff00",
    needle: "#000000",
    outline: "#000000",
  },
};

export const darkInpaTheme: InpaTheme = {
  palette: [
    "#1f2937", // 0  C_WHITE      — "default field" flips to dark slate
    "#e5e7eb", // 1  C_BLACK      — "default text" flips to near-white
    "#9ca3af", // 2  C_GREY       — neutral chrome
    "#6b7280", // 3  C_DARK_GREY  — muted chrome
    "#f87171", // 4  C_RED        — lifted; pure #ff0000 vibrates on dark
    "#dc2626", // 5  C_DARK_RED
    "#f472b6", // 6  C_MAGENTA    — toned-down pink; raw magenta jars
    "#a78bfa", // 7  C_PURPLE
    "#facc15", // 8  C_YELLOW     — dimmed; pure yellow shimmers on dark
    "#ca8a04", // 9  C_BROWN
    "#4ade80", // 10 C_GREEN
    "#16a34a", // 11 C_DARK_GREEN
    "#22d3ee", // 12 C_CYAN
    "#14b8a6", // 13 C_TEAL
    "#60a5fa", // 14 C_BLUE       — pure #0000ff is unreadable on dark
    "#3b82f6", // 15 C_DARK_BLUE
  ],
  font: classicInpaTheme.font,
  // Matches the rest of the app's dark `--theme-bg` so the canvas
  // letter-box area around the cell grid blends with surrounding chrome.
  background: "#1f2937",
  cellPadding: { x: 0, y: 0 },
  gauge: {
    // Saturated red/green (the 5/11 "dark" indices, equivalent to
    // Tailwind red-600 / green-600) — read as "cockpit indicator"
    // colours against the dark canvas, and provide enough surface
    // contrast for a light needle drawn on top.
    invalid: "#dc2626",
    valid: "#16a34a",
    // Needle is the theme's near-white default-text colour — high
    // contrast against the saturated zone fills above.
    needle: "#e5e7eb",
    // Outline + value label also near-white so the gauge boundary
    // reads against the dark canvas.
    outline: "#e5e7eb",
  },
};

/**
 * Resolve an INPA palette index (0..15) to a CSS colour against a
 * specific theme. Out-of-range indices fall back to the theme's
 * "default text" colour (index 1) so callers don't need to special-
 * case unknown codes and the fallback auto-tracks the theme.
 */
export function paletteColor(theme: InpaTheme, index: number): string {
  return theme.palette[index] ?? theme.palette[1];
}
