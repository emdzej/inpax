/**
 * Connection lifecycle — owns the active `IEdiabas` instance and the
 * reactive UI state around it (phase, error, connected descriptor).
 *
 * Mirrors `apps/web/src/lib/runtime.svelte.ts` in ediabasx-web: one
 * `IEdiabas` instance regardless of mode, built lazily when the user
 * clicks Connect.
 *
 *   • Embedded mode — local Web Serial / J2534 / Gateway interface
 *     wrapped in `EmbeddedEdiabas` with a `loadSgbdResolver` that
 *     reads SGBD bytes from the INPA install's directory handle.
 *
 *   • Client mode — remote `EdiabasClient` against an ediabasx-server,
 *     either direct WebSocket or Bimmerz Connect relay. Server owns
 *     the cable + SGBD catalogue, so no local install needed.
 *
 * Why separate from `runtime.svelte.ts`: the runtime is per-IPO
 * (rebuilt each time the user switches scripts) but the connection is
 * per-session (the user picks a port once, then runs many scripts).
 * Keeping them apart means switching scripts doesn't re-prompt for a
 * port, and disconnect/reconnect doesn't tear down the script runtime.
 */

import {
  SerialInterface,
  WebSerialTransport,
  type WebSerialPortLike,
} from "@emdzej/ediabasx-interface-serial";
import { J2534Interface } from "@emdzej/ediabasx-interface-j2534";
import { WebSerialTransport as J2534WebSerialTransport } from "@emdzej/j2534-webserial";
import { GatewayClient } from "@emdzej/ediabasx-interfaces/client";
import { EdiabasInterface } from "@emdzej/ediabasx-interface-base";
import { EdiabasClient, EmbeddedEdiabas } from "@emdzej/ediabasx-client";
import type { IEdiabas } from "@emdzej/ediabasx-core";
import type { EdiabasConfig } from "@emdzej/ediabasx-ediabas";
import { app } from "./state.svelte.js";

export type ConnectionPhase =
  | "idle"           // no connection attempted yet
  | "connecting"     // requesting port / opening socket
  | "connected"      // ready to run jobs
  | "error"          // connect failed
  | "disconnected";  // user explicitly disconnected

interface ConnectionUiState {
  phase: ConnectionPhase;
  /** Human-friendly status line for the connection pill / banner. */
  message: string;
  /** Most recent error from connect. Cleared on a successful connect. */
  errorMessage: string | null;
}

export const connection = $state<ConnectionUiState>({
  phase: "idle",
  message: "Not connected",
  errorMessage: null,
});

/**
 * Non-reactive plumbing. `$state` would wrap these in a Proxy whose
 * trapped method calls break the interfaces' `this` references.
 *
 * `instance` is the live `IEdiabas` after a successful Connect — what
 * the runtime's `getActiveIEdiabas()` returns. Null when disconnected.
 *
 * `serialPort` was historically retained to release the Web Serial
 * port grant on disconnect; the active `SerialInterface` already
 * owns that lifecycle so we drop the parallel ref.
 */
let instance: IEdiabas | null = null;
let serialPort: WebSerialPortLike | null = null;

function setStatus(phase: ConnectionPhase, message: string): void {
  connection.phase = phase;
  connection.message = message;
}

/* Minimal subset of `navigator.serial` so the package doesn't need
   lib.dom-Serial typings active globally. At runtime
   `navigator.serial` is the real Web Serial API. */
interface WebNavigatorSerial {
  requestPort(options?: { filters?: Array<{ usbVendorId?: number; usbProductId?: number }> }): Promise<WebSerialPortLike>;
  getPorts(): Promise<WebSerialPortLike[]>;
}

function getSerial(): WebNavigatorSerial | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as unknown as { serial?: WebNavigatorSerial };
  return nav.serial ?? null;
}

/* ── SGBD resolver for embedded mode ─────────────────────────────── */

