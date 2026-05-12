<script lang="ts">
  import { app } from "./lib/state.svelte";
  import { connection } from "./lib/connection.svelte";
  import { clearInstallHandle } from "./lib/install-storage";
  import InstallPicker from "./components/InstallPicker.svelte";
  import IpoSidebar from "./components/IpoSidebar.svelte";
  import IpoRunner from "./components/IpoRunner.svelte";
  import ConfigPanel from "./components/ConfigPanel.svelte";

  async function changeFolder(): Promise<void> {
    // Drop the persisted handle so the picker comes back clean next
    // time (no "Continue with last folder" affordance for a folder
    // the user just walked away from).
    await clearInstallHandle();
    app.view = "welcome";
    app.install = null;
    app.ipoFiles = [];
    app.selectedIpo = null;
  }
</script>

<div class="flex h-full flex-col">
  {#if app.view === "browse" && app.install}
    <header class="flex items-center gap-4 border-b border-zinc-800 bg-zinc-900 px-4 py-2 text-sm">
      <span class="text-accent font-semibold">INPAX</span>
      <span class="text-zinc-500">
        {app.install.root.name || "INPA install"}
      </span>

      <span
        class="ml-auto rounded px-2 py-0.5 text-xs font-medium"
        class:bg-green-900={connection.phase === "connected"}
        class:text-green-200={connection.phase === "connected"}
        class:bg-amber-900={connection.phase === "connecting"}
        class:text-amber-200={connection.phase === "connecting"}
        class:bg-red-900={connection.phase === "error"}
        class:text-red-200={connection.phase === "error"}
        class:bg-zinc-800={connection.phase === "idle" || connection.phase === "disconnected"}
        class:text-zinc-400={connection.phase === "idle" || connection.phase === "disconnected"}
      >
        {connection.message}
      </span>

      <button
        type="button"
        class="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
        onclick={() => (app.showSettings = true)}
      >
        Settings
      </button>

      <button
        type="button"
        class="text-xs text-zinc-500 hover:text-zinc-300"
        onclick={() => void changeFolder()}
      >
        Change folder
      </button>
    </header>
    <div class="flex flex-1 overflow-hidden">
      <IpoSidebar />
      <IpoRunner />
    </div>
  {:else}
    <InstallPicker />
  {/if}

  <ConfigPanel />
</div>
