/**
 * Runtime wire-up — given an INPA install, a picked IPO, and a built
 * EDIABAS transport, build the full provider graph and start the VM.
 * Exposes a Svelte-store-style reactive `RuntimeHandle` the UI binds
 * to (ScreenBuffer, menu items, status, input dialog).
 *
 * Always wires the real `Ediabas` instance — no mock branch. Callers
 * (typically the connect flow in `connection.ts`) own the transport
 * lifecycle and pass it in; this module knows nothing about Web
 * Serial port pickers, simulation interfaces, etc.
 */

import { parseIpo } from "@emdzej/inpax-parser";
import { VM, MainScheduler } from "@emdzej/inpax-interpreter";
import type { ScreenBuffer } from "@emdzej/inpax-ui-provider-core";
import { WebUIProvider } from "./web-ui-provider.svelte.js";
import {
  NullSimulationProvider,
  NullPrintProvider,
  NullPemProvider,
  NullDtmProvider,
  NullSpsProvider,
} from "@emdzej/inpax-providers/null";
import { EdiabasXProvider, Inp1Adapter } from "@emdzej/inpax-ediabasx-provider";
import { BrowserExternalProvider } from "./browser-external.svelte.js";
import { settings, RUNTIME_TICK_MS_FAST, debugLog } from "./settings.svelte.js";
import { Ediabas, type EdiabasConfig } from "@emdzej/ediabasx-ediabas";
import { BrowserNativeImportProvider } from "./native-imports.js";
import { makeBrowserSgbdResolver } from "./sgbd-loader.js";
import type { InpaInstall } from "./inpa-install.js";
import type { IpoEntry } from "./ipo-browser.js";

export interface RuntimeOptions {
  install: InpaInstall;
  ipo: IpoEntry;
  /**
   * Callback that returns the current comm transport whenever the
   * provider needs one (i.e. on `INPAapiInit`). The script drives
   * the connection lifecycle: when `INPAapiInit` fires, the
   * dispatcher first awaits `ui.ensureConnected()` (which opens the
   * settings/connect modal and waits for the user); only then does
   * the provider's `init()` run and pull the now-ready transport.
   *
   * The caller (typically `connection.svelte.ts.getActiveTransport`)
   * may return `null` when no cable has been opened yet; the
   * provider lets the subsequent `connect()` fail naturally and the
   * dispatcher's loop turns it into a job:error / retry dialog.
   */
  getTransport: () => EdiabasConfig["transport"] | null;
  /** Default per-request timeout in ms. Passed to `Ediabas`. */
  timeoutMs?: number;
}

export interface RuntimeHandle {
  /** Live UI state — Svelte components $effect against the underlying WebUIProvider. */
  ui: WebUIProvider;
  /**
   * Browser-side `external` provider. Exposes `.viewer` $state for
   * `ViewerDialog.svelte` to render the modal that backs `viewopen`.
   */
  external: BrowserExternalProvider;
  /** Buffer the canvas reads each frame. */
  screen: ScreenBuffer;
  /** Stop the scheduler + tear down providers. Idempotent. */
  dispose: () => Promise<void>;
  /** True while the scheduler is running. */
  isRunning: () => boolean;
  /**
   * Subscribe to "frame ready" events — fires once per SCREEN cycle
   * (after the executor has run all LINE blocks and the buffer is in
   * a coherent state), plus on provider state changes before any
   * screen is active (messageboxes, initial title paint, …).
   *
   * The canvas paints from this rather than from `ui.onStateChange`
   * directly: a single LINE block fires many cell-write state changes
   * across multiple event loop ticks (because INPAapiJob is async),
   * and painting on each one shows a half-rewritten LINE — which is
   * what users perceive as flicker. Painting only on cycle boundaries
   * gives an atomic frame.
   *
   * Returns an unsubscribe function.
   */
  onFrameReady: (cb: () => void) => () => void;
}

/**
 * Build the VM + providers and start `inpainit()`.
 *
 * Returns once setup is done; the VM keeps running asynchronously
 * through MainScheduler (every 16 ms tick rebuilds the screen). The
 * caller should call `.dispose()` when the user picks a different
 * script or leaves the page.
 */
