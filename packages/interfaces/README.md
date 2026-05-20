# @emdzej/inpax-interfaces

TypeScript interfaces for INPAX provider system.

## Interfaces

### IUIProvider

UI provider interface for screen, menu, text output, data display, and input dialogs.

```typescript
interface IUIProvider extends EventEmitter<UIEvents> {
  // Screen
  setScreen(handle: number, cyclic: boolean): void;
  setTitle(title: string): void;
  blankScreen(): void;
  
  // Menu
  setMenu(handle: number): void;
  setMenuTitle(title: string): void;
  setItem(itemNum: number, text: string, enabled: boolean): void;
  
  // Text output
  text(row: number, col: number, text: string): void;
  
  // Data output
  analogOut(value: number, row: number, col: number, ...): void;
  digitalOut(value: boolean, row: number, col: number, ...): void;
  
  // Input dialogs
  inputText(title: string, text: string): Promise<string>;
  inputNum(title: string, text: string, min: number, max: number): Promise<number>;
  messageBox(title: string, text: string): Promise<void>;

  // Toggle list — INPA's "Please select the objects to be controlled"
  // multi-select picker. Items come from the active SCREEN's empty
  // LineFunc declarations.
  togglelist(
    multipleSelect: boolean,
    argNum: boolean,
    items: ToggleItem[],
  ): Promise<string>;
}
```

### `togglelist` serialisation helpers

The package exports three helpers used by every concrete UIProvider
that opens the togglelist dialog (CLI, web, mock) so the wire bytes
are identical regardless of which provider drove the picker.

```typescript
import {
  type ToggleItem,            // { name: string; mask: string }
  orToggleMasks,              // OR multiple 9-byte masks byte-by-byte
  formatToggleIndices,        // "1 3 7" — sorted 1-based indices
  encodeTogglelistResult,     // routes to either of the above per argNum
} from '@emdzej/inpax-interfaces';
```

INPA's wire convention (verified empirically against KOMBI.IPO's
`STEUERN_LEUCHTE` call chain):

- `argNum === false` → bitwise OR of the picked items' masks,
  re-formatted as `"0xNN;0xNN;…"`. Drives multiple lamps in a single
  ECU command.
- `argNum === true`  → space-separated 1-based item indices
  (`"3 7"`).

### IEdiabasProvider

EDIABAS communication interface.

```typescript
interface IEdiabasProvider {
  connect(ecu: string): Promise<void>;
  disconnect(): Promise<void>;
  job(name: string, ...args: unknown[]): Promise<JobResult>;
  getResult(name: string): unknown;
}
```

### Events

```typescript
interface UIEvents {
  'menu:select': { itemNum: number; text: string };
  'menu:back': void;
  'input:submit': { value: unknown };
  'screen:ready': void;
}
```

## Usage

```typescript
import type { IUIProvider, IEdiabasProvider } from '@emdzej/inpax-interfaces';

class MyProvider implements IUIProvider {
  // Implement interface...
}
```
