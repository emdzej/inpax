<script lang="ts">
  import { app } from "./lib/state.svelte";
  import { connection } from "./lib/connection.svelte";
  import { settings, isDarkTheme } from "./lib/settings.svelte";
  import InstallPicker from "./components/InstallPicker.svelte";
  import IpoSidebar from "./components/IpoSidebar.svelte";
  import IpoRunner from "./components/IpoRunner.svelte";
  import ConfigPanel from "./components/ConfigPanel.svelte";
  import ThemeToggle from "./components/ThemeToggle.svelte";

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

</script>

<div class="flex h-full flex-col bg-base text-foreground">
  {#if app.view === "browse" && app.install}
    <header class="flex items-center gap-4 border-b border-divider bg-surface px-4 py-2 text-sm">
      <span class="font-semibold text-accent">INPAX</span>
      <!-- Build version surfaced from package.json via Vite `define`.
           Linked to the matching git tag so users can pop the changelog
           in one click. Faint styling keeps it as metadata, not chrome. -->
      <a
        href="https://github.com/emdzej/inpax/releases/tag/v{__APP_VERSION__}"
        target="_blank"
        rel="noopener noreferrer"
        class="text-xs text-faint transition hover:text-foreground"
        title="View release notes on GitHub"
      >
        v{__APP_VERSION__}
      </a>
      <!-- GitHub repo link. The 16×16 mark is GitHub's official
           public-domain octocat SVG (https://github.com/logos);
           we inline rather than reference an asset so the icon
           is theme-coloured (`currentColor`) and renders before
           any network fetch. `noopener noreferrer` is standard
           hygiene for `target="_blank"`. -->
      <a
        href="https://github.com/emdzej/inpax"
        target="_blank"
        rel="noopener noreferrer"
        class="text-faint transition hover:text-foreground"
        title="inpax on GitHub"
        aria-label="inpax on GitHub"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          width="16"
          height="16"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"
          />
        </svg>
      </a>

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

      <ThemeToggle />

      <button
        type="button"
        class="rounded border border-rule px-3 py-1 text-xs text-muted hover:border-faint hover:text-foreground"
        onclick={() => (app.showSettings = true)}
      >
        Settings
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
