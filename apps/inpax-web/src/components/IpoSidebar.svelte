<script lang="ts">
  import { app } from "../lib/state.svelte";
  import {
    settings,
    toggleStartupIpo,
    isStartupIpo,
    setSidebarCollapsed,
  } from "../lib/settings.svelte";

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

{#if settings.sidebarCollapsed}
  <!-- Collapsed rail — just an expand button. Keeps a stable layout
       slot so the canvas doesn't reflow on toggle. -->
  <aside class="flex h-full w-10 shrink-0 flex-col items-center border-r border-divider bg-surface">
    <button
      type="button"
      class="mt-2 rounded p-2 text-muted hover:bg-elevated hover:text-foreground"
      title="Expand script list"
      aria-label="Expand script list"
      onclick={() => setSidebarCollapsed(false)}
    >
      <!-- chevron-right (▶) drawn as text to avoid an SVG dependency. -->
      <span aria-hidden="true">›</span>
    </button>
  </aside>
{:else}
  <aside class="flex h-full w-72 shrink-0 flex-col border-r border-divider bg-surface">
    <div class="flex items-center gap-2 border-b border-divider p-3">
      <input
        type="search"
        class="min-w-0 flex-1 rounded bg-elevated px-3 py-1.5 text-sm placeholder-faint outline-none focus:ring-1 focus:ring-accent"
        placeholder="Filter scripts…"
        bind:value={filter}
      />
      <button
        type="button"
        class="rounded p-1.5 text-muted hover:bg-elevated hover:text-foreground"
        title="Collapse script list"
        aria-label="Collapse script list"
        onclick={() => setSidebarCollapsed(true)}
      >
        <span aria-hidden="true">‹</span>
      </button>
    </div>

    <div class="flex-1 overflow-y-auto">
      {#each filteredSections as [origin, entries] (origin)}
        <div class="border-b border-divider last:border-0">
          <div class="sticky top-0 bg-surface px-3 py-1.5 text-xs uppercase tracking-wider text-faint">
            {origin} <span class="text-faint">({entries.length})</span>
          </div>
          <ul>
            {#each entries as entry (entry.origin + "/" + entry.name)}
              {@const pinned = isStartupIpo(entry.name)}
              {@const selected = app.selectedIpo?.handle === entry.handle}
              <!-- `group` lets the play button react to hover anywhere
                   on the row. Combined with `class:opacity-0={!selected}`
                   that means the button is hidden by default, shows on
                   hover via `group-hover:opacity-100`, and stays
                   visible whenever the row is the current selection. -->
              <li class="group flex items-center">
                <button
                  type="button"
                  class="min-w-0 flex-1 truncate px-3 py-1 text-left text-sm transition hover:bg-elevated"
                  class:bg-elevated={selected}
                  class:text-accent={selected}
                  onclick={() => (app.selectedIpo = entry)}
                >
                  {entry.name}
                </button>
                <!-- Pin / unpin as startup script. Filled play =
                     this IPO will auto-mount on next app launch;
                     outlined play = pin-action available. Only one
                     entry can be pinned at a time. -->
                <button
                  type="button"
                  class="px-2 py-1 text-sm leading-none transition group-hover:opacity-100 hover:bg-elevated"
                  class:opacity-0={!selected}
                  class:text-accent={pinned}
                  class:text-muted={!pinned}
                  title={pinned ? "Unpin (won't run on next launch)" : "Pin as startup script"}
                  aria-label={pinned ? "Unpin startup script" : "Pin as startup script"}
                  aria-pressed={pinned}
                  onclick={() => toggleStartupIpo(entry.name)}
                >
                  <span aria-hidden="true">{pinned ? "▶" : "▷"}</span>
                </button>
              </li>
            {/each}
          </ul>
        </div>
      {/each}

      {#if filteredSections.length === 0}
        <div class="p-4 text-center text-sm text-faint">
          {filter ? "No matches." : "No .ipo files found."}
        </div>
      {/if}
    </div>

    <footer class="border-t border-divider p-3 text-xs text-faint">
      {app.ipoFiles.length} script{app.ipoFiles.length === 1 ? "" : "s"}
    </footer>
  </aside>
{/if}
