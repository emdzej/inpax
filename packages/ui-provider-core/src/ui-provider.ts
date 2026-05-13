/**
 * Abstract UI Provider — shared `IUIProvider` implementation that
 * owns all UI state and emits `state:changed` whenever it mutates.
 * Concrete subclasses (`TuiProvider` for cell-grid CLI rendering,
 * `WebUIProvider` for canvas-based SPA rendering) are largely empty
 * token classes today; they exist for naming clarity and to give
 * each side a stable subclass to hang future side effects on.
 *
 * What the base owns:
 *   - All UI state (menu items, text lines, analog/digital values,
 *     hex dumps, user boxes, input dialog).
 *   - The `ScreenBuffer` cell grid that ink (CLI) and the SPA canvas
 *     both paint from. Each `text` / `digitalOut` / `analogOut` /
 *     `hexDump` call updates BOTH the primitive arrays AND the cell
 *     grid. Hosts pick whichever surface fits their renderer.
 *   - Menu selection / input dialog plumbing, including the
 *     `ensureConnected` / `confirmConnectError` / `scriptSelect`
 *     promise dance.
 *   - The `lineBaseRow` offset the screen executor flips between
 *     LINE blocks.
 *
 * Subclasses can still override the `protected paintX` /
 * `clearBufferX` hooks if they ever need to route output somewhere
 * other than (or in addition to) the shared `ScreenBuffer` — but the
 * default behaviour is correct for both TUI and Web today.
 */

import { EventEmitter } from 'eventemitter3';
import type { IUIProvider, UIEvents } from '@emdzej/inpax-interfaces';
import { ScreenBuffer } from './screen-buffer.js';
import {
  type UIProviderState,
  initialUIState,
  type MenuItem,
  type TextLine,
  type AnalogValue,
  type DigitalValue,
  type UserBox,
  type InputDialog,
} from './state.js';

/** Internal events for state synchronization */
export interface InternalEvents {
  'state:changed': () => void;
}

/**
 * Mirror of the C-style numeric formatters most BMW INPA scripts
 * pass into `analogout`. Shared between subclasses so they don't
 * disagree on rounding.
 */
export const formatAnalogValue = (value: number, format: string): string => {
  if (!format) return value.toString();
  const regex = /%(\.(\d+))?[fdeg]/g;
  const matches = format.match(regex);
  if (!matches || matches.length === 0) return format;
  const match = matches[0];
  const decimals = match.match(/\.(\d+)/)?.[1];
  let formatted = value.toString();
  if (decimals) {
    formatted = value.toFixed(parseInt(decimals, 10));
  } else if (match.endsWith('d')) {
    formatted = Math.round(value).toString();
  }
  return format.replace(regex, formatted);
};

