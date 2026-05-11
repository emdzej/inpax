<script lang="ts">
  import { app } from "../lib/state.svelte";

  // Group entries by origin (SGDAT / CFGDAT) so the sidebar shows them
  // under section headers — CFGDAT is small and lives at the top
  // (script entry points usually live there), SGDAT below it.
  let grouped = $derived.by(() => {
    const groups = new Map<string, typeof app.ipoFiles>();
    for (const entry of app.ipoFiles) {
      const list = groups.get(entry.origin);
      if (list) list.push(entry);
      else groups.set(entry.origin, [entry]);
    }
    // Stable section order: CFGDAT first if present, then SGDAT.
    const sections: Array<[string, typeof app.ipoFiles]> = [];
    if (groups.has("CFGDAT")) sections.push(["CFGDAT", groups.get("CFGDAT")!]);
    if (groups.has("SGDAT")) sections.push(["SGDAT", groups.get("SGDAT")!]);
    return sections;
  });

  let filter = $state("");
  let filteredSections = $derived.by(() => {
    if (!filter.trim()) return grouped;
    const needle = filter.toLowerCase();
    return grouped
      .map(([origin, entries]) => [
        origin,
        entries.filter((e) => e.name.toLowerCase().includes(needle)),
      ] as const)
      .filter(([, entries]) => entries.length > 0);
  });
</script>

<aside class="flex h-full w-72 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900">
  <div class="border-b border-zinc-800 p-3">
    <input
      type="search"
      class="w-full rounded bg-zinc-800 px-3 py-1.5 text-sm placeholder-zinc-500 outline-none focus:ring-1 focus:ring-accent"
      placeholder="Filter scripts…"
      bind:value={filter}
    />
  </div>

  <div class="flex-1 overflow-y-auto">
    {#each filteredSections as [origin, entries] (origin)}
      <div class="border-b border-zinc-800/60 last:border-0">
        <div class="sticky top-0 bg-zinc-900/95 px-3 py-1.5 text-xs uppercase tracking-wider text-zinc-500">
          {origin} <span class="text-zinc-600">({entries.length})</span>
        </div>
        <ul>
          {#each entries as entry (entry.origin + "/" + entry.name)}
            <li>
              <button
                type="button"
                class="w-full px-3 py-1 text-left text-sm transition hover:bg-zinc-800"
                class:bg-zinc-800={app.selectedIpo?.handle === entry.handle}
                class:text-accent={app.selectedIpo?.handle === entry.handle}
                onclick={() => (app.selectedIpo = entry)}
              >
                {entry.name}
              </button>
            </li>
          {/each}
        </ul>
      </div>
    {/each}

    {#if filteredSections.length === 0}
      <div class="p-4 text-center text-sm text-zinc-500">
        {filter ? "No matches." : "No .ipo files found."}
      </div>
    {/if}
  </div>

  <footer class="border-t border-zinc-800 p-3 text-xs text-zinc-500">
    {app.ipoFiles.length} script{app.ipoFiles.length === 1 ? "" : "s"}
  </footer>
</aside>