/**
 * Browser-side SGBD bytes resolver for `EmbeddedEdiabas.loadSgbdResolver`.
 *
 * Walks the INPA install's discovered Ecu directory (via the
 * `FileSystemDirectoryHandle` the user picked) and returns the bytes
 * for a requested SGBD name, with case-insensitive matching and a
 * `.prg ↔ .grp` extension swap fallback (mirrors the Node-fs side's
 * `resolveCaseInsensitive`). Without this wired in,
 * `Ediabas.swapToVariant` falls into a Node `fs/promises` branch
 * that's stubbed in browser bundles and the GRP→PRG swap silently
 * fails.
 */
async function resolveSgbdInInstall(
  filename: string,
): Promise<{ bytes: Uint8Array; name: string }> {
  const install = app.install;
  if (!install || !install.ecu) {
    throw new Error(`SGBD resolver invoked with no install / Ecu folder loaded (file: ${filename})`);
  }
  const ecuDir = install.ecu;

  const lower = filename.toLowerCase();
  const hasExt = /\.(prg|grp)$/.test(lower);
  const stripped = lower.replace(/\.(prg|grp)$/, "");

  /* Build the set of acceptable on-disk basenames:
       • If the caller passed an extension (e.g. `D_KOMBI.grp`):
         exact match first, then `.prg ↔ .grp` swap fallback.
       • If the caller passed a bare ECU name (e.g. `D_000D`, which is
         what INPA scripts always do): probe BOTH `.prg` AND `.grp`.
         BMW ships some ECUs as `.grp`-only group files; pre-fix we
         probed `.prg` only and silently missed them. Native EDIABAS
         `ResolveSgbdFile` does the same dual probe. */
  const candidates: string[] = hasExt
    ? [lower, `${stripped}${lower.endsWith(".prg") ? ".grp" : ".prg"}`]
    : [`${stripped}.prg`, `${stripped}.grp`];

  /* Case-insensitive scan of the install's Ecu directory. */
  let matchHandle: FileSystemFileHandle | null = null;
  let matchName = filename;
  for await (const [entryName, handle] of ecuDir.entries()) {
    if (handle.kind !== "file") continue;
    const entryLower = entryName.toLowerCase();
    if (candidates.includes(entryLower)) {
      matchHandle = handle as FileSystemFileHandle;
      matchName = entryName;
      break;
    }
  }
  if (!matchHandle) {
    throw new Error(`SGBD not found in install: ${filename}`);
  }
  const file = await matchHandle.getFile();
  const bytes = new Uint8Array(await file.arrayBuffer());
  return { bytes, name: matchName };
}

/* ── Interface builders (embedded mode) ──────────────────────────── */

/**
 * Build the EDIABAS communication interface from the current
 * `app.config` (embedded mode). Web Serial / J2534 / Gateway are the
 * only choices a browser can drive. Returns an `EdiabasInterface`
 * subclass that `EmbeddedEdiabas` wraps.
 *
 * Must run inside the user-gesture chain: Web Serial's
 * `requestPort()` refuses non-user-driven calls.
 */
