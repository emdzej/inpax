# @inpax/interfaces

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
}
```

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
import type { IUIProvider, IEdiabasProvider } from '@inpax/interfaces';

class MyProvider implements IUIProvider {
  // Implement interface...
}
```
