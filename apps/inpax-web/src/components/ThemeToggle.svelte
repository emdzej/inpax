<script lang="ts">
  /**
   * Cycle-style theme toggle in the top bar. One click steps through
   * light → dark → system → light. The icon reflects the *user's
   * choice* (not the effective resolved theme), so "system" shows a
   * monitor glyph rather than a sun/moon — important because clicking
   * needs to feel like it changes the *setting* the user picked, not
   * the screen they're looking at.
   *
   * Storage lives in `settings.svelte.ts` (the same localStorage
   * bucket as everything else); App.svelte's $effect re-applies the
   * `dark` class on <html> when `settings.theme` changes.
   */

  import { settings, cycleTheme } from "../lib/settings.svelte";

  const icon = $derived(
    settings.theme === "light" ? "☀" : settings.theme === "dark" ? "☾" : "◐"
  );
  const label = $derived(
    settings.theme === "light"
      ? "Light theme — click to switch to dark"
      : settings.theme === "dark"
        ? "Dark theme — click to follow system"
        : "Theme follows system — click to switch to light"
  );
</script>

<button
  type="button"
  class="rounded p-1 text-lg leading-none text-muted hover:bg-elevated hover:text-foreground"
  title={label}
  aria-label={label}
  onclick={cycleTheme}
>
  <span aria-hidden="true">{icon}</span>
</button>
