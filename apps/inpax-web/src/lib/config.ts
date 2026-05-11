/**
 * localStorage-backed connection config. Mirrors ediabasx-web's
 * `apps/web/src/lib/config.ts` shape so the two apps stay in sync —
 * eventually both can read/write the same `~/.config/ediabasx/config.json`
 * structure.
 *
 * Only the connection layer lives here. INPA install paths (Ecu folder,
 * SGDAT directory) come from the user's directory picker and live on
 * the `app` state separately — they're per-install, not per-machine.
 */

export type InterfaceType = "simulation" | "webserial" | "enet";
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
  enet?: {
    host?: string;
    port?: number;
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
  enet: {
    host: "192.168.0.10",
    port: 6801,
  },
};

export function loadConfig(): WebConfig {
  if (typeof localStorage === "undefined") return structuredClone(DEFAULT_CONFIG);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_CONFIG);
    const parsed = JSON.parse(raw) as Partial<WebConfig>;
    return {
      ...structuredClone(DEFAULT_CONFIG),
      ...parsed,
      serial: { ...DEFAULT_CONFIG.serial, ...parsed.serial },
      enet: { ...DEFAULT_CONFIG.enet, ...parsed.enet },
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
