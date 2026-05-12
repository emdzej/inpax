<script lang="ts">
  /**
   * F1-F10 / Shift+F1-F10 bar. Reads bound menu items from the
   * provider and fires `menu:select` on click / keypress so the
   * scheduler routes the script's handler.
   *
   * Two keyboard input paths:
   *
   *   1. Real F-keys (F1..F10, Shift+F1..F10 for F11..F20). Native
   *      mapping for users with a real function row. We `preventDefault`
   *      so the browser's F1=help / F3=find don't pop. F5 (reload) and
   *      F11 (fullscreen) and F12 (devtools) are OS- or shell-level on
   *      most browsers and can't be intercepted; live with it.
   *
   *   2. Digit fallback (1..9, 0 for F10; Shift for F11..F20). Same
   *      mapping the TUI uses for terminals without real F-keys.
   *
   * Both paths are gated on focus: if the user is typing into an
   * <input>, <textarea>, or contenteditable element, neither path
   * fires — otherwise a baud-rate input couldn't accept "115200".
   * F-key shortcuts only when the page chrome (canvas etc.) has
   * focus, mirroring how the original INPA on DOS worked.
   *
   * TODO: longer-term, expose a user-configurable keymap so power
   * users can rebind these (e.g. Vim-style keys, or remap around
   * regional keyboards where digits are deadkeys).
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

  // Skip when focus is inside an editable element — otherwise the
  // digit fallback (and Escape, for that matter) would steal input
  // from <input> / <textarea> / [contenteditable]. The Shift-indicator
  // updates unconditionally though, so the visual state still
  // reflects modifier presses even while the user is typing.
  function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
  }

  // Capture Shift across the whole window. We don't subscribe per
  // button because F-key shortcuts work as global key events, and
  // the visual "SHIFT" indicator follows the global modifier state.
  $effect(() => {
    const onKey = (e: KeyboardEvent) => {
      shift = e.shiftKey;
      if (isEditableTarget(e.target)) return;

      // Real F-keys take priority — preserves muscle memory for users
      // who have an actual function row. `e.key` for F1..F10 is the
      // literal string "F1" .. "F10".
      const fMatch = e.key.match(/^F([1-9]|10)$/);
      if (fMatch) {
        const n = parseInt(fMatch[1], 10);
        const itemNum = e.shiftKey ? n + 10 : n;
        ui.selectMenuItem(itemNum);
        e.preventDefault();
        return;
      }

      // Digit fallback: 1..9 → F1..F9, 0 → F10. Shift offsets to F11..F20.
      const digitMatch = e.key.match(/^[0-9]$/);
      if (digitMatch) {
        const n = e.key === "0" ? 10 : parseInt(e.key, 10);
        const itemNum = e.shiftKey ? n + 10 : n;
        ui.selectMenuItem(itemNum);
        e.preventDefault();
        return;
      }

      if (e.key === "Escape") {
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

<div class="grid grid-cols-10 gap-px bg-elevated text-xs">
  {#each Array(10) as _, i (i)}
    {@const slot = slotFor(i)}
    <button
      type="button"
      class="flex flex-col items-center justify-center px-2 py-2 text-muted transition"
      class:bg-surface={!slot.bound}
      class:bg-elevated={slot.bound}
      class:hover:bg-elevated={slot.bound}
      class:cursor-not-allowed={!slot.bound}
      class:opacity-40={!slot.bound}
      onclick={() => slot.bound && ui.selectMenuItem(slot.bound.itemNum)}
      disabled={!slot.bound}
    >
      <span class="text-[10px] font-bold uppercase tracking-wider text-accent">
        {slot.label}
      </span>
      <span class="mt-0.5 truncate font-medium text-foreground">
        {slot.bound?.text ?? "—"}
      </span>
    </button>
  {/each}
</div>
