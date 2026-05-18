<script lang="ts">
  /**
   * Header strip above the F-key bar showing the current menu title.
   *
   * INPA's `setmenutitle "<text>"` writes through `UIProvider.setMenuTitle`
   * into `state.menuTitle`. Most BMW scripts use it for the menu's
   * human-readable label (e.g. "Fehlerspeicher" on the fault-store
   * menu, "Hauptmenü" on the main menu), so it's the natural breadcrumb
   * between the canvas content and the F-key options below it.
   *
   * Hides itself when the title is empty so screens that never call
   * setmenutitle don't get a blank bar.
   */
  import type { UIProvider } from "@emdzej/inpax-ui-provider-core";

  type Props = { ui: UIProvider };
  const { ui }: Props = $props();

  let title = $state("");

  $effect(() => {
    const provider = ui;
    const refresh = () => {
      title = provider.state.menuTitle ?? "";
    };
    refresh();
    return provider.onStateChange(refresh);
  });
</script>

{#if title}
  <div class="border-t border-divider bg-surface px-3 py-1 text-xs font-medium uppercase tracking-wider text-muted">
    {title}
  </div>
{/if}
