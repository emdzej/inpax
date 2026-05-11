export interface ScreenCell {
  char: string;
  fg: number;
  bg: number;
}

const defaultCell = (): ScreenCell => ({ char: ' ', fg: 7, bg: 0 });

export class ScreenBuffer {
  private cells: ScreenCell[][] = [];

  constructor(public width: number = 80, public height: number = 25) {
    this.clear();
  }

  clear(): void {
    this.cells = Array.from({ length: this.height }, () =>
      Array.from({ length: this.width }, () => defaultCell())
    );
  }

  clearRect(row: number, col: number, width: number, height: number): void {
    for (let r = row; r < row + height; r++) {
      if (r < 0 || r >= this.height) continue;
      for (let c = col; c < col + width; c++) {
        if (c < 0 || c >= this.width) continue;
        this.cells[r][c] = defaultCell();
      }
    }
  }

  write(row: number, col: number, text: string, fg: number = 7, bg: number = 0): void {
    if (row < 0 || row >= this.height) return;
    for (let i = 0; i < text.length && col + i < this.width; i++) {
      const targetCol = col + i;
      if (targetCol >= 0) {
        this.cells[row][targetCol] = { char: text[i], fg, bg };
      }
    }
  }

  resize(width: number, height: number): void {
    const nextWidth = Math.max(1, Math.floor(width));
    const nextHeight = Math.max(1, Math.floor(height));
    const next: ScreenCell[][] = Array.from({ length: nextHeight }, () =>
      Array.from({ length: nextWidth }, () => defaultCell())
    );

    const copyHeight = Math.min(this.height, nextHeight);
    const copyWidth = Math.min(this.width, nextWidth);

    for (let r = 0; r < copyHeight; r++) {
      for (let c = 0; c < copyWidth; c++) {
        next[r][c] = this.cells[r][c];
      }
    }

    this.width = nextWidth;
    this.height = nextHeight;
    this.cells = next;
  }

  render(): string {
    return this.cells
      .map(row => {
        let line = '';
        let lastFg = -1;
        let lastBg = -1;
        for (const cell of row) {
          if (cell.fg !== lastFg || cell.bg !== lastBg) {
            line += `\x1b[3${cell.fg}m\x1b[4${cell.bg}m`;
            lastFg = cell.fg;
            lastBg = cell.bg;
          }
          line += cell.char;
        }
        return line + '\x1b[0m';
      })
      .join('\n');
  }

  renderPlain(): string {
    return this.cells.map(row => row.map(cell => cell.char).join('')).join('\n');
  }

  /**
   * Render as structured spans for ink-native styling. Each row becomes a
   * list of runs grouping consecutive cells that share the same fg/bg.
   * Use this instead of `render()` when feeding into ink components —
   * ink's width measurement treats inline SGR escape codes as visible
   * characters and wraps rows it shouldn't, producing zebra stripes.
   */
  renderSpans(): ScreenSpan[][] {
    return this.cells.map(row => {
      const spans: ScreenSpan[] = [];
      let current: ScreenSpan | null = null;
      for (const cell of row) {
        if (current && current.fg === cell.fg && current.bg === cell.bg) {
          current.text += cell.char;
        } else {
          current = { text: cell.char, fg: cell.fg, bg: cell.bg };
          spans.push(current);
        }
      }
      return spans;
    });
  }
}

export interface ScreenSpan {
  text: string;
  fg: number;
  bg: number;
}
