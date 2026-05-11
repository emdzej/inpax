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
import { TuiProvider, type ScreenBuffer } from "@emdzej/inpax-tui-provider";
import { EdiabasXProvider, Inp1Adapter } from "@emdzej/inpax-ediabasx-provider";
import { Ediabas, type EdiabasConfig } from "@emdzej/ediabasx-ediabas";
import { BrowserNativeImportProvider } from "./native-imports.js";
import { makeBrowserSgbdResolver } from "./sgbd-loader.js";
import type { InpaInstall } from "./inpa-install.js";
import type { IpoEntry } from "./ipo-browser.js";

export interface RuntimeOptions {
  install: InpaInstall;
  ipo: IpoEntry;
  /**
   * Comm transport for the Ediabas instance. Built by the caller —
   * `SimulationInterface` for offline, `SerialInterface` over a
   * `WebSerialTransport` for live ECU. Whatever shape it has, it's
   * passed through to `Ediabas`'s `transport` config field, which
   * does the duck-type check on `connect()`.
   */
  transport: EdiabasConfig["transport"];
  /** True for the simulation interface — used to skip cable I/O. */
  simulation?: boolean;
  /** Default per-request timeout in ms. Passed to `Ediabas`. */
  timeoutMs?: number;
}

export interface RuntimeHandle {
  /** Live UI state — Svelte components $effect against the underlying TuiProvider. */
  ui: TuiProvider;
  /** Buffer the canvas reads each frame. */
  screen: ScreenBuffer;
  /** Stop the scheduler + tear down providers. Idempotent. */
  dispose: () => Promise<void>;
  /** True while the scheduler is running. */
  isRunning: () => boolean;
  /**
   * Subscribe to "frame ready" events — fires once per SCREEN cycle
   * (after the executor has run all LINE blocks and the buffer is in
   * a coherent state), plus on TuiProvider state changes before any
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

  // Dump parsed structure so we can verify line.func actually points
  // at the right bytecode. The "LINE 0 runs inpainit" symptom means
  // the parser may be putting the wrong instruction list into the
  // screen's line[0].func — log the first few opcodes to compare
  // against the CLI disasm.
  console.info("[inpax-web/runtime] parsed IPO structure", {
    functions: Array.from(ipo.functions.entries()).map(([id, fn]) => ({
      id,
      name: fn.header.name,
      instrCount: fn.instructions.length,
      firstOpcodes: fn.instructions.slice(0, 4).map((i) => `0x${i.opcode.toString(16).padStart(2, "0")}`),
    })),
    menus: Array.from(ipo.menus.entries()).map(([id, m]) => ({
      id,
      name: m.header.name,
      hasFunc: !!m.func,
      funcInstrCount: m.func?.instructions.length ?? 0,
      // Every 4th instruction starting from offset 12 (F2 setitem) so
      // we can verify what's at the spots the error references. Each
      // F-key in the init block is exactly 10 instructions long.
      firstInstrs: m.func?.instructions.slice(0, 32).map((ins, idx) =>
        `${idx}:0x${ins.opcode.toString(16)}/0x${ins.operand1.toString(16)}/0x${ins.operand2.toString(16)}`
      ) ?? [],
      lastInstr: m.func ? `0x${m.func.instructions[m.func.instructions.length - 1].opcode.toString(16)}` : null,
      itemCount: m.items.length,
    })),
    screens: Array.from(ipo.screens.entries()).map(([id, sc]) => ({
      id,
      name: sc.header.name,
      hasAlloc: !!sc.allocFunc,
      allocInstrs: sc.allocFunc?.instructions.length ?? 0,
      hasInit: !!sc.initFunc,
      initInstrs: sc.initFunc?.instructions.length ?? 0,
      initFirstOpcodes: sc.initFunc?.instructions.slice(0, 4).map((i) => `0x${i.opcode.toString(16).padStart(2, "0")}`),
      lineCount: sc.lines.length,
      lineDetails: sc.lines.map((l) => ({
        name: l.header.name,
        blockId: l.header.blockId,
        instrCount: l.func?.instructions.length ?? 0,
        firstOpcodes: l.func?.instructions.slice(0, 4).map((i) => `0x${i.opcode.toString(16).padStart(2, "0")}`) ?? [],
      })),
    })),
  });

  // 2. UI provider — feeds the ScreenBuffer that the canvas component
  //    paints from. TuiProvider also tracks menu items, input dialogs,
  //    title, digital indicators, etc.
  const ui = new TuiProvider();
  const screen = ui.getScreenBuffer();

  // 3. EDIABAS — real instance with transport supplied by the caller.
  //    `loadSgbdResolver` is the browser hook for SGBD reads: both
  //    initial `loadSgbd` and the post-IDENTIFIKATION `.grp → .prg`
  //    swap route through it, so neither path touches `node:fs` /
  //    `node:path` (which Vite externalises into broken stubs).
  const ediabas = new Ediabas({
    ecuPath: "", // browser path; resolver below reads from the dir handle
    transport: options.transport,
    simulation: options.simulation ?? false,
    timeout: options.timeoutMs ?? 5000,
    loadSgbdResolver: makeBrowserSgbdResolver(options.install.ecu),
  });
  const ediabasProvider = new EdiabasXProvider({
    instance: ediabas,
    // Defer the cable `connect()` — the caller already opened the
    // transport on the user's gesture, so we don't need EdiabasXProvider
    // to call it a second time. `init()` below is still required to
    // wire the provider's internal state.
    autoConnect: false,
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
      interfaceName: options.simulation ? "simulation" : "serial",
      iniPath: "",
    },
  });
  await nativeImports.prefetchIniFiles();

  // 6. VM. The not-yet-wired surfaces (print/pem/dtm/external/sps/
  //    simulation) stay null — most INPA scripts don't touch them; the
  //    dispatcher throws "provider not available" with a clear name if
  //    they do.
  // Tick interval — temporary throttle to 1000 ms so the log stream is
  // legible while we diagnose why inpainit appears to re-execute.
  // Affects both the main scheduler (state machine + F-key handlers)
  // and the screen executor (LINE block iteration). Bump back to 16
  // (~60 fps) once we're done debugging.
  const TICK_MS = 1000;
  const vm = new VM(ipo, {
    runtime: {
      ui,
      ediabas: ediabasProvider,
      inp1: inp1Provider,
      simulation: null as any,
      print: null as any,
      pem: null as any,
      dtm: null as any,
      external: null as any,
      sps: null as any,
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
    const handler = findMenuItemHandler(ipo, itemNum);
    if (handler) {
      scheduler.queueMenuAction(itemNum, async () => {
        await vm.executeBlock(handler);
      });
    }
  });

  // Initialise the provider (event wiring, internal state). The
  // underlying `Ediabas` instance is left in its constructed-but-
  // unconnected state; the caller already opened the transport and
  // `executeJob`'s first run does the BMW INITIALISIERUNG handshake.
  await ediabasProvider.init();

  scheduler.start();

  // Run __inpa_startup__ → inpainit() asynchronously. Errors are
  // surfaced through the provider's job:error event; we don't await
  // here because the VM's run loop is open-ended.
  //
  // The start / end markers make it possible to tell at a glance
  // whether `inpainit()` is running once (expected — `__inpa_startup__`
  // calls it once and returns) or being re-entered (unexpected — would
  // mean some external code is calling vm.run() multiple times). On
  // most BMW INPA scripts inpainit makes 40+ GetPrivateProfileStringA
  // calls reading per-F-key bindings, which can look like a loop in
  // the log volume but is actually a single linear init pass.
  console.info("[inpax-web/runtime] vm.run() start — __inpa_startup__");
  void vm
    .run()
    .then(() => {
      console.info("[inpax-web/runtime] vm.run() returned — __inpa_startup__ + inpainit() complete");
    })
    .catch((err: unknown) => {
      console.error("[inpax-web/runtime] VM error:", err);
    });

  // Frame-ready fan-out — see `RuntimeHandle.onFrameReady`. Triggers:
  //   - Pre-screen / setup phase: every TuiProvider `state:changed`
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

  // ScreenExecutor is created when the script enters its first SCREEN
  // block — not at VM start — so we poll on every `tick:complete` until
  // it appears, then wire up the cycle trigger and drop state:changed.
  let cycleAttached = false;
  let cycleCount = 0;
  scheduler.on("tick:complete", () => {
    if (cycleAttached) return;
    const screenExec = vm.getScreenExecutor();
    if (!screenExec) return;
    cycleAttached = true;
    console.info("[inpax-web/runtime] ScreenExecutor attached — switching paint trigger to cycle:complete");
    screenExec.on("cycle:complete", () => {
      cycleCount++;
      // Log every cycle. While diagnosing the inpainit-rerun bug this
      // ran at 60 fps and we had to sample; at TICK_MS=1000 every
      // cycle is cheap to log and "did cycles stop?" is easier to
      // answer with a continuous stream. Tighten when the tick rate
      // is restored to 16 ms.
      console.info(`[inpax-web/runtime] screen cycle:complete #${cycleCount}`);
      if (offStateChange) {
        offStateChange();
        offStateChange = null;
      }
      dispatchFrame();
    });
    screenExec.on("phase:changed", (phase: string) => {
      console.info(`[inpax-web/runtime] screen phase → ${phase}`);
    });
    screenExec.on("line:start", (idx: number, line: { header: { name: string; blockId: number } }) => {
      if (cycleCount <= 2) {
        console.info(`[inpax-web/runtime] screen line:start idx=${idx}`, {
          name: line.header.name,
          blockId: line.header.blockId,
        });
      }
    });
    screenExec.on("line:complete", (idx: number) => {
      if (cycleCount <= 2) {
        console.info(`[inpax-web/runtime] screen line:complete idx=${idx} (first-cycle sample)`);
      }
    });
  });


  // Also log VM-level setscreen calls so we can see when the script
  // switches between s_info / s_main etc.
  ui.on("screen:ready", () => {
    console.info("[inpax-web/runtime] ui:screen:ready", {
      handle: ui.state.screenHandle,
      cyclic: ui.state.screenCyclic,
      title: ui.state.title,
    });
  });

  let disposed = false;
  return {
    ui,
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
 * Mirror of inpax CLI's findMenuItemHandler — walks the IPO's
 * menus → items list, finds the bound function block by F-key
 * number. Returns null for unbound numbers (we just log it).
 *
 * The `itemNum` field isn't a typed property of `MenuItemBlock`;
 * the parser doesn't set it explicitly. The same untyped lookup
 * lives in `packages/cli/src/commands/run.ts`. A proper fix is
 * outside the scope of the web scaffold — for now we replicate
 * the CLI's behaviour with a cast so the two surfaces agree.
 */
function findMenuItemHandler(
  ipo: ReturnType<typeof parseIpo>,
  itemNum: number
): Parameters<VM["executeBlock"]>[0] | null {
  for (const menu of ipo.menus.values()) {
    type LooseItem = { itemNum?: number; func?: Parameters<VM["executeBlock"]>[0] };
    for (const item of menu.items as unknown as LooseItem[]) {
      if (item.itemNum === itemNum && item.func) return item.func;
    }
  }
  return null;
}
