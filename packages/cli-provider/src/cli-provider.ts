/**
 * CLI Provider - Simple stdio implementation of IUIProvider
 * No dependencies on ink/react, uses readline for input
 */

import * as readline from 'readline';
import { EventEmitter } from 'eventemitter3';
import type { IUIProvider, UIEvents } from '@emdzej/inpax-interfaces';

// ANSI color codes
const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  colors: [
    '\x1b[30m', // 0 black
    '\x1b[34m', // 1 blue
    '\x1b[32m', // 2 green
    '\x1b[36m', // 3 cyan
    '\x1b[31m', // 4 red
    '\x1b[35m', // 5 magenta
    '\x1b[33m', // 6 yellow
    '\x1b[37m', // 7 white
  ],
  bg: [
    '\x1b[40m', // 0 black
    '\x1b[44m', // 1 blue
    '\x1b[42m', // 2 green
    '\x1b[46m', // 3 cyan
    '\x1b[41m', // 4 red
    '\x1b[45m', // 5 magenta
    '\x1b[43m', // 6 yellow
    '\x1b[47m', // 7 white
  ],
};

interface MenuItem {
  num: number;
  text: string;
  enabled: boolean;
}

interface UserBox {
  title: string;
  lines: string[];
}

export interface CliProviderOptions {
  /** Output stream (default: process.stdout) */
  stdout?: NodeJS.WritableStream;
  /** Input stream (default: process.stdin) */
  stdin?: NodeJS.ReadableStream;
  /** Use ANSI colors (default: true if TTY) */
  colors?: boolean;
  /** Show coordinates in output (default: false) */
  showCoords?: boolean;
}

export class CliProvider extends EventEmitter<UIEvents> implements IUIProvider {
  private rl: readline.Interface | null = null;
  private stdout: NodeJS.WritableStream;
  private stdin: NodeJS.ReadableStream;
  private useColors: boolean;
  private showCoords: boolean;

  private title = 'INPA';
  private menuTitle = '';
  private menuItems: MenuItem[] = [];
  private userBoxes = new Map<number, UserBox>();
  private fg = 7;
  private bg = 0;

  constructor(options: CliProviderOptions = {}) {
    super();
    this.stdout = options.stdout ?? process.stdout;
    this.stdin = options.stdin ?? process.stdin;
    this.useColors = options.colors ?? (process.stdout.isTTY ?? false);
    this.showCoords = options.showCoords ?? false;
  }

  // === Helpers ===

  private print(text: string): void {
    this.stdout.write(text);
  }

  private println(text = ''): void {
    this.stdout.write(text + '\n');
  }

  private color(fg: number, bg?: number): string {
    if (!this.useColors) return '';
    let code = ANSI.colors[fg % 8] || '';
    if (bg !== undefined) {
      code += ANSI.bg[bg % 8] || '';
    }
    return code;
  }

  private reset(): string {
    return this.useColors ? ANSI.reset : '';
  }

  private bold(): string {
    return this.useColors ? ANSI.bold : '';
  }

  private dim(): string {
    return this.useColors ? ANSI.dim : '';
  }

  private box(title: string, content: string[]): void {
    const width = Math.max(title.length + 4, ...content.map(l => l.length + 4), 40);
    const hr = '─'.repeat(width - 2);
    
    this.println(`┌${hr}┐`);
    this.println(`│ ${this.bold()}${title.padEnd(width - 4)}${this.reset()} │`);
    this.println(`├${hr}┤`);
    for (const line of content) {
      this.println(`│ ${line.padEnd(width - 4)} │`);
    }
    this.println(`└${hr}┘`);
  }

  private async prompt(question: string): Promise<string> {
    if (!this.rl) {
      this.rl = readline.createInterface({
        input: this.stdin,
        output: this.stdout,
      });
    }

    return new Promise((resolve) => {
      this.rl!.question(question, (answer) => {
        resolve(answer);
      });
    });
  }

  // === Lifecycle ===

  start(): void {
    this.println(`${this.bold()}═══ ${this.title} ═══${this.reset()}`);
    this.emit('screen:ready');
  }

  stop(): void {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
  }

  // === Screen ===

  setScreen(_handle: number, _cyclic: boolean): void {
    this.println();
    this.println(`${this.dim()}--- Screen ---${this.reset()}`);
  }

  blankScreen(): void {
    // Clear screen if TTY
    if (process.stdout.isTTY) {
      this.print('\x1b[2J\x1b[H');
    } else {
      this.println('\n'.repeat(5));
    }
  }

  clearRect(_row: number, _col: number, _width: number, _height: number): void {
    // No-op in simple CLI
  }

  setTitle(title: string): void {
    this.title = title;
    this.println(`${this.bold()}═══ ${title} ═══${this.reset()}`);
  }