export abstract class UIProvider
  extends EventEmitter<UIEvents>
  implements IUIProvider
{
  protected _state: UIProviderState;
  private screenBuffer = new ScreenBuffer();
  // Width of the last write at each `row:col` — lets a shorter follow-up
  // write at the same anchor blank the previous, longer text instead of
  // leaving a trailing tail behind. Cleared on `setScreen` / `blankScreen`.
  private lastWriteLengths = new Map<string, number>();

  /** Internal event emitter for state changes */
  readonly internal = new EventEmitter<InternalEvents>();

  /**
   * Row-offset applied to every output call. The screen executor
   * flips this between LINE blocks so each LINE writes inside its
   * own coordinate space — see `IUIProvider.setLineBaseRow`.
   */
  protected lineBaseRow = 0;

  constructor() {
    super();
    // CRUCIAL: plain spread of `initialUIState` shares its mutable
    // collections (menuItems, textLines, …) across every instance.
    // Build fresh collections per instance so each new IPO mount
    // gets a clean slate.
    this._state = {
      ...initialUIState,
      menuItems: [],
      textLines: [],
      analogValues: [],
      digitalValues: [],
      hexDumps: [],
      userBoxes: new Map(),
    };
  }

  // ============ Read-only state access ============

  /** Get current state (readonly snapshot) */
  get state(): Readonly<UIProviderState> {
    return this._state;
  }

  /** Subscribe to state changes */
  onStateChange(handler: () => void): () => void {
    this.internal.on('state:changed', handler);
    return () => this.internal.off('state:changed', handler);
  }

  getMenuItems(): readonly MenuItem[] {
    return this._state.menuItems;
  }
  getTextLines(): readonly TextLine[] {
    return this._state.textLines;
  }
  getAnalogValues(): readonly AnalogValue[] {
    return this._state.analogValues;
  }
  getDigitalValues(): readonly DigitalValue[] {
    return this._state.digitalValues;
  }
  getUserBoxes(): ReadonlyMap<number, UserBox> {
    return this._state.userBoxes;
  }
  getInputDialog(): InputDialog | null {
    return this._state.inputDialog;
  }

  /** Get the cell-grid buffer that ink / canvas paint from. */
  getScreenBuffer(): ScreenBuffer {
    return this.screenBuffer;
  }

  protected update(): void {
    this.internal.emit('state:changed');
  }

  // ============ Template-method hooks ============
  //
  // Default impls paint into the shared ScreenBuffer. Subclasses can
  // override if they need to route output somewhere else.

  /** Called whenever a primitive is written that conceptually paints
   *  a row of text cells. Provides absolute `(row, col)` (after the
   *  lineBaseRow has been applied). */
  protected paintText(
    row: number,
    col: number,
    text: string,
    fg: number,
    bg: number,
  ): void {
    this.writeBuffer(row, col, text, fg, bg);
  }

  /** Called by `digitalOut` after the state entry has been pushed.
   *  Paints `● label` / `○ label` into the cell grid; the canvas
   *  renders a real LED disc on top, the TUI relies on the glyph. */
  protected paintDigital(
    row: number,
    col: number,
    value: boolean,
    trueText: string,
    falseText: string,
    bg: number,
  ): void {
    // INPA draws digitalout as a graphical LED-style indicator (filled
    // circle = true, empty = false) PLUS the optional trueText/falseText
    // label next to it. Scripts like UTILITY/STATUS_UBATT pass empty
    // strings for the labels and write their own "on"/"off" text via
    // ftextout — so writing only the label leaves the indicator slot
    // blank. Render the indicator glyph here too, with the label
    // appended after it. Green for on, dim red for off — matches the
    // colour convention real INPA uses.
    const glyph = value ? '●' : '○';
    const label = value ? trueText : falseText;
    const text = label ? `${glyph} ${label}` : glyph;
    const fg = value ? 2 /* green */ : 1 /* red */;
    this.writeBuffer(row, col, text, fg, bg);
  }

  /** Called by `analogOut` after the state entry has been pushed. */
  protected paintAnalog(
    row: number,
    col: number,
    formatted: string,
    fg: number,
    bg: number,
  ): void {
    this.writeBuffer(row, col, formatted, fg, bg);
  }

  /** Called by `hexDump` after the state entry has been pushed. */
  protected paintHex(
    row: number,
    col: number,
    hex: string,
    fg: number,
    bg: number,
  ): void {
    this.writeBuffer(row, col, hex, fg, bg);
  }

  /** Clear a rectangular region in the cell grid. */
  protected clearBufferRect(
    row: number,
    col: number,
    width: number,
    height: number,
  ): void {
    this.screenBuffer.clearRect(row, col, width, height);
  }

  /** Clear the entire cell grid. Called by `blankScreen` / `setScreen`. */
  protected clearBufferAll(): void {
    this.screenBuffer.clear();
    this.lastWriteLengths.clear();
  }

  private writeBuffer(
    row: number,
    col: number,
    text: string,
    fg: number,
    bg: number,
  ): void {
    const key = `${row}:${col}`;
    const previousLength = this.lastWriteLengths.get(key);
    if (previousLength && previousLength > text.length) {
      this.screenBuffer.clearRect(row, col, previousLength, 1);
    }
    this.screenBuffer.write(row, col, text, fg, bg);
    this.lastWriteLengths.set(key, text.length);
  }

  // ============ Menu Selection (called by UI layer) ============

  /** Call when user selects a menu item */
  selectMenuItem(itemNum: number): void {
    const item = this._state.menuItems.find(m => m.itemNum === itemNum && m.enabled);
    if (item) {
      this.emit('menu:select', { itemNum, text: item.text });
    }
  }

  /** Call when user presses back/escape in menu */
  menuBack(): void {
    this.emit('menu:back');
  }

  /** Submit current input dialog */
  submitInput(value: unknown): void {
    if (this._state.inputResolve) {
      this._state.inputResolve(value);
      this._state.inputResolve = null;
    }
    this._state.inputDialog = null;
    this.emit('input:submit', { value });
    this.update();
  }

  /** Cancel current input dialog */
  cancelInput(): void {
    if (this._state.inputResolve) {
      // Cancellation value depends on dialog shape:
      //   - number: 0      (script expects a number)
      //   - scriptselect: null (script's caller branches on null vs picked IPO)
      //   - connect-error: 'continue' (cancelling the error dialog =
      //     proceed with whatever broken state we're in; matches the
      //     "X" / Escape gesture's natural meaning)
      //   - everything else: '' (string)
      let cancelValue: unknown = '';
      if (this._state.inputDialog?.type === 'number') cancelValue = 0;
      else if (this._state.inputDialog?.type === 'scriptselect') cancelValue = null;
      else if (this._state.inputDialog?.type === 'connect-error') cancelValue = 'continue';
      this._state.inputResolve(cancelValue);
      this._state.inputResolve = null;
    }
    this._state.inputDialog = null;
    this.emit('input:cancel');
    this.update();
  }

  // ============ IUIProvider implementation ============

  setScreen(handle: number, cyclic: boolean): void {
    this._state.screenHandle = handle;
    this._state.screenCyclic = cyclic;
    this._state.textLines = [];
    this._state.analogValues = [];
    this._state.digitalValues = [];
    this._state.hexDumps = [];
    // Pagination resets on every SCREEN swap. The screen executor
    // immediately follows with `setTotalLines` / `setVisibleLineCount`
    // once it's inspected the new screen's LINE-block array.
    this._state.firstVisibleLine = 0;
    this._state.totalLines = 0;
    this.clearBufferAll();
    this.emit('screen:ready');
    this.update();
  }

  // ============ Pagination ============
  //
  // INPA's SCREEN blocks can declare more LINE blocks than fit on
  // the viewport. The screen executor reads `firstVisibleLine` each
  // cycle and shifts every LINE block's `setLineBaseRow` by that
  // amount; the keymap and the overlay buttons mutate it through
  // `scrollLines` / `scrollToTop` / `scrollToBottom`. See
  // `docs/research/screen-line-pagination.md`.

  /** Snapshot of the current first-visible-line index. Mirrors
   *  `state.firstVisibleLine` but exposed through `IUIProvider` so
   *  callers behind the interface don't need to touch the `state`
   *  getter. */
  getFirstVisibleLine(): number {
    return this._state.firstVisibleLine;
  }

  /** Mirror of `state.visibleLineCount` exposed through `IUIProvider`. */
  getVisibleLineCount(): number {
    return this._state.visibleLineCount;
  }

  /** Called by the screen executor at attach time. */
  setTotalLines(total: number): void {
    this._state.totalLines = Math.max(0, total);
    // If the user had scrolled past the new end (script swapped to a
    // shorter screen), clamp back into range.
    const max = Math.max(0, this._state.totalLines - this._state.visibleLineCount);
    if (this._state.firstVisibleLine > max) {
      this._state.firstVisibleLine = max;
    }
    this.update();
  }

  /** Called by the host UI (canvas) once it knows how many LINE blocks
   *  fit vertically. Setting this re-clamps `firstVisibleLine`. */
  setVisibleLineCount(count: number): void {
    this._state.visibleLineCount = Math.max(0, count);
    const max = Math.max(0, this._state.totalLines - this._state.visibleLineCount);
    if (this._state.firstVisibleLine > max) {
      this._state.firstVisibleLine = max;
    }
    this.update();
  }

  /** Move the visible window by `delta` LINE blocks. Negative = up,
   *  positive = down. Clamps to `[0, max]`. No-op when totalLines
   *  fits in the visible window. */
  scrollLines(delta: number): void {
    if (this._state.totalLines <= this._state.visibleLineCount) return;
    const max = Math.max(0, this._state.totalLines - this._state.visibleLineCount);
    const next = Math.max(0, Math.min(max, this._state.firstVisibleLine + delta));
    if (next === this._state.firstVisibleLine) return;
    this._state.firstVisibleLine = next;
    this.update();
  }

  scrollToTop(): void {
    if (this._state.firstVisibleLine === 0) return;
    this._state.firstVisibleLine = 0;
    this.update();
  }

  scrollToBottom(): void {
    const max = Math.max(0, this._state.totalLines - this._state.visibleLineCount);
    if (this._state.firstVisibleLine === max) return;
    this._state.firstVisibleLine = max;
    this.update();
  }

  blankScreen(): void {
    this._state.textLines = [];
    this._state.analogValues = [];
    this._state.digitalValues = [];
    this._state.hexDumps = [];
    this.clearBufferAll();
    this.update();
  }

  clearRect(row: number, col: number, width: number, height: number): void {
    const r = row + this.lineBaseRow;
    this._state.textLines = this._state.textLines.filter(
      l => !(l.row >= r && l.row < r + height && l.col >= col && l.col < col + width)
    );
    this.clearBufferRect(r, col, width, height);
    this.update();
  }

  setTitle(title: string): void {
    this._state.title = title;
    this.update();
  }

  setColor(fg: number, bg: number): void {
    this._state.fg = fg;
    this._state.bg = bg;
  }

  setLineBaseRow(baseRow: number): void {
    this.lineBaseRow = baseRow;
  }

  /**
   * Snapshot of the current foreground/background colour codes the
   * next text-output call will use. Mirrors `setColor`'s storage;
   * the dispatcher calls this for `ftextout` (whose BEST2 signature
   * has no colour args — `(text, row, col, fontsize, fontattr)`).
   */
  getCurrentColors(): { fg: number; bg: number } {
    return { fg: this._state.fg, bg: this._state.bg };
  }

  // === Menu ===

  setMenuTitle(title: string): void {
    this._state.menuTitle = title;
    this.update();
  }

  setMenu(handle: number): void {
    this._state.menuHandle = handle;
    this._state.menuItems = [];
    this.update();
  }

  setItem(itemNum: number, text: string, enabled: boolean): void {
    const existing = this._state.menuItems.findIndex(m => m.itemNum === itemNum);
    const item: MenuItem = { itemNum, text, enabled };
    if (existing >= 0) {
      this._state.menuItems[existing] = item;
    } else {
      this._state.menuItems.push(item);
      this._state.menuItems.sort((a, b) => a.itemNum - b.itemNum);
    }
    this.update();
  }

  setItemRepeat(itemNum: number, enabled: boolean): void {
    const item = this._state.menuItems.find(m => m.itemNum === itemNum);
    if (item) {
      item.enabled = enabled;
      this.update();
    }
  }

  // === Text Output ===

  text(row: number, col: number, text: string): void {
    const r = row + this.lineBaseRow;
    this._state.textLines.push({
      row: r,
      col,
      text,
      fg: this._state.fg,
      bg: this._state.bg,
    });
    this.paintText(r, col, text, this._state.fg, this._state.bg);
    this.update();
  }

  textOut(text: string, row: number, col: number): void {
    this.text(row, col, text);
  }

  fTextOut(
    text: string,
    row: number,
    col: number,
    fg: number,
    bg: number,
    fontSize: number,
    fontAttr: number,
  ): void {
    const r = row + this.lineBaseRow;
    this._state.textLines.push({ row: r, col, text, fg, bg, fontSize, fontAttr });
    this.paintText(r, col, text, fg, bg);
    this.update();
  }

  fTextClear(
    text: string,
    row: number,
    col: number,
    _textSize: number,
    _textAttr: number,
  ): void {
    const r = row + this.lineBaseRow;
    this._state.textLines = this._state.textLines.filter(
      l => !(l.row === r && l.col === col && l.text === text)
    );
    this.clearBufferRect(r, col, text.length, 1);
    this.update();
  }

  hexDump(row: number, col: number, data: Uint8Array, len: number): void {
    const r = row + this.lineBaseRow;
    const hex = Array.from(data.slice(0, len))
      .map(b => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');
    this._state.hexDumps.push({ row: r, col, data: hex });
    this.paintHex(r, col, hex, this._state.fg, this._state.bg);
    this.update();
  }

  // === Data Output ===

  digitalOut(
    value: boolean,
    row: number,
    col: number,
    trueText: string,
    falseText: string,
  ): void {
    const r = row + this.lineBaseRow;
    this._state.digitalValues = this._state.digitalValues.filter(
      d => !(d.row === r && d.col === col)
    );
    this._state.digitalValues.push({ row: r, col, value, trueText, falseText });
    this.paintDigital(r, col, value, trueText, falseText, this._state.bg);
    this.update();
  }

  analogOut(
    value: number,
    row: number,
    col: number,
    min: number,
    max: number,
    minValid: number,
    maxValid: number,
    format: string,
  ): void {
    const r = row + this.lineBaseRow;
    this._state.analogValues = this._state.analogValues.filter(
      a => !(a.row === r && a.col === col)
    );
    this._state.analogValues.push({
      row: r,
      col,
      value,
      min,
      max,
      minValid,
      maxValid,
      format,
    });
    const formatted = formatAnalogValue(value, format);
    this.paintAnalog(r, col, formatted, this._state.fg, this._state.bg);
    this.update();
  }

  multiAnalogOut(_row: number, _col: number, ..._values: unknown[]): void {
    this.update();
  }

  // === Input ===

  getInputState(): number {
    return this._state.inputDialog ? 1 : 0;
  }

  async inputText(title: string, text: string): Promise<string> {
    return new Promise(resolve => {
      this._state.inputDialog = { type: 'text', title, text, value: '' };
      this._state.inputResolve = resolve as (v: unknown) => void;
      this.update();
    });
  }

  async input2Text(
    title: string,
    text: string,
    _l1: string,
    _l2: string,
  ): Promise<[string, string]> {
    const result = await this.inputText(title, text);
    return [result, ''];
  }

  async inputNum(
    title: string,
    text: string,
    min: number,
    max: number,
  ): Promise<number> {
    return new Promise(resolve => {
      this._state.inputDialog = { type: 'number', title, text, value: '', min, max };
      this._state.inputResolve = v => resolve(Number(v) || min);
      this.update();
    });
  }

  async inputInt(
    title: string,
    text: string,
    min: number,
    max: number,
  ): Promise<number> {
    const result = await this.inputNum(title, text, min, max);
    return Math.floor(result);
  }

  async input2Int(
    title: string,
    text: string,
    _l1: string,
    _l2: string,
    min1: number,
    max1: number,
    min2: number,
    _max2: number,
  ): Promise<[number, number]> {
    const result = await this.inputInt(title, text, min1, max1);
    return [result, min2];
  }

  async inputHex(
    title: string,
    text: string,
    min: string,
    max: string,
  ): Promise<string> {
    return new Promise(resolve => {
      this._state.inputDialog = { type: 'hex', title, text, value: '', min, max };
      this._state.inputResolve = v => resolve(String(v) || min);
      this.update();
    });
  }

  async input2Hex(
    title: string,
    text: string,
    _l1: string,
    _l2: string,
    min1: string,
    _max1: string,
    min2: string,
    _max2: string,
  ): Promise<[string, string]> {
    const result = await this.inputHex(title, text, min1, '');
    return [result, min2];
  }

  async input2HexNum(
    title: string,
    text: string,
    _hexLabel: string,
    _numLabel: string,
    minHex: string,
    _maxHex: string,
    minNum: number,
    _maxNum: number,
  ): Promise<[string, number]> {
    const result = await this.inputHex(title, text, minHex, '');
    return [result, minNum];
  }

  async inputDigital(
    title: string,
    text: string,
    offText: string,
    onText: string,
  ): Promise<boolean> {
    return new Promise(resolve => {
      this._state.inputDialog = {
        type: 'digital',
        title,
        text,
        value: '',
        trueText: onText,
        falseText: offText,
      };
      this._state.inputResolve = v => resolve(Boolean(v));
      this.update();
    });
  }

  // === Message Boxes ===

  async messageBox(title: string, text: string): Promise<void> {
    return new Promise(resolve => {
      this._state.inputDialog = { type: 'message', title, text, value: '' };
      this._state.inputResolve = () => resolve();
      this.update();
    });
  }

  async infoBox(title: string, text: string): Promise<void> {
    return this.messageBox(title, text);
  }

  /**
   * Drive the host's connect flow. Sets a `connect`-shaped
   * inputDialog so the host's settings panel can auto-open. Resolves
   * when the host calls `submitInput()` (typically once the cable
   * has been opened). Cancel is treated as "user chose to proceed
   * without a fresh connection"; the dispatcher's `INPAapiInit`
   * loop catches subsequent `ediabas.init()` failures separately.
   */
  async ensureConnected(): Promise<void> {
    return new Promise<void>(resolve => {
      this._state.inputDialog = {
        type: 'connect',
        title: 'EDIABAS connection',
        text: '',
        value: '',
      };
      this._state.inputResolve = () => resolve();
      this.update();
    });
  }

  /**
   * Surface a connection error and ask the user how to proceed.
   * `submitInput` resolves with the chosen string outcome; the
   * dispatcher's INPAapiInit loop interprets that.
   */
  async confirmConnectError(
    message: string,
  ): Promise<'retry' | 'continue' | 'stop'> {
    return new Promise<'retry' | 'continue' | 'stop'>(resolve => {
      this._state.inputDialog = {
        type: 'connect-error',
        title: 'EDIABAS connection failed',
        text: message,
        value: '',
      };
      this._state.inputResolve = value => {
        const choice = value === 'retry' || value === 'stop' ? value : 'continue';
        resolve(choice);
      };
      this.update();
    });
  }

  /**
   * Show the script-select picker. The provider doesn't read the
   * .ENG/.GER INI itself — it hangs an `inputDialog` of type
   * `scriptselect` carrying the requested filename and waits. The
   * host-side dialog component is expected to:
   *
   *   1. Read the INI file from its own filesystem surface.
   *   2. Parse it (sections → tree, `ENTRY=` → leaves).
   *   3. Render the tree + entries.
   *   4. On confirm, call `ui.submitInput(<picked-ipo-basename>)`.
   *   5. On cancel, call `ui.cancelInput()`.
   */
  async scriptSelect(iniFile: string): Promise<string | null> {
    return new Promise<string | null>(resolve => {
      this._state.inputDialog = {
        type: 'scriptselect',
        title: 'Select script',
        text: iniFile,
        value: '',
        scriptSelectFile: iniFile,
      };
      this._state.inputResolve = value => {
        if (value === null || value === undefined) {
          resolve(null);
        } else {
          resolve(String(value));
        }
      };
      this.update();
    });
  }

  // === User boxes (state-only — drawing is host-specific) ===

  userBoxOpen(
    boxNum: number,
    row: number,
    col: number,
    height: number,
    width: number,
    title: string,
    _text: string,
  ): void {
    this._state.userBoxes.set(boxNum, {
      boxNum,
      row,
      col,
      height,
      width,
      title,
      lines: [],
      fg: this._state.fg,
      bg: this._state.bg,
      visible: true,
    });
    this.update();
  }

  userBoxClose(boxNum: number): void {
    this._state.userBoxes.delete(boxNum);
    this.emit('messagebox:closed', { boxNum });
    this.update();
  }

  userBoxFTextOut(
    boxNum: number,
    text: string,
    row: number,
    col: number,
    fg: number,
    bg: number,
  ): void {
    const box = this._state.userBoxes.get(boxNum);
    if (box) {
      box.lines.push({ row, col, text, fg, bg });
      this.update();
    }
  }

  userBoxClear(boxNum: number): void {
    const box = this._state.userBoxes.get(boxNum);
    if (box) {
      box.lines = [];
      this.update();
    }
  }

  userBoxSetColor(boxNum: number, fg: number, bg: number): void {
    const box = this._state.userBoxes.get(boxNum);
    if (box) {
      box.fg = fg;
      box.bg = bg;
      this.update();
    }
  }
}
