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

  /**
   * Set the row-offset that the provider applies to every subsequent
   * `text` / `textOut` / `fTextOut` / `digitalOut` / `analogOut` /
   * `hexDump` / `clearRect` call. Used by the screen executor to
   * stack LINE blocks vertically — each LINE writes its outputs in
   * its own coordinate space (label at relative row 1, indicator at
   * relative row 3, …), and the screen executor sets
   * `lineBaseRow = lineIndex * lineHeight` before running each
   * LINE's bytecode. Cleared (back to 0) for INIT-phase and idle
   * rendering, which paint at absolute screen coordinates.
   *
   * Default line height in standard INPA screens is 4 rows (label +
   * spacer + LED/value + spacer); see the screen executor.
   */
  setLineBaseRow(baseRow: number): void;

  /**
   * Read the current foreground/background colour codes — what the next
   * `ftextout` / `textout` call will use when the script doesn't supply
   * its own. The dispatcher reads this because INPA's `ftextout`
   * signature has no colour parameters; the args the script passes
   * after `(text, row, col)` are `fontsize, fontattr`, NOT colours.
   * Without this hook the dispatcher would have to peek into the TUI
   * provider's private state.
   */
  getCurrentColors(): { fg: number; bg: number };

  // === Pagination ===
  //
  // INPA SCREEN blocks can declare more LINE blocks than fit on a
  // 25-row viewport. The screen executor calls `setTotalLines` /
  // `setVisibleLineCount` at attach time so the provider knows the
  // overflow extent, then reads `getFirstVisibleLine()` at the start
  // of each LINE-phase pass to decide which blocks to run + where to
  // position them. The host UI mutates the window via `scrollLines`
  // (or `scrollToTop` / `scrollToBottom`) in response to keyboard /
  // mouse input. See `docs/research/screen-line-pagination.md`.

  /** Set the total LINE-block count of the active SCREEN. Called by
   *  the screen executor at attach time; resets on `setScreen`. */
  setTotalLines(total: number): void;

  /** Set how many LINE blocks fit vertically in the host's viewport.
   *  Called by the screen executor (or the host, if it has a
   *  dynamically-sized canvas) once the layout is known. */
  setVisibleLineCount(count: number): void;

  /** Index (0-based) of the first LINE block currently shown. The
   *  screen executor reads this once per LINE-phase pass. */
  getFirstVisibleLine(): number;

  /** How many LINE blocks fit vertically in the host's viewport.
   *  `0` means "host has no fixed viewport" (CLI streams, headless
   *  tests) — the screen executor treats that as "run every LINE
   *  block, no pagination". */
  getVisibleLineCount(): number;

  /** Move the visible window by `delta` LINE blocks (negative = up,
   *  positive = down). Clamps to a valid range; no-op when total
   *  fits in the viewport. */
  scrollLines(delta: number): void;

  /** Reset the visible window to the top of the SCREEN. */
  scrollToTop(): void;

  /** Move the visible window so the last LINE block is showing. */
  scrollToBottom(): void;

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
   * `multianalogout` — same shape as `analogOut` plus a documented
   * `mode` integer. Per `ref/Inpa.h:201-206` the signature is
   * `(val, row, col, min, max, minValid, maxValid, format, mode)`.
   * The `mode` field is stored on the resulting `AnalogValue` and
   * routed to the canvas; no script in our test set exercises it
   * yet, so the host treats the entry identically to a regular
   * `analogout`.
   */
  multiAnalogOut(
    value: number,
    row: number,
    col: number,
    min: number,
    max: number,
    minValid: number,
    maxValid: number,
    format: string,
    mode: number
  ): void;

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
   * After `ediabas.init()` failed during `INPAapiInit`, ask the user
   * what to do. Three outcomes:
   *
   *   - `"retry"` — loop back, re-show the connect dialog, try again
   *   - `"continue"` — abandon the connection attempt; the script
   *     keeps running but subsequent jobs will surface `job:error`
   *   - `"stop"` — abort the script (the dispatcher throws, the VM
   *     halts at the failing INPAapiInit instruction)
   *
   * `message` is the underlying error text (e.g.
   * `"Communication interface is not configured"`) so the dialog can
   * show it. Hosts that can't render an interactive choice should
   * resolve with `"continue"` so scripts don't hang.
   */
  confirmConnectError(message: string): Promise<"retry" | "continue" | "stop">;

  /**
   * Drive the host's "make sure we have an open EDIABAS connection"
   * flow and resolve when it's done. Invoked by the dispatcher's
   * `INPAapiInit` so the script's connection setup is host-driven
   * instead of the host being forced to gate the runtime mount on a
   * Connect button.
   *
   * The host is expected to:
   *
   *   1. Check whether a connection is already live (config in
   *      storage + transport open) — if so, resolve immediately.
   *   2. Otherwise, show whatever settings / connect UI it has
   *      (web: `ConfigPanel`; CLI: a prompt or just use the
   *      previously-discovered config) and wait for the user to
   *      finish.
   *   3. Resolve regardless of outcome — connection success vs the
   *      user cancelling is surfaced through subsequent
   *      `ediabas.init()` / `INPAapiJob` errors, not here. The
   *      dispatcher loops on init() failure with its own retry /
   *      continue / stop dialog.
   *
   * `Promise<void>` — no value, just a settling signal.
   */
  ensureConnected(): Promise<void>;

  /**
   * Show the script-select picker for the given INI filename
   * (e.g. `"E46.ENG"`) and wait for the user to pick an IPO or cancel.
   *
   * INPA's `scriptselect` builds a tree from the INI's section names
   * (`[ROOT]`, `[ROOT_MOTOR]`, `[ROOT_GETRIEBE]` → ROOT > Engine /
   * Transmission). Each section has a `DESCRIPTION=` line for the
   * tree label and `ENTRY=<ipo>,<text>,<extra>` lines for the
   * concrete IPO scripts in that group. When the user confirms an
   * entry, the host should swap the running IPO to `<ipo>.IPO`
   * (resolved against the install's SGDAT directory).
   *
   * The TUI provider does NOT read the INI file itself — file IO is
   * host-specific (Node fs vs File System Access API). The promise
   * resolves with the picked IPO basename, or `null` if the user
   * cancelled.
   */
  scriptSelect(iniFile: string): Promise<string | null>;
  
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
