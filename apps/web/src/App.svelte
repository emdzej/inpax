<script lang="ts">
  import { app } from "./lib/state.svelte";
  import { connection, connect, disconnect } from "./lib/connection.svelte";
  import { settings, isDarkTheme } from "./lib/settings.svelte";
  import { loadRemoteInstallUrl } from "./lib/install-storage";
  import {
    setLibTheme,
    classicInpaTheme,
    darkInpaTheme,
  } from "@emdzej/inpax-web-provider";
  import { ConnectButton } from "@emdzej/ediabasx-web-ui";
  import InstallPicker from "./components/InstallPicker.svelte";
  import IpoSidebar from "./components/IpoSidebar.svelte";
  import IpoRunner from "./components/IpoRunner.svelte";
  import ConfigPanel from "./components/ConfigPanel.svelte";
  import ConnectSessionDialog from "./components/ConnectSessionDialog.svelte";
  import ThemeToggle from "./components/ThemeToggle.svelte";

  /**
   * Top-bar install-source pill — label + tooltip describing where
   * the active install's bytes are coming from. The label stays
   * short (one or two words); the tooltip has the path / URL /
   * marker so the user can confirm at a hover.
   */
  const installPill = $derived.by((): { label: string; tooltip: string } => {
    if (!app.install) {
      return { label: "no install", tooltip: "No install loaded" };
    }
    /* Read from reactive `app.installSource` — getInstallSource()
       was localStorage-direct and didn't re-run this $derived when
       the marker changed mid-session. */
    const source = app.installSource;
    const rootName = app.install.root.name || "(unnamed root)";
    if (source?.source === "remote") {
      const url = loadRemoteInstallUrl();
      return {
        label: "remote",
        tooltip: `Remote VFS · ${url ?? rootName}`,
      };
    }
    if (source?.source === "bundled") {
      return {
        label: "bundled",
        tooltip: `OPFS bundle · ${rootName} · ${source.fileCount} files · imported ${source.importedAt}`,
      };
    }
    if (source?.source === "fs-access") {
      return {
        label: "local",
        tooltip: `Local folder · ${rootName}`,
      };
    }
    return { label: "?", tooltip: `Unknown install source · ${rootName}` };
  });

  /**
   * Connection-mode pill — short label for the active path between
   * inpax and the cable, tooltip carrying the concrete endpoint /
   * baud / URL. Sits next to the Connect button so the user sees at
   * a glance whether they're driving a local Web Serial cable, a
   * J2534 OpenPort, a remote ediabasx-server, or a Bimmerz Connect
   * session — useful disambiguator when state is "Connecting…" or
   * "Connection error".
   */
  const modePill = $derived.by((): { label: string; tooltip: string } => {
    const cfg = app.config;
    if (cfg.mode === "client") {
      if (cfg.connectionMethod === "connect") {
        return {
          label: "bimmerz connect",
          tooltip: `Client · Bimmerz Connect relay · ${cfg.connectRelayUrl ?? "wss://connect.bimmerz.app"}`,
        };
      }
      return {
        label: "ws server",
        tooltip: `Client · direct WebSocket · ${cfg.serverUrl ?? "(URL not set)"}`,
      };
    }
    if (cfg.interface === "webserial") {
      const baud = cfg.serial?.baudRate ?? 9600;
      return { label: "web serial", tooltip: `Embedded · Web Serial @ ${baud}` };
    }
    if (cfg.interface === "j2534") {
      return { label: "j2534", tooltip: "Embedded · J2534 (Tactrix OpenPort 2.0)" };
    }
    if (cfg.interface === "gateway") {
      return {
        label: "gateway",
        tooltip: `Embedded · Remote gateway · ${cfg.gateway?.url ?? "(URL not set)"}`,
      };
    }
    return { label: cfg.interface, tooltip: `Embedded · ${cfg.interface}` };
  });

  // Install the web-provider theme context at the root. Components
  // inside `@emdzej/inpax-web-provider` (ScreenCanvas, UserBoxOverlay,
  // …) call `getLibTheme()` reactively, so this `$effect` re-running
  // when the user toggles Light/Dark/System propagates immediately.
  $effect(() => {
    setLibTheme(isDarkTheme() ? darkInpaTheme : classicInpaTheme);
  });

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
  <!-- In client mode the server owns the SGBD catalogue; no local
       install needed. Skip the InstallPicker gate and go straight
       to the browse view. Embedded mode still requires an install
       (SGBDs are read from the user-picked directory). -->
  {#if app.view === "browse" && (app.install || app.config.mode === "client")}
    <header class="flex items-center gap-4 border-b border-divider bg-surface px-4 py-2 text-sm">
      <span class="font-semibold text-accent">INPAX</span>
      <!-- Build version surfaced from package.json via Vite `define`.
           Linked to the matching git tag so users can pop the changelog
           in one click. Faint styling keeps it as metadata, not chrome. -->
      <a
        href="https://github.com/emdzej/inpax/releases/tag/{__APP_VERSION__}"
        target="_blank"
        rel="noopener noreferrer"
        class="text-xs text-faint transition hover:text-foreground"
        title="View release notes on GitHub"
      >
        {__APP_VERSION__}
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

      <!-- Right cluster: data-location pill, mode pill, Connect
           button. The pills carry concrete details in their
           tooltips (folder name / URL / baud / etc.) so the user
           can confirm at a hover without opening Settings.
           Borderless + slightly faded — they're metadata, not
           chrome. Icons disambiguate at-a-glance: folder = data
           source, plug = comm link. -->
      <div class="ml-auto flex items-center gap-3">
        <span
          class="flex items-center gap-1.5 text-xs text-faint"
          title={installPill.tooltip}
        >
          <!-- Folder icon — represents the data source. -->
          <svg
            viewBox="0 0 16 16"
            width="13"
            height="13"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.4a1.5 1.5 0 0 1 1.06.44L8 4.5h4.5A1.5 1.5 0 0 1 14 6v6a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12V4.5z"/>
          </svg>
          {installPill.label}
        </span>
        <span
          class="flex items-center gap-1.5 text-xs text-faint"
          title={modePill.tooltip}
        >
          <!-- Plug icon — represents the comm connection. -->
          <svg
            viewBox="0 0 16 16"
            width="13"
            height="13"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M5 2v3.5M9 2v3.5M3.5 5.5h7v3a3.5 3.5 0 0 1-3.5 3.5h0a3.5 3.5 0 0 1-3.5-3.5v-3zM7 12v2"/>
          </svg>
          {modePill.label}
        </span>
        <ConnectButton
          phase={connection.phase}
          message={connection.message}
          errorMessage={connection.errorMessage ?? undefined}
          onconnect={connect}
          ondisconnect={disconnect}
        />
      </div>

      <ThemeToggle />

      <button
        type="button"
        class="rounded border border-rule px-3 py-1 text-xs text-muted hover:border-faint hover:text-foreground"
        onclick={() => (app.showSettings = true)}
      >
        Settings
      </button>
    </header>
    <!--
      Browse-view error banner. Surfaces job/runtime failures the
      providers raise via their `job:error` / `connect:error` events.
      Previously these only hit the console (or worse, the silent
      swallow path inside `EdiabasXProvider.job()`), so users saw
      symptoms like "userbox opens but never closes" with no
      explanation. The runtime wires `app.error` from those events
      in `runtime.svelte.ts`; the close button lets the user dismiss
      once they've read it.
    -->
    {#if app.error}
      <div
        role="alert"
        class="flex items-start gap-3 border-b border-rule bg-red-50 px-4 py-2 text-sm text-red-900 dark:bg-red-950/60 dark:text-red-100"
      >
        <span class="mt-0.5 flex-1 break-words">{app.error}</span>
        <button
          type="button"
          class="rounded px-2 py-0.5 text-xs text-red-900/70 hover:bg-red-100 hover:text-red-900 dark:text-red-100/70 dark:hover:bg-red-900/40 dark:hover:text-red-100"
          aria-label="Dismiss error"
          onclick={() => (app.error = null)}
        >
          ✕
        </button>
      </div>
    {/if}
    <div class="flex flex-1 overflow-hidden">
      <IpoSidebar />
      <IpoRunner />
    </div>
  {:else}
    <InstallPicker />
  {/if}

  <ConfigPanel />
  <ConnectSessionDialog />
</div>
