<script lang="ts">
  /**
   * Modal viewer backing INPA's `viewopen(fileName, title)`.
   *
   * The browser-side `external` provider keeps a tiny virtual file
   * table that gets populated whenever a script reads the fault store
   * (`fs:complete` on the Ediabas provider) or otherwise writes a
   * report. `viewopen` flips its reactive `.viewer` state to the
   * file's content + title; we render it as a modal until the user
   * clicks Close (which calls `viewClose()`).
   */

  import type { BrowserExternalProvider } from "../lib/browser-external.svelte.js";

  type Props = { external: BrowserExternalProvider };
  const { external }: Props = $props();

  const viewer = $derived(external.viewer);

  // Two-second flash on the Copy button so the user sees the
  // clipboard write took. Resets on the next mount / viewer change.
  let copied = $state(false);
  let copyResetTimer: ReturnType<typeof setTimeout> | null = null;

  function close() {
    external.viewClose();
  }

  async function copy(): Promise<void> {
    const text = viewer?.content ?? "";
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      if (copyResetTimer) clearTimeout(copyResetTimer);
      copyResetTimer = setTimeout(() => {
        copied = false;
      }, 2000);
    } catch (err) {
      // Permissions / focus issues — silent failure beats a toast.
      console.warn("[viewer] clipboard write failed:", err);
    }
  }
</script>

{#if viewer}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    role="presentation"
  >
    <!-- Backdrop button absorbs clicks outside the dialog so a stray
         click closes the viewer (matches the modal-pattern users
         expect). Visually invisible, sized to the backdrop. -->
    <button
      type="button"
      aria-label="Close viewer"
      class="absolute inset-0 cursor-default"
      onclick={close}
    ></button>
    <div
      class="relative flex max-h-[80vh] w-full max-w-3xl flex-col rounded border border-rule bg-surface shadow-xl"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <header class="flex items-center justify-between border-b border-divider px-4 py-2">
        <h2 class="text-sm font-semibold text-foreground">
          {viewer.title || viewer.fileName}
        </h2>
        <div class="flex items-center gap-1">
          <button
            type="button"
            class="rounded px-2 py-1 text-xs text-muted hover:bg-elevated hover:text-foreground"
            title="Copy contents to clipboard"
            onclick={copy}
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            class="rounded px-2 py-1 text-xs text-muted hover:bg-elevated hover:text-foreground"
            onclick={close}
          >
            Close
          </button>
        </div>
      </header>
      <pre class="flex-1 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs text-foreground">{viewer.content}</pre>
    </div>
  </div>
{/if}
