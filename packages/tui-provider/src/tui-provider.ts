/**
 * TUI Provider - Headless state management for IUIProvider
 * 
 * This provider manages UI state but does NOT render.
 * Use @inpax/tui for ink-based rendering of this state.
 */

import { EventEmitter } from 'eventemitter3';
import type { IUIProvider, UIEvents } from '@inpax/interfaces';
import {
  TuiState,
  initialTuiState,
  MenuItem,
  TextLine,
  AnalogValue,
  DigitalValue,
  UserBox,
  InputDialog,
} from './state.js';

/** Internal events for state synchronization */
export interface InternalEvents {
  'state:changed': () => void;
}

export class TuiProvider extends EventEmitter<UIEvents> implements IUIProvider {
  private _state: TuiState;
  
  /** Internal event emitter for state changes */
  readonly internal = new EventEmitter<InternalEvents>();

  constructor() {
    super();
    this._state = { ...initialTuiState, userBoxes: new Map() };
  }

  /** Get current state (readonly snapshot) */
  get state(): Readonly<TuiState> {
    return this._state;
  }

  /** Subscribe to state changes */
  onStateChange(handler: () => void): () => void {
    this.internal.on('state:changed', handler);
    return () => this.internal.off('state:changed', handler);
  }

  /** Get menu items for F-key bar */
  getMenuItems(): readonly MenuItem[] {
    return this._state.menuItems;
  }

  /** Get text lines for screen area */
  getTextLines(): readonly TextLine[] {
    return this._state.textLines;
  }

  /** Get analog values */
  getAnalogValues(): readonly AnalogValue[] {
    return this._state.analogValues;
  }

  /** Get digital values */
  getDigitalValues(): readonly DigitalValue[] {
    return this._state.digitalValues;
  }

  /** Get user boxes */
  getUserBoxes(): ReadonlyMap<number, UserBox> {
    return this._state.userBoxes;
  }

  /** Get current input dialog (if any) */
  getInputDialog(): InputDialog | null {
    return this._state.inputDialog;
  }

  private update(): void {
    this.internal.emit('state:changed');
  }

  // === Menu Selection (called by TUI layer) ===

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
      this._state.inputResolve(this._state.inputDialog?.type === 'number' ? 0 : '');
      this._state.inputResolve = null;
    }
    this._state.inputDialog = null;
    this.emit('input:cancel');
    this.update();
  }

  // === IUIProvider Implementation ===

  setScreen(handle: number, cyclic: boolean): void {
    this._state.screenHandle = handle;
    this._state.screenCyclic = cyclic;
    this._state.textLines = [];
    this._state.analogValues = [];
    this._state.digitalValues = [];
    this._state.hexDumps = [];
    this.emit('screen:ready');
    this.update();
  }

  blankScreen(): void {
    this._state.textLines = [];
    this._state.analogValues = [];
    this._state.digitalValues = [];
    this._state.hexDumps = [];
    this.update();
  }

  clearRect(row: number, col: number, width: number, height: number): void {
    this._state.textLines = this._state.textLines.filter(
      l => !(l.row >= row && l.row < row + height && l.col >= col && l.col < col + width)
    );
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
    this._state.textLines.push({
      row, col, text,
      fg: this._state.fg,
      bg: this._state.bg,
    });
    this.update();
  }

  textOut(text: string, row: number, col: number): void {
    this.text(row, col, text);
  }

  fTextOut(text: string, row: number, col: number, fg: number, bg: number, fontSize: number, fontAttr: number): void {
    this._state.textLines.push({ row, col, text, fg, bg, fontSize, fontAttr });
    this.update();
  }

  fTextClear(text: string, row: number, col: number, _textSize: number, _textAttr: number): void {
    this._state.textLines = this._state.textLines.filter(
      l => !(l.row === row && l.col === col && l.text === text)
    );
    this.update();
  }

  hexDump(row: number, col: number, data: Uint8Array, len: number): void {
    const hex = Array.from(data.slice(0, len))
      .map(b => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');
    this._state.hexDumps.push({ row, col, data: hex });
    this.update();
  }

  // === Data Output ===

  digitalOut(value: boolean, row: number, col: number, trueText: string, falseText: string): void {
    this._state.digitalValues = this._state.digitalValues.filter(
      d => !(d.row === row && d.col === col)
    );
    this._state.digitalValues.push({ row, col, value, trueText, falseText });
    this.update();
  }

  analogOut(value: number, row: number, col: number, min: number, max: number, minValid: number, maxValid: number, format: string): void {
    this._state.analogValues = this._state.analogValues.filter(
      a => !(a.row === row && a.col === col)
    );
    this._state.analogValues.push({ row, col, value, min, max, minValid, maxValid, format });
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
    return new Promise((resolve) => {
      this._state.inputDialog = { type: 'text', title, text, value: '' };
      this._state.inputResolve = resolve as (v: unknown) => void;
      this.update();
    });
  }

  async input2Text(title: string, text: string, _l1: string, _l2: string): Promise<[string, string]> {
    const result = await this.inputText(title, text);
    return [result, ''];
  }

  async inputNum(title: string, text: string, min: number, max: number): Promise<number> {
    return new Promise((resolve) => {
      this._state.inputDialog = { type: 'number', title, text, value: '', min, max };
      this._state.inputResolve = (v) => resolve(Number(v) || min);
      this.update();
    });
  }

  async inputInt(title: string, text: string, min: number, max: number): Promise<number> {
    const result = await this.inputNum(title, text, min, max);
    return Math.floor(result);
  }

  async input2Int(title: string, text: string, _l1: string, _l2: string, min1: number, max1: number, min2: number, _max2: number): Promise<[number, number]> {
    const result = await this.inputInt(title, text, min1, max1);
    return [result, min2];
  }

  async inputHex(title: string, text: string, min: string, max: string): Promise<string> {
    return new Promise((resolve) => {
      this._state.inputDialog = { type: 'hex', title, text, value: '', min, max };
      this._state.inputResolve = (v) => resolve(String(v) || min);
      this.update();
    });
  }

  async input2Hex(title: string, text: string, _l1: string, _l2: string, min1: string, _max1: string, min2: string, _max2: string): Promise<[string, string]> {
    const result = await this.inputHex(title, text, min1, '');
    return [result, min2];
  }

  async input2HexNum(title: string, text: string, _hexLabel: string, _numLabel: string, minHex: string, _maxHex: string, minNum: number, _maxNum: number): Promise<[string, number]> {
    const result = await this.inputHex(title, text, minHex, '');
    return [result, minNum];
  }

  async inputDigital(title: string, text: string, offText: string, onText: string): Promise<boolean> {
    return new Promise((resolve) => {
      this._state.inputDialog = { type: 'digital', title, text, value: '', trueText: onText, falseText: offText };
      this._state.inputResolve = (v) => resolve(Boolean(v));
      this.update();
    });
  }

  // === Message Boxes ===

  async messageBox(title: string, text: string): Promise<void> {
    return new Promise((resolve) => {
      this._state.inputDialog = { type: 'message', title, text, value: '' };
      this._state.inputResolve = () => resolve();
      this.update();
    });
  }

  async infoBox(title: string, text: string): Promise<void> {
    return this.messageBox(title, text);
  }

  userBoxOpen(boxNum: number, row: number, col: number, height: number, width: number, title: string, _text: string): void {
    this._state.userBoxes.set(boxNum, {
      boxNum, row, col, height, width, title,
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

  userBoxFTextOut(boxNum: number, text: string, row: number, col: number, fg: number, bg: number): void {
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
