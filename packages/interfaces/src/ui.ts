/**
 * Combined UI Provider interface
 * Handles: screen, menu, text output, data output, input dialogs, message boxes
 */

import { EventEmitter } from 'eventemitter3';
import type { UIEvents } from './events.js';

export interface IUIProvider extends EventEmitter<UIEvents> {
  // === Screen Management ===
  
  /**
   * Set active screen
   * @param handle Screen definition handle
   * @param cyclic Whether screen updates cyclically
   */
  setScreen(handle: number, cyclic: boolean): void;
  
  /**
   * Clear entire screen
   */
  blankScreen(): void;
  
  /**
   * Clear rectangular area
   */
  clearRect(row: number, col: number, width: number, height: number): void;
  
  /**
   * Set window/screen title
   */
  setTitle(title: string): void;
  
  /**
   * Set current foreground/background colors
   */
  setColor(foreground: number, background: number): void;

  // === Menu System ===
  
  /**
   * Set menu bar title
   */
  setMenuTitle(title: string): void;
  
  /**
   * Set active menu definition
   */
  setMenu(handle: number): void;
  
  /**
   * Configure menu item
   * @param itemNum Item index (1-based)
   * @param text Item display text
   * @param enabled Whether item is selectable
   */
  setItem(itemNum: number, text: string, enabled: boolean): void;
  
  /**
   * Set item repeat mode
   */
  setItemRepeat(itemNum: number, enabled: boolean): void;

  // === Text Output ===
  
  /**
   * Output text at position
   */
  text(row: number, col: number, text: string): void;
  
  /**
   * Output text (alternate signature)
   */
  textOut(text: string, row: number, col: number): void;
  
  /**
   * Formatted text output with colors and font attributes
   * @param fontSize Font size (0-7)
   * @param fontAttr Font attributes (bold, italic, etc.)
   */
  fTextOut(
    text: string,
    row: number,
    col: number,
    fgColor: number,
    bgColor: number,
    fontSize: number,
    fontAttr: number
  ): void;
  
  /**
   * Clear formatted text area
   */
  fTextClear(
    text: string,
    row: number,
    col: number,
    textSize: number,
    textAttr: number
  ): void;
  
  /**
   * Display hex dump of data
   */
  hexDump(row: number, col: number, data: Uint8Array, len: number): void;

  // === Data Output ===
  
  /**
   * Display boolean value with true/false labels
   */
  digitalOut(
    value: boolean,
    row: number,
    col: number,
    trueText: string,
    falseText: string
  ): void;
  
  /**
   * Display analog value with range and validation
   */
  analogOut(
    value: number,
    row: number,
    col: number,
    min: number,
    max: number,
    minValid: number,
    maxValid: number,
    format: string
  ): void;
  
  /**
   * Display multiple analog values
   */
  multiAnalogOut(row: number, col: number, ...values: unknown[]): void;

  // === Input Dialogs ===
  
  /**
   * Get current input dialog state
   * @returns 0=idle, 1=active, 2=completed
   */
  getInputState(): number;
  
  /**
   * Show text input dialog
   */
  inputText(title: string, text: string): Promise<string>;
  
  /**
   * Show dual text input dialog
   */
  input2Text(
    title: string,
    text: string,
    str1Label: string,
    str2Label: string
  ): Promise<[string, string]>;
  
  /**
   * Show numeric input dialog (floating point)
   */
  inputNum(
    title: string,
    text: string,
    min: number,
    max: number
  ): Promise<number>;
  
  /**
   * Show integer input dialog
   */
  inputInt(
    title: string,
    text: string,
    min: number,
    max: number
  ): Promise<number>;
  
  /**
   * Show dual integer input dialog
   */
  input2Int(
    title: string,
    text: string,
    label1: string,
    label2: string,
    min1: number,
    max1: number,
    min2: number,
    max2: number
  ): Promise<[number, number]>;
  
  /**
   * Show hex string input dialog
   */
  inputHex(
    title: string,
    text: string,
    min: string,
    max: string
  ): Promise<string>;
  
  /**
   * Show dual hex input dialog
   */
  input2Hex(
    title: string,
    text: string,
    label1: string,
    label2: string,
    min1: string,
    max1: string,
    min2: string,
    max2: string
  ): Promise<[string, string]>;
  
  /**
   * Show mixed hex/numeric input dialog
   */
  input2HexNum(
    title: string,
    text: string,
    hexLabel: string,
    numLabel: string,
    minHex: string,
    maxHex: string,
    minNum: number,
    maxNum: number
  ): Promise<[string, number]>;
  
  /**
   * Show boolean input dialog
   */
  inputDigital(
    title: string,
    text: string,
    offText: string,
    onText: string
  ): Promise<boolean>;

  // === Message Boxes ===
  
  /**
   * Show modal message box (waits for user)
   */
  messageBox(title: string, text: string): Promise<void>;
  
  /**
   * Show info box (waits for user)
   */
  infoBox(title: string, text: string): Promise<void>;
  
  /**
   * Open persistent user box
   */
  userBoxOpen(
    boxNum: number,
    row: number,
    col: number,
    height: number,
    width: number,
    title: string,
    text: string
  ): void;
  
  /**
   * Close user box
   */
  userBoxClose(boxNum: number): void;
  
  /**
   * Output formatted text to user box
   */
  userBoxFTextOut(
    boxNum: number,
    text: string,
    row: number,
    col: number,
    foreColor: number,
    backColor: number
  ): void;
  
  /**
   * Clear user box content
   */
  userBoxClear(boxNum: number): void;
  
  /**
   * Set user box colors
   */
  userBoxSetColor(boxNum: number, foreColor: number, backColor: number): void;
}
