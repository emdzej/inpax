# @emdzej/inpax-ui-provider-core

Abstract `UIProvider` for INPA runtimes — owns the state shape that
the rendering layer reads (cell grid, menu items, input dialogs,
analog values, …) and the BEST2 system-function surface the
dispatcher writes to.

Subclassed by:

- [`@emdzej/inpax-tui-provider`](../tui-provider) — state for the
  terminal renderer ([`@emdzej/inpax-tui`](../tui)).
- [`@emdzej/inpax-cli-provider`](../cli-provider) — minimal CLI
  variant for headless scripted runs.
- [`@emdzej/inpax-web-provider`](../web-provider) — browser variant
  paired with Svelte 5 components.

## Usage

Most consumers don't import this directly — they instantiate one of
the concrete subclasses above. If you're writing a new renderer:

```typescript
import { UIProvider } from "@emdzej/inpax-ui-provider-core";

class MyUIProvider extends UIProvider {
  // Optionally override paint hooks. The base class already handles
  // the cell grid + menu state + input dialog plumbing — you mostly
  // just consume `getTextLines()`, `getAnalogValues()`,
  // `getDigitalValues()`, `getMenuItems()` from your render loop.
}
```

## State shape (read by renderers)

| Getter | Used for |
|---|---|
| `screenBuffer` | Cell grid (80×30 by default) — the canonical text layer |
| `getTextLines()` | `fTextOut` entries with `fontSize > 0` — variable-font overlays |
| `getAnalogValues()` | `analogout` gauge overlays |
| `getDigitalValues()` | `digitalout` LED overlays |
| `getUserBoxes()` | `userbox` modals |
| `getMenuItems()` | F-key bar contents |
| `getInputDialog()` | Active dialog (text / number / hex / digital / connect / scriptselect) |
| `state.menuTitle` | Menu title bar text |
| `state.screenCyclic` | Whether the active SCREEN re-runs INIT/LINE each cycle |
| `state.firstVisibleLine` / `totalLines` / `visibleLineCount` | LINE-block pagination window |

## Mutators (called by the dispatcher)

The BEST2 dispatcher routes opcodes through methods on this provider:
`setScreen`, `setMenu`, `setItem`, `setMenuTitle`, `text`, `textOut`,
`fTextOut`, `clearRect`, `blankScreen`, `digitalOut`, `analogOut`,
`hexDump`, `userBoxOpen` / `userBoxClose`, `setColor`, `setTitle`,
`setLineBaseRow`, etc.

## Events

Provider extends an `EventEmitter`. Useful subscriptions:

| Event | Fires when |
|---|---|
| `state:changed` | Any state mutation — coarse-grained, drives reactive UIs |
| `screen:ready` | `setScreen` completed — host can start painting |
| `menu:select` | User picked an F-key item |
| `menu:back` | User hit Escape in a menu |
| `input:submit` / `input:cancel` | Input dialog resolved |
| `cycle:complete` | Full SCREEN cycle finished (INIT + every visible LINE) — atomic paint boundary |

## See also

- [`AGENTS.md`](../../AGENTS.md#repository-orientation) — workspace map
  showing where this package sits relative to subclasses.
