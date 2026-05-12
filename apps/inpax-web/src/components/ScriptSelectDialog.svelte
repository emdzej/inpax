<script lang="ts">
  /**
   * Modal picker for INPA's `scriptselect` system function.
   *
   * Triggered when the script's bytecode calls
   * `scriptselect("E46.ENG")` (or `.GER`, etc.) — the file's section
   * tree becomes the left pane (categories: Engine, Transmission,
   * Chassis, …), and the selected category's entries fill the right
   * pane (one row per IPO with its human label). The user picks an
   * IPO and confirms; the dialog resolves via
   * `ui.submitInput(<ipo-basename>)`, which the interpreter's
   * scriptselect handler turns into a `script:switch` event the
   * runtime listens to.
   *
   * Cancel resolves with `null` (handled by `cancelInput` for
   * `type === 'scriptselect'`).
   */

  import type { TuiProvider, InputDialog } from "@emdzej/inpax-tui-provider";
  import { app } from "../lib/state.svelte";
  import {
    loadScriptSelect,
    type ScriptSelectNode,
    type ScriptSelectEntry,
  } from "../lib/script-select";

  type Props = { ui: TuiProvider };
  const { ui }: Props = $props();

  let dialog = $state<InputDialog | null>(null);
  let tree = $state<ScriptSelectNode | null>(null);
  let activeNode = $state<ScriptSelectNode | null>(null);
  let selectedEntry = $state<ScriptSelectEntry | null>(null);
  let loadError = $state<string | null>(null);

  // Subscribe to the TuiProvider's state changes — fires whenever
  // any UI op happens, including the scriptselect dialog being set.
  // We filter to the scriptselect type so the regular DialogOverlay
  // can keep handling message/text/number/hex/digital.
  //
  // CRUCIAL: only re-assign `dialog` when the file actually changes
  // (open / close / different file). The script is still running
  // after `scriptselect` fires (fire-and-forget on the dispatcher
  // side) so unrelated state:changed events keep coming through;
  // re-spreading `dialog = { ...next }` on every one creates a new
  // $state object, which retriggers the file-loading effect below
  // and resets `activeNode` back to the parsed root — making it
  // look like clicking a child node "redirects to root".
  $effect(() => {
    const refresh = () => {
      const next = ui.getInputDialog();
      if (next && next.type === "scriptselect") {
        if (dialog?.scriptSelectFile !== next.scriptSelectFile) {
          dialog = { ...next };
        }
      } else if (dialog) {
        dialog = null;
        tree = null;
        activeNode = null;
        selectedEntry = null;
        loadError = null;
      }
    };
    refresh();
    return ui.onStateChange(refresh);
  });

  // When the dialog opens for a new file, read it from CFGDAT and
  // parse it. The `lastLoadedFile` guard is a belt-and-braces check
  // against re-loading: even if Svelte's reactivity picks up a
  // benign `dialog` write, we won't blow away the user's selection.
  let lastLoadedFile: string | null = null;
  $effect(() => {
    const filename = dialog?.scriptSelectFile;
    if (!filename || !app.install?.cfgdat) {
      tree = null;
      lastLoadedFile = null;
      return;
    }
    if (filename === lastLoadedFile) return;
    lastLoadedFile = filename;

    let cancelled = false;
    loadScriptSelect(app.install.cfgdat, filename)
      .then((parsed) => {
        if (cancelled) return;
        if (!parsed) {
          loadError = `Could not load ${filename} from CFGDAT/`;
          return;
        }
        tree = parsed;
        // Auto-select the root so the right pane shows something
        // immediately instead of an empty state.
        activeNode = parsed;
        selectedEntry = null;
        loadError = null;
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        loadError = err instanceof Error ? err.message : String(err);
      });
    return () => {
      cancelled = true;
    };
  });

  function confirm(): void {
    if (!selectedEntry || !selectedEntry.ipo) return;
    ui.submitInput(selectedEntry.ipo);
  }

  function cancel(): void {
    ui.cancelInput();
  }

  // Render the tree as a flat list with indentation. Each branch
  // shows on its own line; selecting a node updates `activeNode` and
  // clears the entry selection.
  type FlatNode = { node: ScriptSelectNode; depth: number };
  function flatten(root: ScriptSelectNode | null): FlatNode[] {
    if (!root) return [];
    const out: FlatNode[] = [];
    const walk = (n: ScriptSelectNode, depth: number): void => {
      out.push({ node: n, depth });
      for (const child of n.children) walk(child, depth + 1);
    };
    walk(root, 0);
    return out;
  }

  const flatTree = $derived(flatten(tree));

  // Keyboard: Enter confirms, Escape cancels. Captured at window
  // level so the user doesn't need to focus the modal.
  $effect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        if (selectedEntry && selectedEntry.ipo) {
          confirm();
          e.preventDefault();
        }
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
  >
    <div class="flex h-[70vh] w-full max-w-4xl flex-col rounded border border-rule bg-surface shadow-2xl">
      <header class="flex items-center justify-between border-b border-divider px-4 py-3">
        <div>
          <h2 class="text-sm font-bold uppercase tracking-wider text-muted">Select script</h2>
          <p class="mt-1 text-xs text-faint">{dialog.scriptSelectFile ?? "—"}</p>
        </div>
        <button
          type="button"
          class="text-faint hover:text-foreground"
          onclick={cancel}
          aria-label="Cancel"
        >
          ✕
        </button>
      </header>

      {#if loadError}
        <div class="m-4 rounded border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-800 dark:text-red-300">
          {loadError}
        </div>
      {:else if !tree}
        <div class="flex flex-1 items-center justify-center text-sm text-faint">Loading…</div>
      {:else}
        <div class="flex flex-1 overflow-hidden">
          <!-- Tree pane: categories / subcategories. -->
          <nav class="w-1/3 overflow-auto border-r border-divider bg-elevated/50">
            {#each flatTree as { node, depth } (node.section)}
              <button
                type="button"
                class="block w-full truncate px-3 py-1.5 text-left text-sm hover:bg-elevated"
                class:bg-elevated={activeNode?.section === node.section}
                class:text-accent={activeNode?.section === node.section}
                class:text-muted={activeNode?.section !== node.section}
                style="padding-left: {0.75 + depth * 1}rem"
                onclick={() => {
                  activeNode = node;
                  selectedEntry = null;
                }}
              >
                {node.description || node.section}
              </button>
            {/each}
          </nav>

          <!-- Entry pane: rows in the active category. -->
          <section class="flex-1 overflow-auto">
            {#if activeNode}
              {#if activeNode.entries.length === 0}
                <div class="p-4 text-sm text-faint">No entries in this category.</div>
              {:else}
                {#each activeNode.entries as entry, i (i)}
                  {#if entry.ipo === ""}
                    <!-- ENTRY=,, → visual separator -->
                    <div class="my-1 h-px bg-elevated"></div>
                  {:else}
                    <button
                      type="button"
                      class="flex w-full items-baseline gap-3 px-4 py-1.5 text-left text-sm hover:bg-elevated"
                      class:bg-elevated={selectedEntry === entry}
                      class:text-accent={selectedEntry === entry}
                      class:text-foreground={selectedEntry !== entry}
                      onclick={() => (selectedEntry = entry)}
                      ondblclick={() => {
                        selectedEntry = entry;
                        confirm();
                      }}
                    >
                      <span class="w-32 shrink-0 font-mono text-xs text-faint">
                        {entry.ipo}
                      </span>
                      <span class="truncate">{entry.text}</span>
                    </button>
                  {/if}
                {/each}
              {/if}
            {:else}
              <div class="p-4 text-sm text-faint">Pick a category on the left.</div>
            {/if}
          </section>
        </div>
      {/if}

      <footer class="flex justify-end gap-2 border-t border-divider bg-elevated/50 px-4 py-2">
        <button
          type="button"
          class="rounded px-3 py-1 text-sm text-muted hover:bg-elevated hover:text-foreground"
          onclick={cancel}
        >
          Cancel
        </button>
        <button
          type="button"
          class="rounded bg-accent px-3 py-1 text-sm font-medium text-zinc-950 hover:bg-accent-muted disabled:opacity-50"
          disabled={!selectedEntry || !selectedEntry.ipo}
          onclick={confirm}
        >
          Run
        </button>
      </footer>
    </div>
  </div>
{/if}
