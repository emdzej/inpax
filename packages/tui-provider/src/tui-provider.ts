/**
 * TUI Provider — cell-grid rendering for the CLI.
 *
 * The abstract `UIProvider` in `@emdzej/inpax-ui-provider-core`
 * already owns all UI state AND the cell-grid `ScreenBuffer` that
 * `@emdzej/inpax-tui` paints from with ink, so this subclass is
 * intentionally empty. It exists so the CLI has its own stable
 * named class to instantiate (and hang any future CLI-only side
 * effects on), while keeping the web-side `WebUIProvider` free
 * to evolve independently.
 *
 * Headless: this provider does NOT render to a terminal. Pair it
 * with `@emdzej/inpax-tui` for ink-based rendering of the buffer
 * the base class maintains.
 */

import { UIProvider } from '@emdzej/inpax-ui-provider-core';

export class TuiProvider extends UIProvider {}