  setColor(fg: number, bg: number): void {
    this.fg = fg;
    this.bg = bg;
  }

  getCurrentColors(): { fg: number; bg: number } {
    return { fg: this.fg, bg: this.bg };
  }

  async scriptSelect(iniFile: string): Promise<string | null> {
    // CLI doesn't currently surface a tree picker — log a hint and
    // resolve null (cancel). A future enhancement could read the
    // file from `inpaRoot/CFGDAT/<iniFile>` and prompt interactively.
    this.println(`scriptselect: ${iniFile} (CLI picker not yet implemented)`);
    return null;
  }

  async ensureConnected(): Promise<void> {
    // CLI runs with the cable opened up-front via `ediabasx
    // configure` + the `run` command's transport build. No
    // mid-script "open settings" prompt — INPAapiInit just continues
    // and lets the existing transport take care of itself.
  }

  async confirmConnectError(message: string): Promise<"retry" | "continue" | "stop"> {
    // No interactive prompt — print the error and continue. Future
    // work could read a stdin choice in raw mode.
    this.println(`INPAapiInit failed: ${message} (continuing)`);
    return "continue";
  }

  // === Menu ===

  setMenuTitle(title: string): void {
    this.menuTitle = title;
  }

  setMenu(_handle: number): void {
    this.menuItems = [];
  }

  setItem(itemNum: number, text: string, enabled: boolean): void {
    const existing = this.menuItems.findIndex(m => m.num === itemNum);
    if (existing >= 0) {
      this.menuItems[existing] = { num: itemNum, text, enabled };
    } else {
      this.menuItems.push({ num: itemNum, text, enabled });
    }
  }

  setItemRepeat(itemNum: number, enabled: boolean): void {
    const item = this.menuItems.find(m => m.num === itemNum);
    if (item) item.enabled = enabled;
  }

  async showMenu(): Promise<number> {
    this.println();
    if (this.menuTitle) {
      this.println(`${this.bold()}${this.menuTitle}${this.reset()}`);
    }
    
    const enabled = this.menuItems.filter(m => m.enabled);
    for (const item of enabled) {
      this.println(`  ${this.color(3)}[${item.num}]${this.reset()} ${item.text}`);
    }
    
    const answer = await this.prompt(`${this.dim()}Select: ${this.reset()}`);
    const num = parseInt(answer, 10);
    
    const selected = enabled.find(m => m.num === num);
    if (selected) {
      this.emit('menu:select', { itemNum: num, text: selected.text });
      return num;
    }
    
    return -1;
  }

  // === Text Output ===

  text(row: number, col: number, text: string): void {
    const prefix = this.showCoords ? `[${row},${col}] ` : '';
    this.println(`${this.color(this.fg, this.bg)}${prefix}${text}${this.reset()}`);
  }

  textOut(text: string, row: number, col: number): void {
    this.text(row, col, text);
  }

  fTextOut(text: string, row: number, col: number, fg: number, bg: number, _fontSize: number, _fontAttr: number): void {
    const prefix = this.showCoords ? `[${row},${col}] ` : '';
    this.println(`${this.color(fg, bg)}${prefix}${text}${this.reset()}`);
  }

  fTextClear(_text: string, _row: number, _col: number, _textSize: number, _textAttr: number): void {
    // No-op
  }

