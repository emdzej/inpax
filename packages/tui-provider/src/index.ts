/**
 * @emdzej/inpax-tui-provider
 *
 * Cell-grid (ScreenBuffer) flavour of the abstract `UIProvider`. Pair
 * with `@emdzej/inpax-tui` for ink-based rendering of the buffer.
 *
 * The abstract base, all state types, and the `IUIProvider` contract
 * live in `@emdzej/inpax-ui-provider-core`; this barrel re-exports
 * them so existing consumers don't need a second import.
 */

export { TuiProvider } from './tui-provider.js';
export { ScreenBuffer, type ScreenCell, type ScreenSpan } from './screen-buffer.js';
export * from './state.js';
export {
  UIProvider,
  formatAnalogValue,
  type InternalEvents,
} from '@emdzej/inpax-ui-provider-core';
