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

  import type { UIProvider, MenuItem } from "@emdzej/inpax-ui-provider-core";

  type Props = { ui: UIProvider };
  const { ui }: Props = $props();

  let items = $state<MenuItem[]>([]);
  /* Modifier state from real Shift key presses. Tracked separately
     from `stickyShift` so a stuck sticky toggle survives transient
     Shift key chatter and vice versa. */
  let keyboardShift = $state(false);
  /* Sticky shift — armed by tapping the on-screen SHIFT button,
     auto-clears the next time the user picks a slot. Lets touch
     users reach F11..F20 since they have no physical Shift key.
     One-shot rather than toggle: mirrors mobile OS sticky-keys
     behaviour, prevents getting stuck in "shift mode" by accident. */
  let stickyShift = $state(false);
  /* Effective modifier — either source arms the shifted slot row. */
  const shift = $derived(keyboardShift || stickyShift);

  // Re-snapshot menu items on every state:changed — the provider
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
      keyboardShift = e.shiftKey;
      if (isEditableTarget(e.target)) return;

      // Real F-keys take priority — preserves muscle memory for users
      // who have an actual function row. `e.key` for F1..F10 is the
      // literal string "F1" .. "F10".
      const fMatch = e.key.match(/^F([1-9]|10)$/);
      if (fMatch) {
        const n = parseInt(fMatch[1], 10);
        const itemNum = shift ? n + 10 : n;
        ui.selectMenuItem(itemNum);
        stickyShift = false;
        e.preventDefault();
        return;
      }

      // Digit fallback: 1..9 → F1..F9, 0 → F10. Shift offsets to F11..F20.
      const digitMatch = e.key.match(/^[0-9]$/);
      if (digitMatch) {
        const n = e.key === "0" ? 10 : parseInt(e.key, 10);
        const itemNum = shift ? n + 10 : n;
        ui.selectMenuItem(itemNum);
        stickyShift = false;
        e.preventDefault();
        return;
      }

      if (e.key === "Escape") {
        ui.menuBack();
        e.preventDefault();
      }
    };
    const onUp = (e: KeyboardEvent) => {
      keyboardShift = e.shiftKey;
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onUp);
    };
  });

  /* Click-path selection helper. Mirrors the keyboard path: select
     by item number, then auto-clear sticky shift so the bar drops
     back to F1..F10 view. We use this from both F-key clicks AND
     pointer taps; not necessary for keyboard since onKey handles it. */
  function selectSlot(itemNum: number): void {
    ui.selectMenuItem(itemNum);
    stickyShift = false;
  }

  function slotFor(i: number): { label: string; bound: MenuItem | undefined } {
    const startNum = shift ? 11 : 1;
    const itemNum = startNum + i;
    const bound = items.find((m) => m.itemNum === itemNum && m.enabled);
    const label = shift ? `S+F${i + 1}` : `F${i + 1}`;
    return { label, bound };
  }
</script>

<!--
  11-column grid: leading SHIFT toggle + 10 F-key slots. The shift
  cell exists primarily for touch devices (no physical Shift key) but
  is shown to everyone — it doubles as a visual indicator of the
  current modifier state (lights up when either source is active).
  Tap = one-shot: arms shift, releases the next time the user picks
  a slot. The keyboard path also clears stickyShift on selection so
  the two input modes stay coherent.
-->
<div class="grid grid-cols-[auto_repeat(10,_minmax(0,_1fr))] gap-px bg-elevated text-xs">
  <button
    type="button"
    class="flex flex-col items-center justify-center px-3 py-2 transition"
    class:bg-surface={!shift}
    class:bg-accent={shift}
    class:text-foreground={!shift}
    class:text-white={shift}
    class:hover:bg-elevated={!shift}
    aria-pressed={shift}
    aria-label="Toggle shift (for F11–F20)"
    title="Sticky shift — tap to arm, releases after the next F-key. Lets touch users reach F11..F20."
    onclick={() => (stickyShift = !stickyShift)}
  >
    <span class="text-[10px] font-bold uppercase tracking-wider">
      Shift
    </span>
    <span class="mt-0.5 text-[10px] uppercase tracking-wider opacity-70">
      {shift ? "on" : "off"}
    </span>
  </button>
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
      onclick={() => slot.bound && selectSlot(slot.bound.itemNum)}
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
