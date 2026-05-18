/**
 * Top-level reactive app state.
 *
 * Built with Svelte 5 runes (`$state`) so any component reading the
 * exported `app` object re-renders when fields mutate. Keep the surface
 * shallow — components that need deep reactivity should bind directly
 * to nested `$state` objects, not derive copies via `$derived` that
 * lose the runtime tracking.
 *
 * Why a singleton: the app is single-document — one INPA install root,
 * one running script at a time. Mirrors `apps/web/src/lib/state.svelte.ts`
 * in ediabasx.
 */

import type { InpaInstall, IpoEntry } from "@emdzej/inpax-web-provider";
import { loadConfig, type WebConfig } from "./config.js";

export type AppView = "welcome" | "install" | "browse";

interface AppState {
  /** Which top-level pane is showing. Driven by the picker UI. */
  view: AppView;
  /** Resolved INPA install layout, once the user picks a root. */
  install: InpaInstall | null;
  /** IPO files under SGDAT + CFGDAT, post-discovery. */
  ipoFiles: IpoEntry[];
  /** Currently selected IPO (UI-side only — not parsed/loaded yet). */
  selectedIpo: IpoEntry | null;
  /** Most recent error to surface in the UI (banner / toast). */
  error: string | null;
  /** Connection / interface config, persisted to localStorage. */
  config: WebConfig;
  /** Settings modal visibility. */
  showSettings: boolean;
}

export const app = $state<AppState>({
  view: "welcome",
  install: null,
  ipoFiles: [],
  selectedIpo: null,
  error: null,
  config: loadConfig(),
  showSettings: false,
});
