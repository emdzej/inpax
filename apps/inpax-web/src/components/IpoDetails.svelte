<script lang="ts">
  import { app } from "../lib/state.svelte";

  // Placeholder content for Layer 1 — the next layer will parse the
  // selected IPO and show real metadata + run controls. For now we
  // surface enough of the file's metadata (size, source dir) to
  // verify the file handle is wired correctly.
  let info = $state<{ size: number; lastModified: number } | null>(null);
  let infoError = $state<string | null>(null);

  $effect(() => {
    const selected = app.selectedIpo;
    info = null;
    infoError = null;
    if (!selected) return;
    // Pull metadata only — no parse yet. Cheap and proves the lazy
    // file-read works.
    selected.handle
      .getFile()
      .then((f) => {
        info = { size: f.size, lastModified: f.lastModified };
      })
      .catch((err: unknown) => {
        infoError = err instanceof Error ? err.message : String(err);
      });
  });
</script>

<main class="flex h-full flex-1 flex-col">
  {#if !app.selectedIpo}
    <div class="flex h-full flex-col items-center justify-center text-zinc-500">
      <p class="text-lg">Pick a script from the sidebar.</p>
      <p class="mt-1 text-sm">
        Loading + running the script lands in the next milestone.
      </p>
    </div>
  {:else}
    <header class="border-b border-zinc-800 px-6 py-4">
      <h2 class="text-xl font-semibold text-zinc-100">
        {app.selectedIpo.name}
      </h2>
      <p class="text-xs text-zinc-500">
        {app.selectedIpo.origin} · file handle ready
      </p>
    </header>

    <section class="flex-1 overflow-y-auto p-6">
      {#if infoError}
        <div class="rounded border border-red-600/40 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {infoError}
        </div>
      {:else if info}
        <dl class="grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
          <dt class="text-zinc-500">Size</dt>
          <dd>{info.size.toLocaleString()} bytes</dd>
          <dt class="text-zinc-500">Modified</dt>
          <dd>{new Date(info.lastModified).toLocaleString()}</dd>
        </dl>

        <p class="mt-6 text-sm text-zinc-500">
          Next layer wires this through <code class="text-zinc-300">parseIpo()</code>
          and instantiates the VM. Web Serial config + canvas renderer come after.
        </p>
      {:else}
        <p class="text-sm text-zinc-500">Reading file metadata…</p>
      {/if}
    </section>
  {/if}
</main>