async function buildInterface(): Promise<EdiabasInterface> {
  const config = app.config;

  if (config.interface === "webserial") {
    const serial = getSerial();
    if (!serial) {
      throw new Error("Web Serial API not available — Chrome / Edge / Opera on desktop required");
    }
    const port = await serial.requestPort();
    serialPort = port;
    const webTransport = new WebSerialTransport(port);
    /* K+DCAN adapter probe is on by default — `pollAdapterInfo` is
       byte-level I/O that works identically over `WebSerialTransport`.
       When it succeeds we get adapterType/version/serial/voltage/
       ignitionStatus, which `xignit` / `xbatt` need to surface real
       Klemme 15 state. Passthrough FTDI cables fall back via the
       probe's echo-only detection. */
    return new SerialInterface({
      port: "webserial",
      baudRate: config.serial?.baudRate ?? 115200,
      dataBits: (config.serial?.dataBits ?? 8) as 7 | 8,
      parity: (config.serial?.parity ?? "none") as "none" | "even" | "odd",
      stopBits: (config.serial?.stopBits ?? 1) as 1 | 2,
      timeoutMs: config.serial?.timeoutMs ?? 5000,
      probeAdapterOnConnect: true,
      transport: webTransport,
    });
  }

  if (config.interface === "j2534") {
    /* J2534 via Tactrix OpenPort 2.0. The j2534-webserial transport
       pops the Web Serial port picker inside its own `open()` so we
       still call connect() from the user gesture. DS2 @ 9600 is the
       seed for the initial channel; the SGBD's `INITIALISIERUNG`
       reconfigures via `setCommParameter`. */
    if (typeof navigator === "undefined" || !("serial" in navigator)) {
      throw new Error("Web Serial API not available — Chrome / Edge / Opera on desktop required");
    }
    const j2534Transport = new J2534WebSerialTransport();
    return new J2534Interface({
      transport: { kind: "instance", transport: j2534Transport },
      protocol: "ds2",
      baudRate: 9600,
    });
  }

  if (config.interface === "gateway") {
    const url = config.gateway?.url?.trim();
    if (!url) {
      throw new Error("Gateway URL is empty — set ws://host:port in Settings");
    }
    if (!/^wss?:\/\//i.test(url)) {
      throw new Error("Gateway URL must start with ws:// or wss://");
    }
    /* The remote ediabasx gateway owns the actual hardware link; we
       just speak JSON-RPC to it. `GatewayClient.connect()` does the
       WebSocket handshake AND issues a `connect` RPC that opens the
       far-side cable — same lifecycle SerialInterface runs locally. */
    return new GatewayClient({ transport: "websocket", url }) as unknown as EdiabasInterface;
  }

  throw new Error(`Interface "${config.interface}" is not implemented in the web app yet`);
}

/* ── Connect / disconnect ────────────────────────────────────────── */

/**
 * Establish the IEdiabas connection based on the current
 * `app.config.mode`. Web Serial MUST run inside a user gesture (the
 * Connect button click) — the browser refuses `requestPort()` from a
 * non-user-driven async chain.
 *
 * Builds the IEdiabas but does NOT call `init()` on it — that's the
 * runtime/provider's job, invoked when the script's `INPAapiInit`
 * fires after `ui.ensureConnected()` resolves. Building eagerly here
 * gives the runtime something to grab via `getActiveIEdiabas()`.
 *
 * For Bimmerz Connect, the user must have provided sessionId + token
 * via the connect-session dialog before calling this — we show the
 * dialog when the prerequisite is missing.
 */
