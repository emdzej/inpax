/**
 * Event type definitions for INPA runtime providers
 */

// === UI Events ===

export interface MenuSelectEvent {
  itemNum: number;
  text: string;
}

export interface InputSubmitEvent {
  value: unknown;
}

export interface MessageBoxClosedEvent {
  boxNum?: number;
}

export interface ScreenResizeEvent {
  width: number;
  height: number;
}

// === EDIABAS Events ===

export interface JobCompleteEvent {
  ecu: string;
  job: string;
  sets: number;
}

export interface JobErrorEvent {
  code: number;
  message: string;
}

// === Event Maps ===

export interface UIEvents {
  'screen:ready': () => void;
  'screen:resize': (event: ScreenResizeEvent) => void;
  'menu:select': (event: MenuSelectEvent) => void;
  'menu:back': () => void;
  'input:cancel': () => void;
  'input:submit': (event: InputSubmitEvent) => void;
  'messagebox:closed': (event: MessageBoxClosedEvent) => void;
}

export interface EdiabasEvents {
  'job:complete': (event: JobCompleteEvent) => void;
  'job:error': (event: JobErrorEvent) => void;
  'connection:lost': () => void;
  'connection:restored': () => void;
}

export interface Inp1Events {
  'job:complete': (event: JobCompleteEvent) => void;
  'job:error': (event: JobErrorEvent) => void;
}
