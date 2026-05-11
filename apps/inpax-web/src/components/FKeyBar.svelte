<script lang="ts">
  /**
   * F1-F10 / Shift+F1-F10 bar. Reads bound menu items from the
   * provider and fires `menu:select` on click / keypress so the
   * scheduler routes the script's handler.
   *
   * Keyboard mapping mirrors the TUI: digits 1-9 + 0 → F1-F10; hold
   * Shift for F11-F20. Avoids browser-reserved F1-F10 keys (F5 is
   * reload, F11 is fullscreen, etc.) — same compromise the TUI made
   * for terminals that don't pass real F-keys through.
   */

  import type { TuiProvider } from "@emdzej/inpax-tui-provider";
  import type { MenuItem } from "@emdzej/inpax-tui-provider";

  type Props = { ui: TuiProvider };
  const { ui }: Props = $props();

  let items = $state<MenuItem[]>([]);
  let shift = $state(false);

  // Re-snapshot menu items on every state:changed — TuiProvider
  // mutates its internal arrays in place but emits `state:changed`
  // every time the script touches anything. Re-subscribes when `ui`
  // changes too (switching scripts gives us a fresh provider).
  $effect(() => {
    const provider = ui;
    items = provider.getMenuItems().slice();
    return provider.onStateChange(() => {
      items = provider.getMenuItems().slice();
    });
  });

  // Capture Shift across the whole window. We don't subscribe per
  // button because F-key shortcuts work as global key events, and
  // the visual "SHIFT" indicator follows the global modifier state.
  $effect(() => {
    const onKey = (e: KeyboardEvent) => {
      shift = e.shiftKey;
      // Map 1..9 → F1..F9, 0 → F10. Shift offsets to F11..F20.
      const match = e.key.match(/^[0-9]$/);
      if (match) {
        const n = e.key === "0" ? 10 : parseInt(e.key, 10);
        const itemNum = e.shiftKey ? n + 10 : n;
        ui.selectMenuItem(itemNum);
        e.preventDefault();
      } else if (e.key === "Escape") {
        ui.menuBack();
        e.preventDefault();
      }
    };
    const onUp = (e: KeyboardEvent) => {
      shift = e.shiftKey;
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onUp);
    };
  });

  function slotFor(i: number): { label: string; bound: MenuItem | undefined } {
    const startNum = shift ? 11 : 1;
    const itemNum = startNum + i;
    const bound = items.find((m) => m.itemNum === itemNum && m.enabled);
    const label = shift ? `S+F${i + 1}` : `F${i + 1}`;
    return { label, bound };
  }
</script>

<div class="grid grid-cols-10 gap-px bg-zinc-800 text-xs">
  {#each Array(10) as _, i (i)}
    {@const slot = slotFor(i)}
    <button
      type="button"
      class="flex flex-col items-center justify-center px-2 py-2 text-zinc-300 transition"
      class:bg-zinc-900={!slot.bound}
      class:bg-zinc-800={slot.bound}
      class:hover:bg-zinc-700={slot.bound}
      class:cursor-not-allowed={!slot.bound}
      class:opacity-40={!slot.bound}
      onclick={() => slot.bound && ui.selectMenuItem(slot.bound.itemNum)}
      disabled={!slot.bound}
    >
      <span class="text-[10px] uppercase tracking-wider text-zinc-500">
        {slot.label}
      </span>
      <span class="mt-0.5 truncate font-medium text-zinc-200">
        {slot.bound?.text ?? "—"}
      </span>
    </button>
  {/each}
</div>
