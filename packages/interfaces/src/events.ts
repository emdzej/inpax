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

// === State Machine Events ===

export interface StateChangedEvent {
  previousState: number;
  newState: number;
  stateMachine: number;
}

export interface StateMachineEnteredEvent {
  stateMachine: number;
  fromStateMachine?: number;
}

export interface StateMachineReturnedEvent {
  stateMachine: number;
  toStateMachine: number;
}

// === Timer Events ===

export interface TimerExpiredEvent {
  timerNum: number;
}

// === Job Control Events ===

export interface JobStatusEvent {
  status: number;
}

export interface ScriptChangedEvent {
  previousScript: string;
  newScript: string;
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

export interface FsLesenCompleteEvent {
  ecu: string;
  fileName: string;
  faultCount: number;
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
  /**
   * Fired by the `scriptselect` system function after the user picks
   * an IPO from the .ENG/.GER tree. Hosts listen for this on
   * `runtime.ui` to swap the running IPO — dispose the current VM,
   * load `<ipo>.IPO` from SGDAT (case-insensitive), start a fresh
   * runtime. `iniFile` is the source the picker was driven from
   * (for diagnostics / breadcrumbs).
   */
  'script:switch': (event: { ipo: string; iniFile: string }) => void;
}

export interface StateMachineEvents {
  'state:changed': (event: StateChangedEvent) => void;
  'statemachine:entered': (event: StateMachineEnteredEvent) => void;
  'statemachine:returned': (event: StateMachineReturnedEvent) => void;
}

export interface TimerEvents {
  'timer:expired': (event: TimerExpiredEvent) => void;
}

export interface JobControlEvents {
  'job:started': () => void;
  'job:stopped': () => void;
  'job:status': (event: JobStatusEvent) => void;
  'script:changed': (event: ScriptChangedEvent) => void;
  'script:selected': (event: { script: string }) => void;
}

export interface EdiabasEvents {
  'job:complete': (event: JobCompleteEvent) => void;
  'job:error': (event: JobErrorEvent) => void;
  'fs:complete': (event: FsLesenCompleteEvent) => void;
  'connection:lost': () => void;
  'connection:restored': () => void;
}

export interface Inp1Events {
  'job:complete': (event: JobCompleteEvent) => void;
  'job:error': (event: JobErrorEvent) => void;
  'state:changed': (event: { state: number }) => void;
}

// === Aggregate Runtime Events ===

/** All events that can be emitted by the runtime */
export type RuntimeEvents = 
  & UIEvents 
  & StateMachineEvents 
  & TimerEvents 
  & JobControlEvents;
