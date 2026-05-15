/**
 * Connection lifecycle — owns the cable / simulation transport and the
 * reactive UI state surrounding it (phase, error, connected interface
 * description).
 *
 * Why separate from `runtime.svelte.ts`: the runtime is per-IPO (rebuilt
 * each time the user switches scripts) but the cable connection is
 * per-session (the user picks a port once, then runs many scripts).
 * Keeping them apart means switching scripts doesn't re-prompt for a
 * port, and disconnect/reconnect doesn't tear down the script runtime.
 *
 * Mirrors `apps/web/src/lib/runtime.svelte.ts` in ediabasx — same
 * `requestPort` ↔ `WebSerialTransport` ↔ `SerialInterface` chain.
 */

import {
  SerialInterface,
  WebSerialTransport,
  type WebSerialPortLike,
} from "@emdzej/ediabasx-interface-serial";
import { GatewayClient } from "@emdzej/ediabasx-interfaces/client";
import type { EdiabasConfig } from "@emdzej/ediabasx-ediabas";
import { app } from "./state.svelte.js";

export type ConnectionPhase =
  | "idle"           // no connection attempted yet
  | "connecting"     // requesting port / opening serial
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

// Non-reactive plumbing. `$state` would wrap these in a Proxy whose
// trapped method calls break the interfaces' `this` references.
let activeTransport: EdiabasConfig["transport"] | null = null;
let serialPort: WebSerialPortLike | null = null;

function setStatus(phase: ConnectionPhase, message: string): void {
  connection.phase = phase;
  connection.message = message;
}

// Minimal subset of `navigator.serial` so the package doesn't need
// lib.dom-Serial typings active globally. At runtime
// `navigator.serial` is the real Web Serial API.
interface WebNavigatorSerial {
  requestPort(options?: { filters?: Array<{ usbVendorId?: number; usbProductId?: number }> }): Promise<WebSerialPortLike>;
  getPorts(): Promise<WebSerialPortLike[]>;
}

function getSerial(): WebNavigatorSerial | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as unknown as { serial?: WebNavigatorSerial };
  return nav.serial ?? null;
}

/**
 * Establish a transport based on the current `app.config`. Web Serial
 * MUST run inside a user gesture (the Connect button click) — the
 * browser refuses `requestPort()` from a non-user-driven async chain.
 */
export async function connect(): Promise<void> {
  if (connection.phase === "connecting") return;
  if (connection.phase === "connected" && activeTransport) return;

  const config = app.config;
  setStatus("connecting", "Connecting…");
  connection.errorMessage = null;

  try {
    if (config.interface === "webserial") {
      const serial = getSerial();
      if (!serial) {
        throw new Error("Web Serial API not available — Chrome / Edge / Opera on desktop required");
      }
      const port = await serial.requestPort();
      serialPort = port;
      const webTransport = new WebSerialTransport(port);
      // Run the K+DCAN adapter probe over Web Serial. `pollAdapterInfo`
      // is pure byte-level I/O (purge / write telegram / read echo +
      // response) — no FTDI bitbang or DTR/RTS twiddling — so it works
      // identically over `WebSerialTransport`. When it succeeds we get
      // the cable's adapterType / version / serial / voltage /
      // ignitionStatus, which `xignit` / `xbatt` need to surface the
      // real Klemme 15 state to scripts. Passthrough FTDI cables
      // gracefully fall back via the probe's echo-only detection.
      const iface = new SerialInterface({
        port: "webserial",
        baudRate: config.serial?.baudRate ?? 115200,
        dataBits: (config.serial?.dataBits ?? 8) as 7 | 8,
        parity: (config.serial?.parity ?? "none") as "none" | "even" | "odd",
        stopBits: (config.serial?.stopBits ?? 1) as 1 | 2,
        timeoutMs: config.serial?.timeoutMs ?? 5000,
        probeAdapterOnConnect: true,
        transport: webTransport,
      });
      activeTransport = iface as unknown as EdiabasConfig["transport"];
      const baud = config.serial?.baudRate ?? 115200;
      setStatus("connected", `Connected · Web Serial @ ${baud}`);
      return;
    }

    if (config.interface === "gateway") {
      const url = config.gateway?.url?.trim();
      if (!url) {
        throw new Error("Gateway URL is empty — set ws://host:port in Settings");
      }
      if (!/^wss?:\/\//i.test(url)) {
        throw new Error("Gateway URL must start with ws:// or wss://");
      }
      // The remote ediabasx gateway owns the actual hardware link; we
      // just speak JSON-RPC to it. `GatewayClient.connect()` does the
      // WebSocket handshake AND issues a `connect` RPC that opens the
      // far-side cable — same lifecycle the SerialInterface above
      // runs locally.
      const client = new GatewayClient({ transport: "websocket", url });
      activeTransport = client as unknown as EdiabasConfig["transport"];
      setStatus("connected", `Connected · Gateway · ${url}`);
      return;
    }

    throw new Error(`Interface "${config.interface}" is not implemented in the web app yet`);
  } catch (err) {
    activeTransport = null;
    serialPort = null;
    setStatus("error", "Connect failed");
    connection.errorMessage = err instanceof Error ? err.message : String(err);
  }
}

export async function disconnect(): Promise<void> {
  // SerialInterface's `disconnect()` walks down to the WebSerialTransport
  // which closes the port. We mirror that by dropping the transport ref
  // and letting GC finalise the rest.
  const t = activeTransport as { disconnect?: () => Promise<void> } | null;
  if (t?.disconnect) {
    try {
      await t.disconnect();
    } catch {
      /* ignore — we're tearing down anyway */
    }
  }
  activeTransport = null;
  serialPort = null;
  setStatus("disconnected", "Disconnected");
  connection.errorMessage = null;
}

/**
 * Snapshot of the active transport for the runtime builder. Returns
 * null when no transport is live — the runtime loader uses that to
 * gate IPO startup behind a Connect prompt.
 */
export function getActiveTransport(): { transport: EdiabasConfig["transport"]; simulation: boolean } | null {
  if (!activeTransport) return null;
  // `simulation` is kept in the shape for API compatibility with
  // callers that still consult it; it's always `false` now that the
  // browser only exposes real interfaces (WebSerial / WS gateway).
  return { transport: activeTransport, simulation: false };
}

export function isConnected(): boolean {
  return connection.phase === "connected" && activeTransport !== null;
}
