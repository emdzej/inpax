/**
 * `WebUIProvider` — browser-side concrete `UIProvider`.
 *
 * The abstract base in `@emdzej/inpax-ui-provider-core` already
 * owns everything the canvas needs:
 *   - the typed-primitive arrays (`getTextLines`, `getAnalogValues`,
 *     `getDigitalValues`) the canvas reads for graphical overlays,
 *     and
 *   - the cell-grid `ScreenBuffer` the canvas reads via
 *     `screen.renderSpans()` for the text layer.
 *
 * So this subclass is empty today. It exists for:
 *   - **Naming clarity** — instantiating `TuiProvider` from the SPA
 *     would be obviously wrong, and an `inpax-tui-provider` import
 *     would drag CLI-flavoured dependencies into the bundle.
 *   - **Future hook surface** — a paint queue that batches into
 *     `requestAnimationFrame`, analytics on input dialogs, or
 *     anything else web-specific belongs in this file, not the
 *     abstract base and definitely not the TUI subclass.
 *
 * The file carries `.svelte.ts` so any future state runes added
 * here are picked up by the Svelte compiler. The current subclass
 * needs none.
 */

import { UIProvider } from "@emdzej/inpax-ui-provider-core";

/**
 * How many LINE blocks fit vertically in the SPA's canvas viewport.
 *
 * Derived from the 25-row buffer minus the title strip (rows 0..3,
 * for the INIT-phase `ftextout` with `fontSize > 0`) → ~21 rows for
 * content. With `LINE_HEIGHT = 4` in the screen executor, `floor(21
 * / 4) = 5` blocks fit. Setting this here tells the screen executor
 * "host has a fixed viewport — please paginate" (an unset / 0 value
 * means "no viewport, run every block", which is what the CLI uses).
 *
 * When the canvas gains a dynamic cell-grid size, swap this constant
 * for a runtime measurement and call `setVisibleLineCount(...)` on
 * resize.
 */
const VISIBLE_LINE_COUNT = 5;

export class WebUIProvider extends UIProvider {
  constructor() {
    super();
    this.setVisibleLineCount(VISIBLE_LINE_COUNT);
  }
}
