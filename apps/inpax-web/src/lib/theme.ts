/**
 * Renderer theme — palette, font, cell metrics.
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
 * Canvas background = light gray (`#c0c0c0`) — matches the Win95 dialog
 * face colour the original INPA workshop UI runs on. Most labels are
 * `setcolor(C_BLACK, …)` against this background, so this is what
 * makes the "black text on light gray button" look render correctly.
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
};
