/**
 * Null UI Provider - no-op implementation for testing
 */

import { EventEmitter } from 'eventemitter3';
import type { IUIProvider, UIEvents } from '@emdzej/inpax-interfaces';

export class NullUIProvider extends EventEmitter<UIEvents> implements IUIProvider {
  // === Screen ===
  setScreen(_handle: number, _cyclic: boolean): void {}
  blankScreen(): void {}
  clearRect(_row: number, _col: number, _width: number, _height: number): void {}
  setTitle(_title: string): void {}
  setColor(_foreground: number, _background: number): void {}
  getCurrentColors(): { fg: number; bg: number } {
    return { fg: 1, bg: 0 };
  }
  async scriptSelect(_iniFile: string): Promise<string | null> {
    return null;
  }
  async ensureConnected(): Promise<void> {
    // Null provider can't drive a UI flow — assume connection is
    // managed externally and resolve immediately.
  }
  async confirmConnectError(_message: string): Promise<"retry" | "continue" | "stop"> {
    // No interactive surface — default to "continue" so the script
    // doesn't hang waiting for a button click that can't happen.
    return "continue";
  }

  // === Menu ===
  setMenuTitle(_title: string): void {}
  setMenu(_handle: number): void {}
  setItem(_itemNum: number, _text: string, _enabled: boolean): void {}
  setItemRepeat(_itemNum: number, _enabled: boolean): void {}

  // === Text Output ===
  text(_row: number, _col: number, _text: string): void {}
  textOut(_text: string, _row: number, _col: number): void {}
  fTextOut(
    _text: string,
    _row: number,
    _col: number,
    _fgColor: number,
    _bgColor: number,
    _fontSize: number,
    _fontAttr: number
  ): void {}
  fTextClear(
    _text: string,
    _row: number,
    _col: number,
    _textSize: number,
    _textAttr: number
  ): void {}
  hexDump(_row: number, _col: number, _data: Uint8Array, _len: number): void {}

  // === Data Output ===
  digitalOut(
    _value: boolean,
    _row: number,
    _col: number,
    _trueText: string,
    _falseText: string
  ): void {}
  analogOut(
    _value: number,
    _row: number,
    _col: number,
    _min: number,
    _max: number,
    _minValid: number,
    _maxValid: number,
    _format: string
  ): void {}
  multiAnalogOut(_row: number, _col: number, ..._values: unknown[]): void {}

  // === Input (return defaults) ===
  getInputState(): number {
    return 0;
  }
  async inputText(_title: string, _text: string): Promise<string> {
    return '';
  }
  async input2Text(
    _title: string,
    _text: string,
    _str1Label: string,
    _str2Label: string
  ): Promise<[string, string]> {
    return ['', ''];
  }
  async inputNum(
    _title: string,
    _text: string,
    min: number,
    _max: number
  ): Promise<number> {
    return min;
  }
  async inputInt(
    _title: string,
    _text: string,
    min: number,
    _max: number
  ): Promise<number> {
    return min;
  }
  async input2Int(
    _title: string,
    _text: string,
    _label1: string,
    _label2: string,
    min1: number,
    _max1: number,
    min2: number,
    _max2: number
  ): Promise<[number, number]> {
    return [min1, min2];
  }
  async inputHex(
    _title: string,
    _text: string,
    min: string,
    _max: string
  ): Promise<string> {
    return min;
  }
  async input2Hex(
    _title: string,
    _text: string,
    _label1: string,
    _label2: string,
    min1: string,
    _max1: string,
    min2: string,
    _max2: string
  ): Promise<[string, string]> {
    return [min1, min2];
  }
  async input2HexNum(
    _title: string,
    _text: string,
    _hexLabel: string,
    _numLabel: string,
    minHex: string,
    _maxHex: string,
    minNum: number,
    _maxNum: number
  ): Promise<[string, number]> {
    return [minHex, minNum];
  }
  async inputDigital(
    _title: string,
    _text: string,
    _offText: string,
    _onText: string
  ): Promise<boolean> {
    return false;
  }

  // === Message Boxes ===
  async messageBox(_title: string, _text: string): Promise<void> {}
  async infoBox(_title: string, _text: string): Promise<void> {}
  userBoxOpen(
    _boxNum: number,
    _row: number,
    _col: number,
    _height: number,
    _width: number,
    _title: string,
    _text: string
  ): void {}
  userBoxClose(_boxNum: number): void {}
  userBoxFTextOut(
    _boxNum: number,
    _text: string,
    _row: number,
    _col: number,
    _foreColor: number,
    _backColor: number
  ): void {}
  userBoxClear(_boxNum: number): void {}
  userBoxSetColor(_boxNum: number, _foreColor: number, _backColor: number): void {}
}
