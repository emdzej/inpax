/**
 * Svelte context API for the active INPA theme.
 *
 * Library components (`ScreenCanvas`, `UserBoxOverlay`, etc.) read the
 * active theme via `getLibTheme()`. The host app sets it once at the
 * root with `setLibTheme(theme)`, typically inside an effect that
 * tracks the app's own light/dark preference.
 *
 * Without an explicit `setLibTheme` call the components fall back to
 * `classicInpaTheme` — keeps zero-config embeds working.
 *
 * Implementation notes: Svelte's `.svelte.ts` module parser is JS-
 * only (no `interface` keyword, no `import type`, no `import { type X }`).
 * Types are imported as regular bindings — TS elides them at compile
 * time since `verbatimModuleSyntax` is off in this package.
 */

import { getContext, setContext } from "svelte";
import { classicInpaTheme, InpaTheme } from "./theme.js";

const THEME_CONTEXT_KEY = Symbol("inpax-web-provider.theme");

/**
 * Install the theme context on the current Svelte component tree.
 * Call once near the root of the host app, ideally inside an
 * `$effect` that tracks the host's own light/dark preference:
 *
 *     $effect(() => {
 *       setLibTheme(isDark ? darkInpaTheme : classicInpaTheme);
 *     });
 *
 * Subsequent calls overwrite the registered theme — every reactive
 * read from `getLibTheme()` picks up the new value automatically.
 */
export function setLibTheme(theme: InpaTheme): void {
  const existing = getContext(THEME_CONTEXT_KEY) as
    | { current: InpaTheme }
    | undefined;
  if (existing) {
    existing.current = theme;
    return;
  }
  // First install — stash a $state-backed holder so consumers see
  // updates through Svelte's reactivity graph.
  const holder = $state({ current: theme });
  const getter = {
    get(): InpaTheme {
      return holder.current;
    },
  };
  // Store both the holder (mutable, for overwrites) and the
  // consumer-facing getter under separate keys.
  setContext(THEME_CONTEXT_KEY, holder);
  setContext(getterKey(THEME_CONTEXT_KEY), getter);
}

/**
 * Read the currently-installed theme. Falls back to
 * `classicInpaTheme` when no context has been installed — handy for
 * tests and storybook-style previews.
 */
export function getLibTheme(): InpaTheme {
  const ctx = getContext(getterKey(THEME_CONTEXT_KEY)) as
    | { get(): InpaTheme }
    | undefined;
  return ctx ? ctx.get() : classicInpaTheme;
}

function getterKey(base: symbol): symbol {
  // Separate symbol for the getter side of the context — keeps the
  // mutable holder hidden from consumers.
  return Symbol.for(`${String(base)}:getter`);
}
