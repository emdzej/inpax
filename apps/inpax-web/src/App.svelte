<script lang="ts">
  import { app } from "./lib/state.svelte";
  import { connection } from "./lib/connection.svelte";
  import { clearInstallHandle } from "./lib/install-storage";
  import { settings, isDarkTheme } from "./lib/settings.svelte";
  import InstallPicker from "./components/InstallPicker.svelte";
  import IpoSidebar from "./components/IpoSidebar.svelte";
  import IpoRunner from "./components/IpoRunner.svelte";
  import ConfigPanel from "./components/ConfigPanel.svelte";

  // Apply / clear the `dark` class on <html> based on the resolved
  // theme. We watch both the user's explicit choice and (when set to
  // "system") the OS preference via matchMedia so flipping the OS
  // theme updates the app live.
  $effect(() => {
    const apply = () => {
      const dark = isDarkTheme();
      const html = document.documentElement;
      if (dark) html.classList.add("dark");
      else html.classList.remove("dark");
    };
    apply();

    if (settings.theme !== "system") return;
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => apply();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  });

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

<div class="flex h-full flex-col bg-base text-foreground">
  {#if app.view === "browse" && app.install}
    <header class="flex items-center gap-4 border-b border-divider bg-surface px-4 py-2 text-sm">
      <span class="font-semibold text-accent">INPAX</span>
      <span class="text-faint">
        {app.install.root.name || "INPA install"}
      </span>

      <!-- Light/dark status badge. In light mode we want a soft tinted
           pill (light bg + dark accent text), in dark mode we keep the
           original dark-bg / light-text look. Tailwind `dark:` variants
           handle both with one class binding per state. -->
      <span
        class="ml-auto rounded px-2 py-0.5 text-xs font-medium"
        class:bg-green-100={connection.phase === "connected"}
        class:text-green-800={connection.phase === "connected"}
        class:dark:bg-green-900={connection.phase === "connected"}
        class:dark:text-green-200={connection.phase === "connected"}
        class:bg-amber-100={connection.phase === "connecting"}
        class:text-amber-800={connection.phase === "connecting"}
        class:dark:bg-amber-900={connection.phase === "connecting"}
        class:dark:text-amber-200={connection.phase === "connecting"}
        class:bg-red-100={connection.phase === "error"}
        class:text-red-800={connection.phase === "error"}
        class:dark:bg-red-900={connection.phase === "error"}
        class:dark:text-red-200={connection.phase === "error"}
        class:bg-elevated={connection.phase === "idle" || connection.phase === "disconnected"}
        class:text-muted={connection.phase === "idle" || connection.phase === "disconnected"}
      >
        {connection.message}
      </span>

      <button
        type="button"
        class="rounded border border-rule px-3 py-1 text-xs text-muted hover:border-faint hover:text-foreground"
        onclick={() => (app.showSettings = true)}
      >
        Settings
      </button>

      <button
        type="button"
        class="text-xs text-faint hover:text-muted"
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
