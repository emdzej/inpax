<script lang="ts">
  /**
   * Modal overlay for INPA's interactive prompts.
   *
   * TuiProvider exposes a single `inputDialog` field that's set to one
   * of five shapes:
   *   - "message" — informational box with just an OK button
   *   - "text"    — free-form text input
   *   - "number"  — numeric input with min/max
   *   - "hex"     — hex string with min/max
   *   - "digital" — boolean toggle (trueText / falseText)
   *
   * Submit calls `ui.submitInput(value)` which resolves the script's
   * pending Promise; Cancel calls `ui.cancelInput()`. Without us the
   * script blocks indefinitely on variant-mismatch / version-mismatch
   * messageboxes — same behaviour the Node TUI handles.
   */

  import type { TuiProvider } from "@emdzej/inpax-tui-provider";
  import type { InputDialog } from "@emdzej/inpax-tui-provider";

  type Props = { ui: TuiProvider };
  const { ui }: Props = $props();

  let dialog = $state<InputDialog | null>(null);
  let inputValue = $state<string>("");
  let digitalValue = $state<boolean>(false);

  $effect(() => {
    const provider = ui;
    const refresh = () => {
      const next = provider.getInputDialog();
      // scriptselect is handled by ScriptSelectDialog (richer UI —
      // tree + entries); connect / connect-error are handled by
      // ConnectDialog. Skip them here so we don't render two modals
      // on top of each other.
      if (
        next &&
        (next.type === "scriptselect" ||
          next.type === "connect" ||
          next.type === "connect-error")
      ) {
        dialog = null;
        return;
      }
      dialog = next ? { ...next } : null;
      // Reset transient input state on each new dialog.
      if (next) {
        inputValue = typeof next.value === "string" ? next.value : String(next.value ?? "");
        digitalValue = next.type === "digital" ? Boolean(next.value) : false;
      }
    };
    refresh();
    return provider.onStateChange(refresh);
  });

  function submit() {
    if (!dialog) return;
    switch (dialog.type) {
      case "message":
        ui.submitInput(undefined);
        break;
      case "number":
      case "hex": {
        const parsed = dialog.type === "hex"
          ? parseInt(inputValue, 16)
          : Number(inputValue);
        ui.submitInput(Number.isFinite(parsed) ? parsed : 0);
        break;
      }
      case "digital":
        ui.submitInput(digitalValue);
        break;
      case "text":
      default:
        ui.submitInput(inputValue);
        break;
    }
  }

  function cancel() {
    if (!dialog) return;
    ui.cancelInput();
  }

  // Keyboard: Enter submits, Escape cancels. Captured at window level
  // so the user doesn't need to focus the modal to press Enter.
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
  >
    <div class="w-full max-w-md rounded border border-rule bg-surface shadow-2xl">
      <header class="border-b border-divider px-4 py-2 text-sm font-semibold text-accent">
        {dialog.title || "INPA"}
      </header>
      <section class="space-y-3 px-4 py-3 text-sm text-foreground">
        <p class="whitespace-pre-wrap">{dialog.text}</p>

        {#if dialog.type === "text" || dialog.type === "number" || dialog.type === "hex"}
          <!-- svelte-ignore a11y_autofocus — autofocus is the right
               UX for a transient prompt the user just triggered. -->
          <input
            type={dialog.type === "number" ? "number" : "text"}
            class="w-full rounded border border-rule bg-base px-2 py-1 text-foreground outline-none focus:ring-1 focus:ring-accent"
            bind:value={inputValue}
            autofocus
          />
          {#if dialog.type === "number" || dialog.type === "hex"}
            <p class="text-xs text-faint">
              min: {dialog.min ?? "—"} · max: {dialog.max ?? "—"}
            </p>
          {/if}
        {:else if dialog.type === "digital"}
          <label class="flex items-center gap-2">
            <input type="checkbox" bind:checked={digitalValue} />
            <span>{digitalValue ? (dialog.trueText ?? "true") : (dialog.falseText ?? "false")}</span>
          </label>
        {/if}
      </section>
      <footer class="flex justify-end gap-2 border-t border-divider bg-elevated/50 px-4 py-2">
        {#if dialog.type !== "message"}
          <button
            type="button"
            class="rounded px-3 py-1 text-sm text-muted hover:bg-elevated hover:text-foreground"
            onclick={cancel}
          >
            Cancel
          </button>
        {/if}
        <button
          type="button"
          class="rounded bg-accent px-3 py-1 text-sm font-medium text-zinc-950 hover:bg-accent-muted"
          onclick={submit}
        >
          OK
        </button>
      </footer>
    </div>
  </div>
{/if}
