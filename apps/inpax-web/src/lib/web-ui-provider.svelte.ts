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

export class WebUIProvider extends UIProvider {}
