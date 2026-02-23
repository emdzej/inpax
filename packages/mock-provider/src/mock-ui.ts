/**
 * Mock UI Provider for unit testing
 */

import { EventEmitter } from 'eventemitter3';
import type { IUIProvider, UIEvents } from '@emdzej/inpax-interfaces';

export interface UICall {
  method: string;
  args: unknown[];
  timestamp: number;
}

export interface InputQueue {
  text: string[];
  num: number[];
  bool: boolean[];
}

export class MockUIProvider extends EventEmitter<UIEvents> implements IUIProvider {
  /** Recorded method calls */
  readonly calls: UICall[] = [];

  /** Text output lines */
  readonly outputLines: Array<{ row: number; col: number; text: string }> = [];

  /** Menu items set */
  readonly menuItems: Map<number, { text: string; enabled: boolean }> = new Map();

  /** Input values to return (FIFO queues) */
  private inputQueue: InputQueue = { text: [], num: [], bool: [] };

  /** Current title */
  title = '';

  /** Current menu title */
  menuTitle = '';

  // === Configuration ===

  /** Queue text input values */
  queueTextInput(...values: string[]): this {
    this.inputQueue.text.push(...values);
    return this;
  }

  /** Queue numeric input values */
  queueNumInput(...values: number[]): this {
    this.inputQueue.num.push(...values);
    return this;
  }

  /** Queue boolean input values */
  queueBoolInput(...values: boolean[]): this {
    this.inputQueue.bool.push(...values);
    return this;
  }

  /** Simulate menu selection */
  selectMenuItem(itemNum: number): void {
    const item = this.menuItems.get(itemNum);
    if (item) {
      this.emit('menu:select', { itemNum, text: item.text });
    }
  }

  /** Clear all recorded data */
  reset(): void {
    this.calls.length = 0;
    this.outputLines.length = 0;
    this.menuItems.clear();
    this.inputQueue = { text: [], num: [], bool: [] };
    this.title = '';
    this.menuTitle = '';
  }

  // === Helpers ===

  private record(method: string, ...args: unknown[]): void {
    this.calls.push({ method, args, timestamp: Date.now() });
  }

  private nextText(fallback = ''): string {
    return this.inputQueue.text.shift() ?? fallback;
  }

  private nextNum(fallback = 0): number {
    return this.inputQueue.num.shift() ?? fallback;
  }

  private nextBool(fallback = false): boolean {
    return this.inputQueue.bool.shift() ?? fallback;
  }

  // === IUIProvider Implementation ===

  setScreen(handle: number, cyclic: boolean): void {
    this.record('setScreen', handle, cyclic);
  }

  blankScreen(): void {
    this.record('blankScreen');
    this.outputLines.length = 0;
  }

  clearRect(row: number, col: number, width: number, height: number): void {
    this.record('clearRect', row, col, width, height);
  }

  setTitle(title: string): void {
    this.record('setTitle', title);
    this.title = title;
  }

  setColor(fg: number, bg: number): void {
    this.record('setColor', fg, bg);
  }

  setMenuTitle(title: string): void {
    this.record('setMenuTitle', title);
    this.menuTitle = title;
  }

  setMenu(handle: number): void {
    this.record('setMenu', handle);
    this.menuItems.clear();
  }

  setItem(itemNum: number, text: string, enabled: boolean): void {
    this.record('setItem', itemNum, text, enabled);
    this.menuItems.set(itemNum, { text, enabled });
  }

  setItemRepeat(itemNum: number, enabled: boolean): void {
    this.record('setItemRepeat', itemNum, enabled);
    const item = this.menuItems.get(itemNum);
    if (item) item.enabled = enabled;
  }

  text(row: number, col: number, text: string): void {
    this.record('text', row, col, text);
    this.outputLines.push({ row, col, text });
  }

  textOut(text: string, row: number, col: number): void {
    this.record('textOut', text, row, col);
    this.outputLines.push({ row, col, text });
  }

  fTextOut(text: string, row: number, col: number, fg: number, bg: number, fontSize: number, fontAttr: number): void {
    this.record('fTextOut', text, row, col, fg, bg, fontSize, fontAttr);
    this.outputLines.push({ row, col, text });
  }

  fTextClear(text: string, row: number, col: number, textSize: number, textAttr: number): void {
    this.record('fTextClear', text, row, col, textSize, textAttr);
  }

