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

export type InterfaceType = "webserial" | "gateway";
export type SerialProtocol = "uart" | "kwp" | "isotp" | "tp20";
export type SerialInitMode = "fast" | "five-baud";

export interface WebConfig {
  interface: InterfaceType;
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
  interface: "webserial",
  serial: {
    baudRate: 115200,
    dataBits: 8,
    parity: "none",
    stopBits: 1,
    // K+DCAN cable defaults — most BMW INPA users land here. KWP2000
    // is the K-line protocol; UART is the framing the cable presents
    // over Web Serial. The interpreter speaks higher-level BEST2
    // opcodes that compose either depending on the SGBD.
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
      parsed.interface === "webserial" || parsed.interface === "gateway"
        ? parsed.interface
        : DEFAULT_CONFIG.interface;
    return {
      ...structuredClone(DEFAULT_CONFIG),
      ...parsed,
      interface: iface,
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
