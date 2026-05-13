/**
 * UI preferences persisted to localStorage. Distinct from `config.ts`
 * (which holds connection settings — baud rate, interface choice, …):
 * those describe the *machine* setup; this file is about the *user's
 * workspace* — what's pinned, what's collapsed, etc.
 *
 * Exposed as a reactive Svelte 5 `$state` object plus mutator
 * functions; consumers read `settings.startupIpo` directly, mutate
 * via the helpers, and a single `$effect` here writes through to
 * localStorage on every change.
 */

export type ThemeChoice = "light" | "dark" | "system";

export interface WebSettings {
  /**
   * Filename of the IPO the app should auto-run on next launch, or
   * `null` if no startup script is pinned. Case-preserving — match
   * lookup is case-insensitive (INPA installs mix `STARTUS.IPO` with
   * `Ms43_sp2.ipo` in the same folder).
   */
  startupIpo: string | null;
  /** Sidebar collapsed state — the file browser folds into a thin rail. */
  sidebarCollapsed: boolean;
  /**
   * Theme choice. "system" tracks `prefers-color-scheme` and updates
   * when the OS toggles light/dark; "light" / "dark" pin the theme
   * regardless of OS preference. App.svelte resolves this into a
   * boolean and toggles a `dark` class on <html>.
   */
  theme: ThemeChoice;
  /**
   * Developer mode — exposes throttling and other diagnostic
   * settings in the panel. When off, the runtime uses fast defaults
   * matching real INPA's no-fixed-tick "as fast as the event loop
   * allows" behaviour.
   */
  debugMode: boolean;
  /**
   * Scheduler tick interval (ms) used when `debugMode === true`.
   * Slows down both the main scheduler (state machine + F-key
   * dispatch) and the screen executor (one LINE block per tick) so
   * the log stream is legible while we diagnose VM behaviour.
   * Ignored when debug mode is off.
   */
  tickMs: number;
}

/** Tick used when debug mode is disabled — matches real INPA's "no
 *  artificial throttle, just yield to the event loop" behaviour. */
export const RUNTIME_TICK_MS_FAST = 50;

/**
 * Diagnostic `console.info` that no-ops when debug mode is off. Use
 * for runtime traces a developer wants while investigating but that
 * would be noise during normal operation (per-F-key handler entry/
 * exit, per-cycle attach diagnostics, etc.). Real warnings and
 * errors should keep going through `console.warn` / `console.error`
 * unconditionally — those signal actual defects.
 *
 * `args` is spread directly into `console.info` so callers can pass
 * objects without manual JSON-stringification.
 */
export function debugLog(...args: unknown[]): void {
  if (!settings.debugMode) return;
  console.info(...args);
}

const STORAGE_KEY = "inpax.web.settings.v1";

const DEFAULTS: WebSettings = {
  startupIpo: null,
  sidebarCollapsed: false,
  theme: "system",
  debugMode: true,
  tickMs: 500,
};

function load(): WebSettings {
  if (typeof localStorage === "undefined") return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<WebSettings>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export const settings = $state<WebSettings>(load());

function persist(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* quota / disabled — silent, settings are best-effort */
  }
}

/**
 * Pin or unpin the given IPO as the startup script. Pinning a
 * file replaces whatever was pinned before — only one startup
 * script at a time.
 */
export function toggleStartupIpo(name: string): void {
  settings.startupIpo = settings.startupIpo === name ? null : name;
  persist();
}

/** Strip an optional `.ipo` extension and lowercase for matching. */
function normaliseIpoName(name: string): string {
  return name.toLowerCase().replace(/\.ipo$/, "");
}

/** Is `entry` the currently-pinned startup script? */
export function isStartupIpo(name: string): boolean {
  if (!settings.startupIpo) return false;
  return normaliseIpoName(settings.startupIpo) === normaliseIpoName(name);
}

export function setSidebarCollapsed(collapsed: boolean): void {
  settings.sidebarCollapsed = collapsed;
  persist();
}

export function setTheme(theme: ThemeChoice): void {
  settings.theme = theme;
  persist();
}

export function cycleTheme(): void {
  // light → dark → system → light. Used by the top-bar toggle.
  const order: ThemeChoice[] = ["light", "dark", "system"];
  const idx = order.indexOf(settings.theme);
  setTheme(order[(idx + 1) % order.length]);
}

export function setDebugMode(enabled: boolean): void {
  settings.debugMode = enabled;
  persist();
}

export function setTickMs(ms: number): void {
  // Clamp to a sane range — 1 ms is meaningless (browser timer
  // resolution); 60 s is the longest useful debug pause.
  settings.tickMs = Math.max(50, Math.min(60_000, Math.round(ms)));
  persist();
}

/**
 * JSON shape of an export/import payload. Includes the workspace
 * settings (this file) plus the separately-stored connection config
 * (`config.ts`) so a single import re-creates a user's whole setup.
 *
 * `version` is bumped if the shape becomes incompatible; importers
 * read the field and either migrate or refuse old versions.
 */
export interface SettingsExport {
  version: 1;
  exportedAt: string;
  settings: WebSettings;
  config?: unknown; // shape lives in config.ts; opaque here
}

/** Build the export payload, embedding the workspace settings plus
 *  whatever `loadConfig()` returns for connection config. */
export function buildSettingsExport(connectionConfig: unknown): SettingsExport {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: { ...settings },
    config: connectionConfig,
  };
}

/**
 * Apply an imported payload in-place. Validates the version + the
 * settings shape; throws if it's missing required fields. The
 * connection-config half is returned (rather than applied here)
 * so the caller can route it through `config.ts`'s state-update
 * path — keeps this module from depending on `config.ts`.
 */
export function applySettingsImport(raw: unknown): { config: unknown } {
  if (!raw || typeof raw !== "object") {
    throw new Error("Settings file is not a JSON object");
  }
  const data = raw as Partial<SettingsExport>;
  if (data.version !== 1) {
    throw new Error(`Unsupported settings version: ${String(data.version)}`);
  }
  if (!data.settings || typeof data.settings !== "object") {
    throw new Error("Settings file is missing the `settings` field");
  }
  const incoming = data.settings as Partial<WebSettings>;
  settings.startupIpo =
    typeof incoming.startupIpo === "string" || incoming.startupIpo === null
      ? incoming.startupIpo
      : DEFAULTS.startupIpo;
  settings.sidebarCollapsed = Boolean(incoming.sidebarCollapsed);
  settings.theme =
    incoming.theme === "light" || incoming.theme === "dark" || incoming.theme === "system"
      ? incoming.theme
      : DEFAULTS.theme;
  settings.debugMode = Boolean(incoming.debugMode);
  settings.tickMs =
    typeof incoming.tickMs === "number" && Number.isFinite(incoming.tickMs)
      ? Math.max(50, Math.min(60_000, Math.round(incoming.tickMs)))
      : DEFAULTS.tickMs;
  persist();
  return { config: data.config };
}

/**
 * Resolve the user's theme choice into a concrete light/dark flag.
 * For `"system"` we consult `prefers-color-scheme` at call time.
 * Safe in SSR / pre-DOM contexts (returns the light branch).
 */
export function isDarkTheme(): boolean {
  if (settings.theme === "dark") return true;
  if (settings.theme === "light") return false;
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}
