<script lang="ts">
  import { app } from "./lib/state.svelte";
  import InstallPicker from "./components/InstallPicker.svelte";
  import IpoSidebar from "./components/IpoSidebar.svelte";
  import IpoDetails from "./components/IpoDetails.svelte";
</script>

<div class="flex h-full flex-col">
  {#if app.view === "browse" && app.install}
    <header class="flex items-center gap-4 border-b border-zinc-800 bg-zinc-900 px-4 py-2 text-sm">
      <span class="text-accent font-semibold">INPAX</span>
      <span class="text-zinc-500">
        {app.install.root.name || "INPA install"}
      </span>
      <button
        type="button"
        class="ml-auto text-xs text-zinc-500 hover:text-zinc-300"
        onclick={() => {
          app.view = "welcome";
          app.install = null;
          app.ipoFiles = [];
          app.selectedIpo = null;
        }}
      >
        Change folder
      </button>
    </header>
    <div class="flex flex-1 overflow-hidden">
      <IpoSidebar />
      <IpoDetails />
    </div>
  {:else}
    <InstallPicker />
  {/if}
</div>
