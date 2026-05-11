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
import { SimulationInterface } from "@emdzej/ediabasx-interface-base";
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
let isSimulation = false;

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
    if (config.interface === "simulation") {
      // Cast through `unknown` — `SimulationInterface extends EdiabasInterface`
      // but the protected `connected` field defeats structural compat in
      // TS's eyes. Same pattern ediabasx-web uses.
      activeTransport = new SimulationInterface() as unknown as EdiabasConfig["transport"];
      isSimulation = true;
      setStatus("connected", "Connected · simulation");
      return;
    }

    if (config.interface === "webserial") {
      const serial = getSerial();
      if (!serial) {
        throw new Error("Web Serial API not available — Chrome / Edge / Opera on desktop required");
      }
      const port = await serial.requestPort();
      serialPort = port;
      const webTransport = new WebSerialTransport(port);
      // K+DCAN smart cables present as FTDI VCPs but Web Serial doesn't
      // expose the bitbang escape the adapter probe uses on Node, so
      // disable it — the cable still works as a passthrough.
      const iface = new SerialInterface({
        port: "webserial",
        baudRate: config.serial?.baudRate ?? 115200,
        dataBits: (config.serial?.dataBits ?? 8) as 7 | 8,
        parity: (config.serial?.parity ?? "none") as "none" | "even" | "odd",
        stopBits: (config.serial?.stopBits ?? 1) as 1 | 2,
        timeoutMs: config.serial?.timeoutMs ?? 5000,
        probeAdapterOnConnect: false,
        transport: webTransport,
      });
      activeTransport = iface as unknown as EdiabasConfig["transport"];
      isSimulation = false;
      const baud = config.serial?.baudRate ?? 115200;
      setStatus("connected", `Connected · Web Serial @ ${baud}`);
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
  isSimulation = false;
  setStatus("disconnected", "Disconnected");
  connection.errorMessage = null;
}

/**
 * Snapshot of the active transport and its flags for the runtime
 * builder. Returns null when no transport is live — the runtime
 * loader uses that to gate IPO startup behind a Connect prompt.
 */
export function getActiveTransport(): { transport: EdiabasConfig["transport"]; simulation: boolean } | null {
  if (!activeTransport) return null;
  return { transport: activeTransport, simulation: isSimulation };
}

export function isConnected(): boolean {
  return connection.phase === "connected" && activeTransport !== null;
}
