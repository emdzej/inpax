/**
 * localStorage-backed connection config. Mirrors ediabasx-web's
 * `apps/web/src/lib/config.ts` shape so the two apps stay in sync.
 *
 * Two interfaces are practical in a browser:
 *
 *   - `webserial` drives a local USB cable directly via the Web Serial API.
 *   - `gateway`   talks to a remote `ediabasx gateway --transport websocket`
 *                 server, which in turn drives the real cable on its side.
 *
 * Simulation / raw `serial` / `kdcan` / `enet` are intentionally absent —
 * they require Node-only APIs that browsers don't expose.
 *
 * INPA install paths (Ecu folder, SGDAT directory) come from the user's
 * directory picker and live on the `app` state separately — they're
 * per-install, not per-machine.
 */

export type InterfaceType = "webserial" | "j2534" | "gateway";
export type SerialProtocol = "uart" | "kwp" | "isotp" | "tp20";
export type SerialInitMode = "fast" | "five-baud";

/**
 * Two top-level modes (mirrors `@emdzej/ediabasx-web-ui` ModeConfig):
 *
 *   - "embedded" — the browser drives the cable locally (Web Serial /
 *     J2534 / a remote ediabasx gateway). User must pick an INPA
 *     install (Ecu folder) so SGBD files can be read from disk.
 *   - "client"   — the browser talks JSON-RPC to a remote
 *     `ediabasx-server` (direct WebSocket or Bimmerz Connect relay).
 *     The server owns the cable and the SGBD catalogue — no local
 *     install needed.
 */
export type AppMode = "embedded" | "client";
export type ClientConnectionMethod = "direct" | "connect";

export interface WebConfig {
  /** Top-level mode: drive cable locally vs talk to a remote server. */
  mode: AppMode;
  /** Used when mode="embedded": which physical interface to open. */
  interface: InterfaceType;
  /** Used when mode="client" + connectionMethod="direct". */
  serverUrl?: string;
  /** Used when mode="client": direct WebSocket or Bimmerz Connect relay. */
  connectionMethod?: ClientConnectionMethod;
  /** Used when mode="client" + connectionMethod="connect" — relay URL. */
  connectRelayUrl?: string;
  serial?: {
    baudRate?: number;
    dataBits?: 7 | 8;
    parity?: "none" | "even" | "odd";
    stopBits?: 1 | 2;
    protocol?: SerialProtocol;
    initMode?: SerialInitMode;
    /** Hex string for readability — parsed at use site. */
    testerCanId?: string;
    ecuCanId?: string;
    timeoutMs?: number;
  };
  gateway?: {
    /**
     * Full WebSocket URL of the remote ediabasx gateway, e.g.
     * `ws://192.168.1.50:6801` or `wss://gateway.example.com/ediabasx`.
     * The CLI default is `ws://localhost:6801`.
     */
    url?: string;
  };
}

const STORAGE_KEY = "inpax.web.config.v1";

const DEFAULT_CONFIG: WebConfig = {
  mode: "embedded",
  interface: "webserial",
  serverUrl: "ws://localhost:6802",
  connectionMethod: "direct",
  connectRelayUrl: "wss://connect.bimmerz.app",
  serial: {
    baudRate: 115200,
    dataBits: 8,
    parity: "none",
    stopBits: 1,
    // K+DCAN cable defaults — most BMW INPA users land here. KWP2000
    // is the K-line protocol; UART is the framing the cable presents
    // over Web Serial. The ediabasx BEST/2 interpreter speaks
    // higher-level opcodes that resolve to either K-line or D-CAN
    // framing depending on the SGBD.
    protocol: "uart",
    initMode: "fast",
    timeoutMs: 5000,
  },
  gateway: {
    url: "ws://localhost:6801",
  },
};

export function loadConfig(): WebConfig {
  if (typeof localStorage === "undefined") return structuredClone(DEFAULT_CONFIG);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_CONFIG);
    const parsed = JSON.parse(raw) as Partial<WebConfig>;
    // Older builds stored `interface: "simulation" | "enet"`. Coerce
    // anything we no longer support back to the default so the UI
    // doesn't show a phantom selection.
    const iface: InterfaceType =
      parsed.interface === "webserial" ||
      parsed.interface === "j2534" ||
      parsed.interface === "gateway"
        ? parsed.interface
        : DEFAULT_CONFIG.interface;
    const mode: AppMode =
      parsed.mode === "embedded" || parsed.mode === "client"
        ? parsed.mode
        : DEFAULT_CONFIG.mode;
    const connectionMethod: ClientConnectionMethod =
      parsed.connectionMethod === "direct" || parsed.connectionMethod === "connect"
        ? parsed.connectionMethod
        : (DEFAULT_CONFIG.connectionMethod ?? "direct");
    return {
      ...structuredClone(DEFAULT_CONFIG),
      ...parsed,
      mode,
      interface: iface,
      connectionMethod,
      serial: { ...DEFAULT_CONFIG.serial, ...parsed.serial },
      gateway: { ...DEFAULT_CONFIG.gateway, ...parsed.gateway },
    };
  } catch {
    return structuredClone(DEFAULT_CONFIG);
  }
}

export function saveConfig(config: WebConfig): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function resetConfig(): WebConfig {
  if (typeof localStorage !== "undefined") localStorage.removeItem(STORAGE_KEY);
  return structuredClone(DEFAULT_CONFIG);
}

export function isWebSerialSupported(): boolean {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

/**
 * Mixed-content blocking: when the page itself is loaded over HTTPS,
 * browsers refuse to open a plain `ws://` WebSocket. UI components
 * surface this so the user understands why "Connect" fails before
 * clicking.
 */
export function isSecureContext(): boolean {
  return typeof window !== "undefined" && window.isSecureContext === true;
}
