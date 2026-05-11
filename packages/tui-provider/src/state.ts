/**
 * TUI Provider State Types
 * Exported for consumption by rendering layers
 */

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
  type: 'text' | 'number' | 'hex' | 'digital' | 'message';
  title: string;
  text: string;
  value: string;
  min?: number | string;
  max?: number | string;
  trueText?: string;
  falseText?: string;
}

export interface TuiState {
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

  // Input
  inputDialog: InputDialog | null;
  inputResolve: ((value: unknown) => void) | null;
}

export const initialTuiState: TuiState = {
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
  inputDialog: null,
  inputResolve: null,
};
