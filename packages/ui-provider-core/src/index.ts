/**
 * @emdzej/inpax-ui-provider-core
 *
 * Abstract `UIProvider` base class plus the shared `UIProviderState`
 * shape and the cell-grid `ScreenBuffer` both rendering targets
 * paint from. `@emdzej/inpax-tui-provider` and the browser-side
 * `WebUIProvider` both extend the base; they exist for naming
 * clarity and as a stable hook for future side effects.
 */

export {
  UIProvider,
  formatAnalogValue,
  type InternalEvents,
} from './ui-provider.js';
export {
  ScreenBuffer,
  type ScreenCell,
  type ScreenSpan,
} from './screen-buffer.js';
export * from './state.js';
