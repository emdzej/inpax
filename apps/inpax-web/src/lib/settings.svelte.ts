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
}

const STORAGE_KEY = "inpax.web.settings.v1";

const DEFAULTS: WebSettings = {
  startupIpo: null,
  sidebarCollapsed: false,
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
