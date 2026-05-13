/**
 * Back-compat re-exports of the UI provider state types.
 *
 * The canonical definitions now live in `@emdzej/inpax-ui-provider-core`
 * so both `TuiProvider` and `WebUIProvider` can share them without
 * duplicating the shape. This file is kept so existing imports of
 * `@emdzej/inpax-tui-provider/state` (or barrel re-exports) keep
 * working.
 */

export type {
  MenuItem,
  TextLine,
  AnalogValue,
  DigitalValue,
  UserBox,
  InputDialog,
  UIProviderState,
  TuiState,
} from '@emdzej/inpax-ui-provider-core';
export {
  initialUIState,
  initialTuiState,
} from '@emdzej/inpax-ui-provider-core';
