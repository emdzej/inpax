/**
 * Shared UI Provider state types.
 *
 * Both `TuiProvider` (cell-grid CLI) and `WebUIProvider` (canvas-
 * based SPA) build on top of `UIProvider`, which is a template-
 * method base class that owns these state shapes and emits
 * `state:changed` whenever they mutate. Subclasses override the
 * `paintX` hooks to render the same state in their own way.
 */

import type { ToggleItem } from '@emdzej/inpax-interfaces';

export interface MenuItem {
  itemNum: number;
  text: string;
  enabled: boolean;
}

export interface TextLine {
  row: number;
  col: number;
  text: string;
  fg: number;
  bg: number;
  fontSize?: number;
  fontAttr?: number;
}

export interface AnalogValue {
  row: number;
  col: number;
  value: number;
  min: number;
  max: number;
  minValid: number;
  maxValid: number;
  format: string;
  label?: string;
  unit?: string;
  /**
   * Display-mode hint set only by `multianalogout` (system function
   * 0x4D) — the documented extra arg vs plain `analogout`. INPA's
   * canonical header doesn't comment on the values; with no BMW
   * script in our test set exercising this opcode we store it
   * verbatim so the canvas can branch later if we figure out the
   * semantics. `undefined` means "regular `analogout`".
   */
  mode?: number;
}

export interface DigitalValue {
  row: number;
  col: number;
  value: boolean;
  trueText: string;
  falseText: string;
}

export interface UserBox {
  boxNum: number;
  row: number;
  col: number;
  height: number;
  width: number;
  title: string;
  lines: TextLine[];
  fg: number;
  bg: number;
  visible: boolean;
}

export interface InputDialog {
  type:
    | 'text'
    | 'number'
    | 'hex'
    | 'digital'
    | 'message'
    | 'scriptselect'
    | 'connect'
    | 'connect-error'
    | 'toggle-list';
  title: string;
  text: string;
  value: string;
  min?: number | string;
  max?: number | string;
  trueText?: string;
  falseText?: string;
  /**
   * For `type: 'scriptselect'` only — the basename of the .ENG / .GER
   * (or other language-suffixed INI) file the script asked us to show
   * a picker for. The host component reads and parses it; the
   * provider only carries the filename through.
   */
  scriptSelectFile?: string;
  /**
   * For `type: 'toggle-list'` only.
   *
   * The toggle-list dialog mirrors INPA's "Please select the objects
   * to be controlled" multi-select picker. Items are declared by the
   * active SCREEN's "empty" LineFunc sub-blocks (the LINE blocks
   * whose body has `size=0`): the user-visible name lives in
   * `LineHeader.arg1`, and the per-lamp control mask (a 9-byte
   * semicolon-hex string consumed by `INPAapiJob "STEUERN_LEUCHTE"`)
   * lives in `LineHeader.arg2`. The dispatcher walks the active
   * screen, builds the `{name, mask}` pairs, and hands them here.
   *
   * Serialisation rules (verified against KOMBI.IPO's STEUERN_LEUCHTE
   * call chain):
   *   - `toggleArgNum === false` → return the bitwise OR of the
   *     picked items' masks, formatted as the same 9-byte
   *     `0xNN;0xNN;…` string. Combining multiple lamps with one OR
   *     drives them all in a single ECU command.
   *   - `toggleArgNum === true`  → return space-separated 1-based
   *     item indices (`"3 7"`).
   *
   * `toggleMultipleSelect === false` (INPA's `MultipleSelectFlag=0`)
   * forces the dialog into single-select / radio-button mode.
   */
  toggleItems?: ToggleItem[];
  toggleMultipleSelect?: boolean;
  toggleArgNum?: boolean;
}

// ToggleItem lives in `@emdzej/inpax-interfaces` (`ui.ts`) so the
// IUIProvider signature and concrete implementations both refer to
// the same shape. Re-exported here for convenience of consumers that
// already pull from `@emdzej/inpax-ui-provider-core`.
export type { ToggleItem } from '@emdzej/inpax-interfaces';

export interface UIProviderState {
  // Screen
  title: string;
  screenHandle: number | null;
  screenCyclic: boolean;
  fg: number;
  bg: number;

  // Menu
  menuTitle: string;
  menuHandle: number | null;
  menuItems: MenuItem[];

  // Content
  textLines: TextLine[];
  analogValues: AnalogValue[];
  digitalValues: DigitalValue[];
  hexDumps: Array<{ row: number; col: number; data: string }>;

  // Boxes
  userBoxes: Map<number, UserBox>;

  // Pagination — INPA SCREEN blocks can declare more LINE blocks than
  // fit on the 30-row viewport. Real INPA paginates with a small
  // green ▲/▼ corner glyph and the user steps with arrow keys /
  // PgUp / PgDn (Win32 `WM_VSCROLL` with `SB_LINE*` / `SB_PAGE*`).
  // The screen executor reads `firstVisibleLine` each cycle and
  // shifts every LINE block's `setLineBaseRow` by that amount, so
  // visible blocks land within the chrome-bounded viewport and
  // invisible ones write off-screen (cropped silently by the cell-
  // grid buffer and ignored by the canvas overlays via row
  // clipping). See `docs/research/screen-line-pagination.md` for
  // the algorithm.
  /** Index (0-based) of the first LINE block currently shown. */
  firstVisibleLine: number;
  /** How many LINE blocks fit on screen at once. ~5 with the default
   *  cell-grid size; the screen executor and the keymap both read
   *  this. Set to 0 when no SCREEN is active. */
  visibleLineCount: number;
  /** Total LINE blocks in the active SCREEN. Set by the screen
   *  executor at attach time; 0 when no SCREEN is active. */
  totalLines: number;

  // Input
  inputDialog: InputDialog | null;
  inputResolve: ((value: unknown) => void) | null;
  /**
   * Outcome of the most recently completed input dialog, surfaced by
   * the `getinputstate` system function. INPA scripts use it to branch
   * between the "user submitted" and "user cancelled" paths after an
   * `inputint` / `inputtext` / etc. call returns.
   *
   * Convention (mirrors real INPA): `1` = submitted (OK), `0` =
   * cancelled or no input has run yet. The KOMBI.IPO menu-item handlers
   * compare against a global initialised to `0` and treat EQUAL as the
   * cancel path; returning the dialog's open/closed flag (the
   * pre-2026-05 behaviour) made every submission look like a cancel.
   */
  lastInputState: number;
}

export const initialUIState: UIProviderState = {
  title: 'INPA',
  screenHandle: null,
  screenCyclic: false,
  // INPA palette codes — `1 = C_BLACK`, `0 = C_WHITE`. Real INPA paints
  // black text on a white canvas by default; scripts that don't call
  // `setcolor(...)` first should still come out reading correctly.
  fg: 1,
  bg: 0,
  menuTitle: '',
  menuHandle: null,
  menuItems: [],
  textLines: [],
  analogValues: [],
  digitalValues: [],
  hexDumps: [],
  userBoxes: new Map(),
  firstVisibleLine: 0,
  visibleLineCount: 0,
  totalLines: 0,
  inputDialog: null,
  inputResolve: null,
  lastInputState: 0,
};

/**
 * Back-compat alias for the historical `TuiState` name. The shape is
 * identical; only the package boundary moved.
 *
 * @deprecated Use `UIProviderState`.
 */
export type TuiState = UIProviderState;

/** @deprecated Use `initialUIState`. */
export const initialTuiState: TuiState = initialUIState;