export async function startInpaRuntime(
  options: RuntimeOptions
): Promise<RuntimeHandle> {
  if (!options.install.ecu) {
    throw new Error("INPA install has no Ecu/ directory — re-pick the install folder");
  }

  // 1. Read + parse the IPO. Browser File API gives us an ArrayBuffer
  //    which the parser accepts directly (its constructor handles
  //    Uint8Array | ArrayBufferLike after the browser-safety pass).
  const ipoFile = await options.ipo.handle.getFile();
  const ipoBytes = new Uint8Array(await ipoFile.arrayBuffer());
  const ipo = parseIpo(ipoBytes);

  // 2. UI provider — feeds the ScreenBuffer that the canvas component
  //    paints from. WebUIProvider also tracks menu items, input dialogs,
  //    title, digital indicators, etc.
  const ui = new WebUIProvider();
  const screen = ui.getScreenBuffer();

  // 3. EDIABAS — real instance with transport supplied by the caller.
  //    `loadSgbdResolver` is the browser hook for SGBD reads: both
  //    initial `loadSgbd` and the post-IDENTIFIKATION `.grp → .prg`
  //    swap route through it, so neither path touches `node:fs` /
  //    `node:path` (which Vite externalises into broken stubs).
  // No transport at construction — the script's `INPAapiInit` drives
  // the cable open, via `ui.ensureConnected()` → user opens settings
  // → user clicks Connect (Web Serial port pick happens inside that
  // user gesture) → `connection.svelte.ts` builds the transport →
  // provider's `init()` pulls it via `getTransport`. Pre-binding the
  // transport here would require the user to click Connect BEFORE
  // picking an IPO, which is the old gate flow we removed.
  const ediabas = new Ediabas({
    ecuPath: "", // browser path; resolver below reads from the dir handle
    simulation: false,
    timeout: options.timeoutMs ?? 5000,
    loadSgbdResolver: makeBrowserSgbdResolver(options.install.ecu),
  });
  const ediabasProvider = new EdiabasXProvider({
    instance: ediabas,
    // autoConnect=true (default): the dispatcher's `INPAapiInit` now
    // calls `provider.init()` which will `ediabas.connect()` once the
    // transport callback returns something.
    getTransport: options.getTransport,
  });

  // 4. INP1 surface — thin adapter over the same EDIABAS state, so
  //    `INP1apiResultText("VARIANTE", 0, "")` and friends fall through
  //    to the right backend.
  const inp1Provider = new Inp1Adapter(ediabasProvider);

  // 5. Native imports — INI lookups for F-key bindings etc. Cache the
  //    INPA.INI / EDIABAS.INI eagerly so the synchronous CALLE handler
  //    has data to return.
  const nativeImports = new BrowserNativeImportProvider({
    install: options.install,
    ediabasConfig: {
      ecuPath: options.install.ecu.name,
      interfaceName: "serial",
      iniPath: "",
    },
  });
  await nativeImports.prefetchIniFiles();

  // 6. VM. Browser-side has no real hardware for simulation / print /
  //    pem / dtm / sps yet — wire the null providers so scripts that
  //    touch those system functions get a quiet no-op instead of a
  //    TypeError from a `null` provider reference. `external` is the
  //    real `BrowserExternalProvider` because INPA scripts use it to
  //    show fault-store reports (viewopen). The dispatcher's
  //    `INPAapiFsLesen` handler (in @emdzej/inpax-dispatcher) runs the
  //    job, formats the result sets via the canonical INPA template,
  //    and writes the report through `external.writeFile`. The
  //    subsequent `viewopen("na_fs.tmp", …)` reads that virtual file
  //    back via `external.viewOpen` and the `ViewerDialog` component
  //    renders it as a modal.
  const externalProvider = new BrowserExternalProvider();
  // Tick interval driven by user settings (see ConfigPanel → Developer).
  // Debug mode on → use the user's chosen `tickMs` so the log stream
  // is legible while diagnosing. Debug mode off → fast default that
  // mirrors real INPA's "no fixed tick, yield to the event loop"
  // behaviour. Captured at runtime construction; changing the
  // setting takes effect on the next script mount, not mid-run.
  const TICK_MS = settings.debugMode ? settings.tickMs : RUNTIME_TICK_MS_FAST;
  const vm = new VM(ipo, {
    runtime: {
      ui,
      ediabas: ediabasProvider,
      inp1: inp1Provider,
      simulation: new NullSimulationProvider(),
      print: new NullPrintProvider(),
      pem: new NullPemProvider(),
      dtm: new NullDtmProvider(),
      external: externalProvider,
      sps: new NullSpsProvider(),
      nativeImports,
    },
    debug: false,
    screenExecutor: { tickInterval: TICK_MS },
  });

  // 7. Scheduler. INPA screens with frequentFlag=true are designed for
  //    cooperative repaint via INPA's OnIdle handler; MainScheduler is
  //    the equivalent here. Throttled to TICK_MS while debugging.
  const scheduler = new MainScheduler(vm, { tickInterval: TICK_MS, debug: false });

  // Wire menu events from TUI provider → scheduler so F-key clicks
  // queue menu item handlers without blocking the main scheduler loop.
  ui.on("menu:select", ({ itemNum }) => {
    const menuHandle = ui.state.menuHandle;
    if (menuHandle === null) return;
    const handler = findMenuItemHandler(ipo, menuHandle, itemNum);
    if (handler) {
      scheduler.queueMenuAction(itemNum, async () => {
        debugLog(`[menu:select] running handler for F${itemNum}`);
        try {
          await vm.executeBlock(handler);
          debugLog(`[menu:select] handler for F${itemNum} done`);
        } catch (err) {
          console.error(`[menu:select] handler for F${itemNum} threw:`, err);
        }
      });
    }
  });

  // Don't initialise the provider here — the script's `INPAapiInit`
  // now drives that path through `ui.ensureConnected()` →
  // `provider.init()`. Calling it twice would `ediabas.connect()`
  // before the transport callback has anything to return.

  scheduler.start();

  // Run __inpa_startup__ → inpainit() asynchronously. Errors are
  // surfaced through the provider's job:error event; we don't await
  // here because the VM's run loop is open-ended.
  void vm.run().catch((err: unknown) => {
    console.error("[inpax-web/runtime] VM error:", err);
  });

  // Frame-ready fan-out — see `RuntimeHandle.onFrameReady`. Triggers:
  //   - Pre-screen / setup phase: every provider `state:changed`
  //     (title, F-key labels, messageboxes — whatever inpainit() writes
  //     before the first SCREEN block).
  //   - Once the screen executor's `cycle:complete` has fired once,
  //     state:changed is dropped and cycle becomes the sole trigger.
  //     state:changed fires per cell write and spans many event-loop
  //     ticks across one LINE block, so painting on it shows a half-
  //     rewritten line — exactly the Battery/Ignition flicker symptom.
  const frameListeners = new Set<() => void>();
  const dispatchFrame = () => {
    for (const cb of frameListeners) {
      try {
        cb();
      } catch (err) {
        console.error("[inpax-web/runtime] frame listener threw:", err);
      }
    }
  };

  let offStateChange: (() => void) | null = ui.onStateChange(dispatchFrame);

  // The active ScreenExecutor changes whenever the script calls
  // `setscreen` — both during inpainit's setup and every time an
  // F-key handler swaps screens. Each new executor is a fresh
  // EventEmitter, so we have to (un)subscribe `cycle:complete` on
  // each swap. Polling `tick:complete` is the cheapest signal that
  // tells us "the VM just observed the screen executor field" —
  // we compare against `attachedScreen` to detect a swap.
  let attachedScreen: ReturnType<VM["getScreenExecutor"]> = null;
  let offCycle: (() => void) | null = null;
  const onCycle = () => {
    if (offStateChange) {
      offStateChange();
      offStateChange = null;
    }
    dispatchFrame();
  };
  scheduler.on("tick:complete", () => {
    const screenExec = vm.getScreenExecutor();
    if (screenExec === attachedScreen) return;
    offCycle?.();
    offCycle = null;
    attachedScreen = screenExec;
    if (screenExec) {
      screenExec.on("cycle:complete", onCycle);
      offCycle = () => screenExec.off("cycle:complete", onCycle);
    }
  });

  let disposed = false;
  return {
    ui,
    external: externalProvider,
    screen,
    isRunning: () => !disposed && scheduler.isRunning(),
    onFrameReady: (cb) => {
      frameListeners.add(cb);
      return () => frameListeners.delete(cb);
    },
    dispose: async () => {
      if (disposed) return;
      disposed = true;
      offStateChange?.();
      scheduler.stop();
      try {
        await ediabasProvider.end();
      } catch {
        /* ignore */
      }
    },
  };
}

/**
 * Find the function block for an F-key inside the currently active
 * menu. Each `MenuItemBlock` stores its slot in `header.flags`
 * (F1=1 .. F10=10, Shift+F1=11 .. Shift+F10=20). The slot is NOT the
 * array index — MS43.IPO m_main, for example, declares item index 8
 * with flags=18 ("Gesamt" on Shift+F8), so an index-based lookup
 * routes the click to the wrong handler.
 */
function findMenuItemHandler(
  ipo: ReturnType<typeof parseIpo>,
  menuHandle: number,
  itemNum: number
): Parameters<VM["executeBlock"]>[0] | null {
  const menu = ipo.menus.get(menuHandle);
  if (!menu) return null;
  const item = menu.items.find((m) => m.header.flags === itemNum);
  return item?.func ?? null;
}
