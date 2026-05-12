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

  import type { BrowserExternalProvider } from "../lib/browser-external.svelte";

  type Props = { external: BrowserExternalProvider };
  const { external }: Props = $props();

  const viewer = $derived(external.viewer);

  function close() {
    external.viewClose();
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
      class="relative flex max-h-[80vh] w-full max-w-3xl flex-col rounded border border-zinc-700 bg-zinc-900 shadow-xl"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <header class="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <h2 class="text-sm font-semibold text-zinc-100">
          {viewer.title || viewer.fileName}
        </h2>
        <button
          type="button"
          class="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          onclick={close}
        >
          Close
        </button>
      </header>
      <pre class="flex-1 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs text-zinc-200">{viewer.content}</pre>
    </div>
  </div>
{/if}
