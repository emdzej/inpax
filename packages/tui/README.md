# @inpax/tui

Terminal UI renderer for INPAX using [ink](https://github.com/vadimdemedes/ink).

## Usage

```typescript
import { renderTui } from '@inpax/tui';
import { TuiProvider } from '@inpax/tui-provider';

const provider = new TuiProvider();

// Set up initial state
provider.setTitle('My Script');
provider.setItem(1, 'Start', true);
provider.setItem(10, 'Exit', true);

// Render
const { waitUntilExit } = renderTui(provider, {
  title: 'INPA',
  onQuit: () => process.exit(0),
});

await waitUntilExit();
```

## Layout

```
┌─ INPA ──────────────────────────────────────────────────────┐
│ Script Title [RUNNING]   [1-0]=F1-F10 | Shift | C | P | Q   │
└─────────────────────────────────────────────────────────────┘
│                                                             │
│                      Screen Area                            │
│                                                             │
├─ Menu ──────────────────────────────────────────────────────┤
│ F1 │ F2 │ F3 │ F4 │ F5 │ F6 │ F7 │ F8 │ F9 │ F10           │
│Start│    │    │    │    │    │    │    │    │Exit           │
└─────────────────────────────────────────────────────────────┘
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| 1-0 | F1-F10 |
| Shift+1-0 | F11-F20 |
| C | Copy screen to clipboard |
| P | Pause/Resume |
| Q | Quit |

## Components

- `RunScreen` — Main full-screen layout
- `ScreenArea` — Content display area
- `FKeyBar` — Function key bar
- `AnalogGauge` — Analog value display
- `DigitalIndicator` — Boolean indicator
- `InputDialog` — Input prompts

## Exports

```typescript
export { renderTui } from './index.js';
export { RunScreen } from './screens/RunScreen.js';
export { ScreenArea, FKeyBar, AnalogGauge, DigitalIndicator } from './components/index.js';
```