  hexDump(row: number, col: number, data: Uint8Array, len: number): void {
    const hex = Array.from(data.slice(0, len))
      .map(b => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');
    this.text(row, col, hex);
  }

  // === Data Output ===

  digitalOut(value: boolean, row: number, col: number, trueText: string, falseText: string): void {
    const text = value ? `${this.color(2)}${trueText}` : `${this.color(4)}${falseText}`;
    const prefix = this.showCoords ? `[${row},${col}] ` : '';
    this.println(`${prefix}${text}${this.reset()}`);
  }

  analogOut(value: number, row: number, col: number, min: number, max: number, minValid: number, maxValid: number, format: string): void {
    const inRange = value >= minValid && value <= maxValid;
    const color = inRange ? this.color(2) : this.color(4);
    const formatted = format ? value.toFixed(2) : value.toString();
    const prefix = this.showCoords ? `[${row},${col}] ` : '';
    this.println(`${prefix}${color}${formatted}${this.reset()} (${min}-${max})`);
  }

  multiAnalogOut(row: number, col: number, ...values: unknown[]): void {
    const prefix = this.showCoords ? `[${row},${col}] ` : '';
    this.println(`${prefix}${values.join(' | ')}`);
  }

  // === Input ===

  getInputState(): number {
    return 0;
  }

  async inputText(title: string, text: string): Promise<string> {
    this.box(title, [text]);
    const result = await this.prompt('> ');
    this.emit('input:submit', { value: result });
    return result;
  }

  async input2Text(title: string, text: string, str1Label: string, str2Label: string): Promise<[string, string]> {
    this.box(title, [text]);
    const s1 = await this.prompt(`${str1Label}: `);
    const s2 = await this.prompt(`${str2Label}: `);
    this.emit('input:submit', { value: [s1, s2] });
    return [s1, s2];
  }

  async inputNum(title: string, text: string, min: number, max: number): Promise<number> {
    this.box(title, [text, `Range: ${min} - ${max}`]);
    const answer = await this.prompt('> ');
    const num = parseFloat(answer);
    const result = Math.max(min, Math.min(max, isNaN(num) ? min : num));
    this.emit('input:submit', { value: result });
    return result;
  }

  async inputInt(title: string, text: string, min: number, max: number): Promise<number> {
    return Math.floor(await this.inputNum(title, text, min, max));
  }

  async input2Int(title: string, text: string, l1: string, l2: string, min1: number, max1: number, min2: number, max2: number): Promise<[number, number]> {
    this.box(title, [text]);
    const s1 = await this.prompt(`${l1} (${min1}-${max1}): `);
    const s2 = await this.prompt(`${l2} (${min2}-${max2}): `);
    const n1 = Math.max(min1, Math.min(max1, parseInt(s1, 10) || min1));
    const n2 = Math.max(min2, Math.min(max2, parseInt(s2, 10) || min2));
    this.emit('input:submit', { value: [n1, n2] });
    return [n1, n2];
  }

  async inputHex(title: string, text: string, min: string, max: string): Promise<string> {
    this.box(title, [text, `Hex range: ${min} - ${max}`]);
    const result = await this.prompt('0x');
    this.emit('input:submit', { value: result });
    return result || min;
  }

  async input2Hex(title: string, text: string, l1: string, l2: string, min1: string, _max1: string, min2: string, _max2: string): Promise<[string, string]> {
    this.box(title, [text]);
    const s1 = await this.prompt(`${l1} (hex): 0x`);
    const s2 = await this.prompt(`${l2} (hex): 0x`);
    return [s1 || min1, s2 || min2];
  }

  async input2HexNum(title: string, text: string, hexLabel: string, numLabel: string, minHex: string, _maxHex: string, minNum: number, maxNum: number): Promise<[string, number]> {
    this.box(title, [text]);
    const hex = await this.prompt(`${hexLabel} (hex): 0x`);
    const num = await this.prompt(`${numLabel} (${minNum}-${maxNum}): `);
    const n = Math.max(minNum, Math.min(maxNum, parseInt(num, 10) || minNum));
    return [hex || minHex, n];
  }

  async inputDigital(title: string, text: string, offText: string, onText: string): Promise<boolean> {
    this.box(title, [text, `Enter '${onText}' or '${offText}'`]);
    const answer = await this.prompt('> ');
    const result = answer.toLowerCase() === onText.toLowerCase() || answer === '1' || answer.toLowerCase() === 'true';
    this.emit('input:submit', { value: result });
    return result;
  }

  // === Simulation (simple prompts) ===

  async simNum(title: string, text: string, min: number, max: number): Promise<number> {
    return this.inputNum(title, text, min, max);
  }

  async simDigital(title: string, text: string, offText: string, onText: string): Promise<boolean> {
    return this.inputDigital(title, text, offText, onText);
  }

  // === Message Boxes ===

  async messageBox(title: string, text: string): Promise<void> {
    this.box(title, [text]);
    await this.prompt(`${this.dim()}[Press Enter]${this.reset()} `);
    this.emit('messagebox:closed', {});
  }

  async infoBox(title: string, text: string): Promise<void> {
    return this.messageBox(title, text);
  }

  userBoxOpen(boxNum: number, _row: number, _col: number, _height: number, _width: number, title: string, text: string): void {
    this.userBoxes.set(boxNum, { title, lines: text ? [text] : [] });
    this.println(`┌─ ${title} ─┐`);
    if (text) this.println(`│ ${text}`);
  }

  userBoxClose(boxNum: number): void {
    const box = this.userBoxes.get(boxNum);
    if (box) {
      this.println(`└─ /${box.title} ─┘`);
      this.userBoxes.delete(boxNum);
      this.emit('messagebox:closed', { boxNum });
    }
  }

  userBoxFTextOut(boxNum: number, text: string, _row: number, _col: number, fg: number, _bg: number): void {
    const box = this.userBoxes.get(boxNum);
    if (box) {
      box.lines.push(text);
      this.println(`│ ${this.color(fg)}${text}${this.reset()}`);
    }
  }

  userBoxClear(boxNum: number): void {
    const box = this.userBoxes.get(boxNum);
    if (box) box.lines = [];
  }

  userBoxSetColor(_boxNum: number, _fg: number, _bg: number): void {
    // Colors applied per-line
  }
}
