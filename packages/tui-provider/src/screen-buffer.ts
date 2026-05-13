/**
 * Back-compat re-export — `ScreenBuffer` now lives in
 * `@emdzej/inpax-ui-provider-core` so the browser-side `WebUIProvider`
 * can reach it without depending on this CLI-flavoured package.
 */

export {
  ScreenBuffer,
  type ScreenCell,
  type ScreenSpan,
} from '@emdzej/inpax-ui-provider-core';
