# @inpax/tui-provider

Headless state management for INPAX TUI.

Implements `IUIProvider` interface and manages UI state without rendering. Use with `@inpax/tui` for terminal rendering.

## Usage

```typescript
import { TuiProvider } from '@inpax/tui-provider';

const provider = new TuiProvider();

// Set title
provider.setTitle('My Script');

// Set menu items
provider.setItem(1, 'Start', true);
provider.setItem(2, 'Status', true);
provider.setItem(10, 'Exit', true);

// Output text
provider.text(0, 0, 'Hello World');

// Output values
provider.analogOut(42.5, 2, 0, 0, 100, 10, 90, '%.1f');
provider.digitalOut(true, 3, 0, 'ON', 'OFF');

// Listen for menu selection
provider.on('menu:select', ({ itemNum, text }) => {
  console.log(`Selected F${itemNum}: ${text}`);
});
```

## State

```typescript
interface TuiState {
  title: string;
  menuTitle: string;
  menuItems: MenuItem[];
  textLines: TextLine[];
  analogValues: AnalogValue[];
  digitalValues: DigitalValue[];
  inputDialog: InputDialog | null;
  // ...
}
```

## Events

```typescript
provider.on('menu:select', ({ itemNum, text }) => { });
provider.on('menu:back', () => { });
provider.on('input:submit', ({ value }) => { });
provider.on('screen:ready', () => { });
```

## With TUI Renderer

```typescript
import { TuiProvider } from '@inpax/tui-provider';
import { renderTui } from '@inpax/tui';

const provider = new TuiProvider();
const { waitUntilExit } = renderTui(provider);

// Provider state changes automatically update the UI
provider.setTitle('Updated Title');

await waitUntilExit();
```
