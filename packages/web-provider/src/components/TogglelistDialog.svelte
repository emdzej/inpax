<script lang="ts">
  /**
   * INPA's `togglelist` multi-select dialog — the "Please select the
   * objects to be controlled" picker BMW INPA pops when a script
   * calls system function `0x16`. Used by control menus (Steuern /
   * Ansteuern Digital → Auswahl: Kontrollampen ansteuern, etc.) to
   * let the user pick which lamps / indicators / actuators to drive.
   *
   * Items are declared by the active SCREEN's "empty" LineFunc
   * sub-blocks — the dispatcher harvests them via
   * `ScreenExecutor.getToggleItems()` and hands them here through
   * `dialog.toggleItems`. Each item carries a display `name` and a
   * `mask` (9-byte semicolon-hex). On OK, this component encodes the
   * picks via `encodeTogglelistResult` and calls `ui.submitInput`
   * with the resulting wire string:
   *   - `argNum=false` → bitwise OR of the picked masks
   *     (`"0xNN;0xNN;…"`), suitable for `INPAapiJob "STEUERN_LEUCHTE"`.
   *   - `argNum=true`  → space-separated 1-based indices (`"3 7"`).
   *
   * Layout mirrors the real INPA dialog:
   *   ┌───────────────────────────────┬───────────┐
   *   │ candidate list                │   OK      │
   *   │                               │   Cancel  │
   *   │                               │   Deselect│
   *   └───────────────────────────────┴───────────┘
   *
   * (Real INPA also has a "Set:" preset save/load row at the
   * bottom — not implemented yet, low value compared to getting the
   * core dialog correct.)
   */

  import type { UIProvider, InputDialog } from "@emdzej/inpax-ui-provider-core";
  import { encodeTogglelistResult, type ToggleItem } from "@emdzej/inpax-interfaces";

  type Props = { ui: UIProvider };
  const { ui }: Props = $props();

  let dialog = $state<InputDialog | null>(null);
  // Set of indices selected from the candidate list (0-based into
  // `items`). `encodeTogglelistResult` converts to 1-based when the
  // script requested numeric indices.
  let selected = $state<Set<number>>(new Set());

  $effect(() => {
    const provider = ui;
    const refresh = () => {
      const next = provider.getInputDialog();
      if (!next || next.type !== "toggle-list") {
        dialog = null;
        return;
      }
      dialog = { ...next };
      // Reset selection on every fresh dialog open — otherwise the
      // previous menu's picks would bleed into the next one.
      selected = new Set();
    };
    refresh();
    return provider.onStateChange(refresh);
  });

  const items = $derived<ToggleItem[]>(dialog?.toggleItems ?? []);
  const multiple = $derived<boolean>(dialog?.toggleMultipleSelect ?? false);
  const argNum = $derived<boolean>(dialog?.toggleArgNum ?? false);

  function toggleIndex(i: number): void {
    // INPA semantics:
    //   - MultipleSelectFlag=false → picking a row clears any
    //     prior selection (radio-button behaviour).
    //   - MultipleSelectFlag=true  → checkbox-style toggling.
    if (!multiple) {
      selected = selected.has(i) ? new Set() : new Set([i]);
      return;
    }
    const next = new Set(selected);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    selected = next;
  }

  function deselectAll(): void {
    selected = new Set();
  }

  function submit(): void {
    if (!dialog) return;
    const encoded = encodeTogglelistResult(items, [...selected], argNum);
    ui.submitInput(encoded);
  }

  function cancel(): void {
    if (!dialog) return;
    ui.cancelInput();
  }

  // Window-level keyboard: Enter submits, Escape cancels.
  $effect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        submit();
        e.preventDefault();
      } else if (e.key === "Escape") {
        cancel();
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
</script>

{#if dialog}
  <div
    class="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm"
    role="dialog"
    aria-modal="true"
    aria-label={dialog.title}
  >
    <div class="w-full max-w-xl rounded border border-rule bg-surface shadow-2xl">
      <header class="border-b border-divider px-4 py-2 text-sm font-semibold text-accent">
        {dialog.title || "Please select the objects to be controlled"}
      </header>

      <section class="flex gap-3 px-4 py-3 text-sm text-foreground">
        <!-- Candidate list. INPA scrolls inside a fixed pane;
             we mirror with overflow-y-auto + max-h. -->
        <div class="flex-1 min-h-[12rem] max-h-72 overflow-y-auto rounded border border-rule bg-base">
          {#if items.length === 0}
            <p class="px-2 py-3 text-xs text-faint">
              The active screen declared no controllable items. Cancel
              and pick a control screen first.
            </p>
          {:else}
            <ul role="listbox" aria-multiselectable={multiple}>
              {#each items as item, i (i)}
                {@const isSelected = selected.has(i)}
                <li>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    class="block w-full cursor-pointer px-2 py-1 text-left hover:bg-elevated focus:bg-elevated focus:outline-none"
                    class:bg-accent={isSelected}
                    class:text-zinc-950={isSelected}
                    onclick={() => toggleIndex(i)}
                  >
                    {item.name}
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>

        <!-- Buttons column: OK / Cancel / Deselect. Same vertical
             stack as real INPA. Save / Delete (set-presets) skipped
             — future work. -->
        <div class="flex w-24 flex-col gap-2">
          <button
            type="button"
            class="rounded bg-accent px-3 py-1 text-sm font-medium text-zinc-950 hover:bg-accent-muted"
            onclick={submit}
          >
            OK
          </button>
          <button
            type="button"
            class="rounded border border-rule px-3 py-1 text-sm text-muted hover:bg-elevated hover:text-foreground"
            onclick={cancel}
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded border border-rule px-3 py-1 text-sm text-muted hover:bg-elevated hover:text-foreground"
            onclick={deselectAll}
            disabled={selected.size === 0}
          >
            Deselect
          </button>
        </div>
      </section>
    </div>
  </div>
{/if}
