<script lang="ts">
  /**
   * INPA's `togglelist` multi-select dialog — the "Please select the
   * objects to be controlled" picker BMW INPA pops when a script calls
   * system function `0x16`. Used by control menus (Steuern / Ansteuern
   * Digital → Auswahl: Kontrollampen ansteuern, etc.) to let the user
   * pick which lamps / indicators / actuators to operate.
   *
   * Layout mirrors the original (see screenshot in the inpax repo):
   *   ┌───────────────────────────────┬───────────┐
   *   │ candidate list (multi-select) │   OK      │
   *   │                               │   Cancel  │
   *   │                               │   Deselect│
   *   ├───────────────────────────────┴───────────┤
   *   │ Set:                                       │
   *   │ ┌──────────────────────────────────────┐   │
   *   │ │ free-text (verbatim toggle name)     │   │
   *   │ └──────────────────────────────────────┘   │
   *   └────────────────────────────────────────────┘
   *
   * The "Set:" field is INPA's escape hatch for cases where the
   * candidate list doesn't carry the toggle the user wants — they
   * just type the name verbatim. We keep it because our candidate
   * list is empty for now (the SGBD-derived names will land here
   * once `IEdiabasProvider` grows a result-name accessor), and free
   * text is the only way to drive the script forward in the
   * meantime.
   *
   * Submit serialises the selected items + the typed text, joined by
   * a single space — INPA's serialisation, verified against the
   * KOMBI.IPO STEUERN_LEUCHTE call chain where the returned string
   * is fed straight into `INPAapiJob`.
   */

  import type { UIProvider, InputDialog } from "@emdzej/inpax-ui-provider-core";

  type Props = { ui: UIProvider };
  const { ui }: Props = $props();

  let dialog = $state<InputDialog | null>(null);
  // Set of indices selected from the candidate list.
  let selected = $state<Set<number>>(new Set());
  // Free-text "Set:" input — appended verbatim to the result.
  let custom = $state<string>("");

  $effect(() => {
    const provider = ui;
    const refresh = () => {
      const next = provider.getInputDialog();
      if (!next || next.type !== "toggle-list") {
        dialog = null;
        return;
      }
      dialog = { ...next };
      // Reset transient selection state every time a new togglelist
      // dialog opens — otherwise a previous menu's picks bleed into
      // the next one.
      selected = new Set();
      custom = "";
    };
    refresh();
    return provider.onStateChange(refresh);
  });

  const candidates = $derived<string[]>(dialog?.toggleItems ?? []);
  const multiple = $derived<boolean>(dialog?.toggleMultipleSelect ?? false);

  function toggleIndex(i: number): void {
    // Provider semantics:
    //   - multipleSelect=false  → picking a row clears any previous
    //     selection (radio-button feel).
    //   - multipleSelect=true   → checkbox-style toggling.
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
    const picked = Array.from(selected)
      .sort((a, b) => a - b)
      .map((i) => candidates[i]);
    const customTrimmed = custom.trim();
    // Selected names first, then anything the user typed verbatim,
    // joined by a single space (INPA's wire format). Empty when both
    // collections are empty — submitting "" still flips
    // `lastInputState` to 1, which is fine: the calling script's
    // own EQ-with-zero check is what decides whether the cancel
    // branch fires, and an empty `STEUERN_LEUCHTE` argument is a
    // valid no-op for the downstream job.
    const result = [...picked, ...(customTrimmed ? [customTrimmed] : [])].join(" ");
    ui.submitInput(result);
  }

  function cancel(): void {
    if (!dialog) return;
    ui.cancelInput();
  }

  // Window-level keyboard: Enter submits, Escape cancels.
  $effect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => {
      // Don't steal Enter from the inline text input — submitting
      // via the "Set:" field's onkeydown handler keeps focus where
      // the user expected, and our outer Enter still fires for
      // anything else.
      if (e.key === "Enter" && (e.target as HTMLElement)?.tagName !== "INPUT") {
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
        <!-- Candidate list. INPA scrolls these inside a small fixed
             pane; we mirror with overflow-y-auto + max-h. Empty state
             nudges the user toward the "Set:" field below. -->
        <div class="flex-1 min-h-[12rem] max-h-72 overflow-y-auto rounded border border-rule bg-base">
          {#if candidates.length === 0}
            <p class="px-2 py-3 text-xs text-faint">
              No candidate items available — type the toggle name
              into the "Set:" field below.
            </p>
          {:else}
            <ul role="listbox" aria-multiselectable={multiple}>
              {#each candidates as item, i (i)}
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
                    {item}
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>

        <!-- Buttons column. Same vertical stack as real INPA — OK,
             Cancel, then Deselect. We skip Save / Delete (set-presets
             feature) for now; those are future work. -->
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

      <!-- "Set:" free-text input. Submitting via Enter inside the
           input fires the dialog's submit() so the user doesn't have
           to mouse over to the OK button. -->
      <section class="border-t border-divider px-4 py-3 text-sm text-foreground">
        <label class="block">
          <span class="text-xs text-faint">Set:</span>
          <!-- svelte-ignore a11y_autofocus — autofocus is the right
               UX for the only editable field in the dialog. -->
          <input
            type="text"
            class="mt-1 w-full rounded border border-rule bg-base px-2 py-1 text-foreground outline-none focus:ring-1 focus:ring-accent"
            bind:value={custom}
            onkeydown={(e) => {
              if (e.key === "Enter") {
                submit();
                e.preventDefault();
              }
            }}
            autofocus
          />
        </label>
      </section>
    </div>
  </div>
{/if}