  hexDump(row: number, col: number, data: Uint8Array, len: number): void {
    this.record('hexDump', row, col, data, len);
  }

  digitalOut(value: boolean, row: number, col: number, trueText: string, falseText: string): void {
    this.record('digitalOut', value, row, col, trueText, falseText);
    this.outputLines.push({ row, col, text: value ? trueText : falseText });
  }

  analogOut(value: number, row: number, col: number, min: number, max: number, minValid: number, maxValid: number, format: string): void {
    this.record('analogOut', value, row, col, min, max, minValid, maxValid, format);
    this.outputLines.push({ row, col, text: value.toString() });
  }

  multiAnalogOut(row: number, col: number, ...values: unknown[]): void {
    this.record('multiAnalogOut', row, col, ...values);
  }

  getInputState(): number {
    return 0;
  }

  async inputText(title: string, text: string): Promise<string> {
    this.record('inputText', title, text);
    const result = this.nextText();
    this.emit('input:submit', { value: result });
    return result;
  }

  async input2Text(title: string, text: string, l1: string, l2: string): Promise<[string, string]> {
    this.record('input2Text', title, text, l1, l2);
    return [this.nextText(), this.nextText()];
  }

  async inputNum(title: string, text: string, min: number, max: number): Promise<number> {
    this.record('inputNum', title, text, min, max);
    const result = Math.max(min, Math.min(max, this.nextNum(min)));
    this.emit('input:submit', { value: result });
    return result;
  }

  async inputInt(title: string, text: string, min: number, max: number): Promise<number> {
    this.record('inputInt', title, text, min, max);
    return Math.floor(Math.max(min, Math.min(max, this.nextNum(min))));
  }

  async input2Int(title: string, text: string, l1: string, l2: string, min1: number, max1: number, min2: number, max2: number): Promise<[number, number]> {
    this.record('input2Int', title, text, l1, l2, min1, max1, min2, max2);
    return [
      Math.max(min1, Math.min(max1, this.nextNum(min1))),
      Math.max(min2, Math.min(max2, this.nextNum(min2))),
    ];
  }

  async inputHex(title: string, text: string, min: string, max: string): Promise<string> {
    this.record('inputHex', title, text, min, max);
    return this.nextText(min);
  }

  async input2Hex(title: string, text: string, l1: string, l2: string, min1: string, max1: string, min2: string, max2: string): Promise<[string, string]> {
    this.record('input2Hex', title, text, l1, l2, min1, max1, min2, max2);
    return [this.nextText(min1), this.nextText(min2)];
  }

  async input2HexNum(title: string, text: string, hexLabel: string, numLabel: string, minHex: string, maxHex: string, minNum: number, maxNum: number): Promise<[string, number]> {
    this.record('input2HexNum', title, text, hexLabel, numLabel, minHex, maxHex, minNum, maxNum);
    return [this.nextText(minHex), Math.max(minNum, Math.min(maxNum, this.nextNum(minNum)))];
  }

  async inputDigital(title: string, text: string, offText: string, onText: string): Promise<boolean> {
    this.record('inputDigital', title, text, offText, onText);
    return this.nextBool();
  }

  async messageBox(title: string, text: string): Promise<void> {
    this.record('messageBox', title, text);
    this.emit('messagebox:closed', {});
  }

  async infoBox(title: string, text: string): Promise<void> {
    this.record('infoBox', title, text);
    this.emit('messagebox:closed', {});
  }

  userBoxOpen(boxNum: number, row: number, col: number, height: number, width: number, title: string, text: string): void {
    this.record('userBoxOpen', boxNum, row, col, height, width, title, text);
  }

  userBoxClose(boxNum: number): void {
    this.record('userBoxClose', boxNum);
    this.emit('messagebox:closed', { boxNum });
  }

  userBoxFTextOut(boxNum: number, text: string, row: number, col: number, fg: number, bg: number): void {
    this.record('userBoxFTextOut', boxNum, text, row, col, fg, bg);
  }

  userBoxClear(boxNum: number): void {
    this.record('userBoxClear', boxNum);
  }

  userBoxSetColor(boxNum: number, fg: number, bg: number): void {
    this.record('userBoxSetColor', boxNum, fg, bg);
  }
}
