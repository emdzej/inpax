<script lang="ts">
  /**
   * Header strip above the F-key bar showing the current menu title.
   *
   * INPA's `setmenutitle "<text>"` writes through `TuiProvider.setMenuTitle`
   * into `state.menuTitle`. Most BMW scripts use it for the menu's
   * human-readable label (e.g. "Fehlerspeicher" on the fault-store
   * menu, "Hauptmenü" on the main menu), so it's the natural breadcrumb
   * between the canvas content and the F-key options below it.
   *
   * Hides itself when the title is empty so screens that never call
   * setmenutitle don't get a blank bar.
   */
  import type { TuiProvider } from "@emdzej/inpax-tui-provider";

  type Props = { ui: TuiProvider };
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
  <div class="border-t border-zinc-800 bg-zinc-900 px-3 py-1 text-xs font-medium uppercase tracking-wider text-zinc-300">
    {title}
  </div>
{/if}