export async function connect(): Promise<void> {
  if (connection.phase === "connecting") return;
  if (connection.phase === "connected" && instance) return;

  const config = app.config;

  /* Bimmerz Connect needs sessionId + token from the user first. */
  if (config.mode === "client" && config.connectionMethod === "connect" && !app.connectSessionId) {
    app.showConnectSession = true;
    return;
  }

  setStatus("connecting", "Connecting…");
  connection.errorMessage = null;

  try {
    let next: IEdiabas;
    let label: string;

    if (config.mode === "client") {
      /* Remote — direct WebSocket or Bimmerz Connect relay. */
      const isConnect = config.connectionMethod === "connect";

      if (isConnect && app.connectSessionId && app.connectToken) {
        const relayUrl = config.connectRelayUrl?.trim() || "wss://connect.bimmerz.app";
        const { dial } = await import("@emdzej/swsrs-client");
        const peer = await dial({
          relayURL: relayUrl,
          sessionId: app.connectSessionId,
          token: app.connectToken,
        });
        next = new EdiabasClient({
          transport: "websocket",
          socket: peer.socket,
        });
        label = "Bimmerz Connect";
      } else {
        const url = config.serverUrl?.trim();
        if (!url) throw new Error("Server URL is empty — set it in Settings");
        if (!/^wss?:\/\//i.test(url)) throw new Error("Server URL must start with ws:// or wss://");
        next = new EdiabasClient({ transport: "websocket", url });
        label = url;
      }
    } else {
      /* Embedded — build interface + wrap in EmbeddedEdiabas with the
         install's SGBD resolver. */
      if (!app.install) {
        throw new Error("Pick an INPA install folder first (Settings → Install)");
      }
      const iface = await buildInterface();
      next = new EmbeddedEdiabas({
        /* sgbdPath is unused when loadSgbdResolver is set — the
           resolver handles all lookups from the directory handle. */
        sgbdPath: ".",
        interface: iface,
        timeout: config.serial?.timeoutMs ?? 5000,
        loadSgbdResolver: resolveSgbdInInstall as EdiabasConfig["loadSgbdResolver"],
      });
      label = describeEmbeddedDevice();
    }

    /* Eager init() — open the cable / call server `init` RPC right
       now while we're inside the user-gesture chain. Skipping this
       and deferring init() to the script's `INPAapiInit` (via the
       provider's `getInstance` factory) opens an idle gap on the
       Bimmerz Connect relay path: between `connect()` returning and
       the script's first job, the relay closes the socket on its
       idle timer. Direct WebSocket is more forgiving because there's
       no third party policing idleness — works either way. Match
       ediabasx-web's flow which inits eagerly here. */
    await next.init();

    instance = next;
    /* Unified format — `Connected: <device|url|bimmerzconnect>`. */
    setStatus("connected", `Connected: ${label}`);
  } catch (err) {
    instance = null;
    serialPort = null;
    setStatus("error", "Connect failed");
    connection.errorMessage = err instanceof Error ? err.message : String(err);
  }
}

/**
 * Render the device descriptor for the embedded path — just the
 * device, not the "Connected" prefix (the caller adds that
 * uniformly via `Connected: <device|url|bimmerzconnect>`).
 */
function describeEmbeddedDevice(): string {
  const config = app.config;
  if (config.interface === "webserial") {
    const baud = config.serial?.baudRate;
    return baud ? `Web Serial @ ${baud}` : "Web Serial";
  }
  if (config.interface === "j2534") {
    return "J2534 (OpenPort 2.0)";
  }
  if (config.interface === "gateway") {
    const url = config.gateway?.url?.trim();
    return url ? `Gateway · ${url}` : "Gateway";
  }
  return config.interface;
}

export async function disconnect(): Promise<void> {
  if (instance) {
    try {
      await instance.end();
    } catch {
      /* ignore — we're tearing down anyway */
    }
    instance = null;
  }
  serialPort = null;
  setStatus("disconnected", "Disconnected");
  connection.errorMessage = null;
}

/**
 * Snapshot of the active IEdiabas for the runtime builder. Returns
 * `null` when no connection is live — the runtime's provider lets the
 * subsequent `init()` fail naturally so the dispatcher's loop can
 * turn it into a job:error / retry dialog.
 *
 * Both embedded (`EmbeddedEdiabas`) and client (`EdiabasClient`)
 * implement the `IEdiabas` surface, so the runtime doesn't need to
 * know which mode is in play.
 */
export function getActiveIEdiabas(): IEdiabas | null {
  return instance;
}

export function isConnected(): boolean {
  return connection.phase === "connected" && instance !== null;
}

/**
 * Marker for legacy callers. The old `getActiveTransport()` returned
 * a raw EdiabasInterface; the new world hides that detail behind the
 * IEdiabas wrapper. Kept as a no-op alias so any consumer still
 * importing it gets a clear typecheck error pointing at the rename
 * rather than a runtime crash.
 *
 * @deprecated Use `getActiveIEdiabas()` and pass the result to
 * `EdiabasXProvider` as `instance:` (or via `getInstance` factory).
 */
export function getActiveTransport(): never {
  throw new Error(
    "connection.getActiveTransport() was removed in the IEdiabas migration. " +
    "Use getActiveIEdiabas() and pass it to EdiabasXProvider as `instance:` " +
    "(or via `getInstance` factory for lazy resolution).",
  );
}

