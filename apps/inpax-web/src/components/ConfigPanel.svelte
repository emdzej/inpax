<script lang="ts">
  /**
   * Settings modal — tabbed pane opened from the header gear icon.
   *
   *   • Communication — interface choice + serial / ENET config +
   *     live connection state.
   *   • Data — INPA install info + "change folder" entry point.
   *   • Developer — debug mode toggle + scheduler tick override.
   *
   * Theme switching lives in the top-bar `ThemeToggle` component, not
   * here — it's a one-click cycle, doesn't need a whole settings
   * row.
   *
   * Connection-config field bindings hit `app.config.*` (Svelte 5
   * proxy state); the `$effect` below mirrors writes to localStorage
   * via `saveConfig`. Workspace settings live in `settings.svelte.ts`
   * (a separate bucket) and their setters auto-persist.
   */

  import { app } from "../lib/state.svelte";
  import { resetConfig, saveConfig, isWebSerialSupported, type InterfaceType } from "../lib/config";
  import { connection, connect, disconnect } from "../lib/connection.svelte";
  import {
    settings,
    setDebugMode,
    setTickMs,
    buildSettingsExport,
    applySettingsImport,
  } from "../lib/settings.svelte";
  import { clearInstallHandle } from "../lib/install-storage";
  import {
    getInstallSource,
    getBundledStats,
    evictBundledInstall,
    importZipToOpfs,
    isOpfsSupported,
    clearInstallSource,
    type BundledStats,
    type ImportProgressEvent,
  } from "../lib/bundled-install";

  const opfsSupported = isOpfsSupported();

  type Tab = "comm" | "data" | "developer";
  let activeTab = $state<Tab>("comm");

  let savedAt = $state<number | null>(null);

  // Bundled-install management state. Refreshed whenever the Data
  // tab is opened so the "Last imported" / "OPFS usage" lines are
  // current — `navigator.storage.estimate()` is async.
  let bundledStats = $state<BundledStats | null>(null);
  let bundledStatsLoading = $state(false);

  async function refreshBundledStats(): Promise<void> {
    bundledStatsLoading = true;
    try {
      bundledStats = await getBundledStats();
    } finally {
      bundledStatsLoading = false;
    }
  }

  $effect(() => {
    if (activeTab === "data") {
      void refreshBundledStats();
    }
  });

  function formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
    return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  // Bundle import in settings — mirrors the InstallPicker flow but
  // happens against an already-active install. On success we close
  // the modal and bounce through `view = "welcome"` so InstallPicker
  // remounts, sees the new bundled marker, and loads OPFS root.
  // Simpler than duplicating the full openInstall pipeline here.
  let bundleZipInput = $state<HTMLInputElement | null>(null);
  let bundleImporting = $state(false);
  let bundleImportProgress = $state<{
    fileCount: number;
    bytesWritten: number;
    currentFile: string;
  } | null>(null);
  let bundleImportError = $state<string | null>(null);

  function chooseBundleZip(): void {
    bundleImportError = null;
    bundleZipInput?.click();
  }

  async function onBundleZipSelected(event: Event): Promise<void> {
    const target = event.currentTarget as HTMLInputElement;
    const file = target.files?.[0];
    target.value = "";
    if (!file) return;
    if (!opfsSupported) {
      bundleImportError = "OPFS not supported in this browser";
      return;
    }
    bundleImporting = true;
    bundleImportProgress = {
      fileCount: 0,
      bytesWritten: 0,
      currentFile: file.name,
    };
    try {
      await importZipToOpfs(file, (ev: ImportProgressEvent) => {
        if (ev.kind === "file") {
          bundleImportProgress = {
            fileCount: ev.fileIndex + 1,
            bytesWritten: ev.bytesWritten,
            currentFile: ev.path,
          };
        }
      });
      // Drop any saved fs-access handle so InstallPicker doesn't
      // race when it re-mounts.
      await clearInstallHandle();
      // Reset to welcome — InstallPicker sees the bundled marker
      // and loads OPFS automatically. The runtime + selection are
      // reset so the new install takes hold cleanly.
      app.view = "welcome";
      app.install = null;
      app.ipoFiles = [];
      app.selectedIpo = null;
      app.showSettings = false;
    } catch (err) {
      bundleImportError = err instanceof Error ? err.message : String(err);
    } finally {
      bundleImporting = false;
      bundleImportProgress = null;
    }
  }

  async function evictBundle(): Promise<void> {
    if (!confirm(
      "Evict the bundled install? You'll need to re-import a zip " +
        "(or pick a folder) before the app can read scripts again."
    )) {
      return;
    }
    await evictBundledInstall();
    app.view = "welcome";
    app.install = null;
    app.ipoFiles = [];
    app.selectedIpo = null;
    app.showSettings = false;
  }

  $effect(() => {
    // Touch every field we want to persist so Svelte tracks them.
    void app.config.interface;
    void app.config.serial?.baudRate;
    void app.config.serial?.dataBits;
    void app.config.serial?.parity;
    void app.config.serial?.stopBits;
    void app.config.serial?.protocol;
    void app.config.serial?.initMode;
    void app.config.serial?.testerCanId;
    void app.config.serial?.ecuCanId;
    void app.config.serial?.timeoutMs;
    void app.config.enet?.host;
    void app.config.enet?.port;
    saveConfig(app.config);
    savedAt = Date.now();
  });

  const interfaceOptions: Array<{ value: InterfaceType; label: string; help: string }> = [
    {
      value: "webserial",
      label: "Web Serial (browser)",
      help: "K-line / K+DCAN over Chrome/Edge Web Serial API. Pick the cable when you click Connect.",
    },
    {
      value: "simulation",
      label: "Simulation",
      help: "Canned responses, no hardware. Most scripts will show blank data fields but render layout.",
    },
    {
      value: "enet",
      label: "ENET / DoIP",
      help: "Ethernet diagnostics for newer BMWs. Not yet implemented — placeholder.",
    },
  ];

  function reset(): void {
    const fresh = resetConfig();
    Object.assign(app.config, fresh);
    if (fresh.serial) {
      app.config.serial = { ...(app.config.serial ?? {}), ...fresh.serial };
    }
    if (fresh.enet) {
      app.config.enet = { ...(app.config.enet ?? {}), ...fresh.enet };
    }
  }

  function close(): void {
    app.showSettings = false;
  }

  // === Import / export of settings ===
  //
  // Export bundles the workspace settings + the connection config
  // into one JSON file the user can re-import to restore everything.
  // Useful for cross-device setup or as a quick rollback after
  // experimenting.
  let fileInput = $state<HTMLInputElement | null>(null);
  let importError = $state<string | null>(null);
  let importedAt = $state<number | null>(null);

  function exportSettings(): void {
    const payload = buildSettingsExport(app.config);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    // Filename includes date so multiple exports don't overwrite each other.
    const today = new Date().toISOString().slice(0, 10);
    a.download = `inpax-settings-${today}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function onImportFile(event: Event): Promise<void> {
    importError = null;
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const { config } = applySettingsImport(parsed);
      // Connection config travels in the same payload — fold it
      // into the live `app.config` proxy so the existing $effect
      // up top picks it up and writes it through saveConfig().
      if (config && typeof config === "object") {
        Object.assign(app.config, config);
        const c = config as { serial?: object; enet?: object };
        if (c.serial) app.config.serial = { ...(app.config.serial ?? {}), ...c.serial };
        if (c.enet) app.config.enet = { ...(app.config.enet ?? {}), ...c.enet };
      }
      importedAt = Date.now();
    } catch (err) {
      importError = err instanceof Error ? err.message : String(err);
    } finally {
      // Reset so the same file can be imported again later.
      target.value = "";
    }
  }

  async function changeFolder(): Promise<void> {
    // Drop the persisted install handle, clear the source marker
    // (otherwise a bundled-active user clicking "Switch to folder
    // pick" reloads straight back into the bundle), and reset
    // selection state so the welcome screen comes back clean. The
    // Settings panel itself closes so the user lands on the picker.
    await clearInstallHandle();
    clearInstallSource();
    app.view = "welcome";
    app.install = null;
    app.ipoFiles = [];
    app.selectedIpo = null;
    app.showSettings = false;
  }

  const savedLabel = $derived.by(() => {
    if (!savedAt) return null;
    const d = new Date(savedAt);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `Saved · ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  });

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "comm", label: "Communication" },
    { id: "data", label: "Data" },
    { id: "developer", label: "Developer" },
  ];
</script>

{#if app.showSettings}
  <div
    class="fixed inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm"
    role="dialog"
    aria-modal="true"
  >
    <div class="flex max-h-[90vh] w-full max-w-2xl flex-col rounded border border-rule bg-surface shadow-2xl">
      <header class="flex items-center justify-between border-b border-divider px-4 py-3">
        <div>
          <h2 class="text-sm font-bold uppercase tracking-wider text-muted">Settings</h2>
          <p class="mt-1 text-xs text-faint">
            Persists in <code class="text-muted">localStorage</code>.
          </p>
        </div>
        <div class="flex items-center gap-3">
          {#if savedLabel}
            <span class="text-xs text-accent">{savedLabel}</span>
          {/if}
          <button
            type="button"
            class="text-faint hover:text-foreground"
            onclick={close}
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>
      </header>

      <!-- Tab strip — flat row of buttons under the header. Active tab
           gets the accent underline so it reads as a tab rather than
           a button. -->
      <div class="flex gap-1 border-b border-divider px-2" role="tablist">
        {#each tabs as tab (tab.id)}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            class="border-b-2 px-3 py-2 text-xs font-medium uppercase tracking-wider transition"
            class:border-accent={activeTab === tab.id}
            class:text-accent={activeTab === tab.id}
            class:border-transparent={activeTab !== tab.id}
            class:text-muted={activeTab !== tab.id}
            class:hover:text-foreground={activeTab !== tab.id}
            onclick={() => (activeTab = tab.id)}
          >
            {tab.label}
          </button>
        {/each}
      </div>

      <div class="flex-1 overflow-auto p-4">
        {#if activeTab === "comm"}
          <div class="flex flex-col gap-6">
            <fieldset class="flex flex-col gap-2">
              <legend class="text-xs font-bold uppercase tracking-wider text-faint">
                Interface
              </legend>
              <div class="flex flex-col gap-2">
                {#each interfaceOptions as option (option.value)}
                  <label
                    class="flex cursor-pointer items-start gap-3 rounded border bg-surface p-3 hover:border-rule"
                    class:border-accent={app.config.interface === option.value}
                    class:border-divider={app.config.interface !== option.value}
                  >
                    <input
                      type="radio"
                      name="interface"
                      value={option.value}
                      bind:group={app.config.interface}
                      class="mt-1 accent-accent"
                    />
                    <div class="flex flex-col">
                      <span class="text-sm text-foreground">{option.label}</span>
                      <span class="text-xs text-faint">{option.help}</span>
                    </div>
                  </label>
                {/each}
              </div>
              {#if app.config.interface === "webserial" && !isWebSerialSupported()}
                <div class="rounded border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 p-3 text-xs text-amber-800 dark:text-amber-200">
                  Your browser doesn't expose <code>navigator.serial</code>. Chrome, Edge, or
                  Opera on a desktop OS is required.
                </div>
              {/if}
            </fieldset>

            {#if app.config.interface === "webserial"}
              <fieldset class="grid grid-cols-2 gap-3">
                <legend class="col-span-2 text-xs font-bold uppercase tracking-wider text-faint">
                  Serial / K-line
                </legend>
                <label class="flex flex-col gap-1 text-xs text-muted">
                  Baud rate
                  <input
                    type="number"
                    class="rounded border border-divider bg-base px-2 py-1 text-sm text-foreground focus:border-accent focus:outline-none"
                    bind:value={app.config.serial!.baudRate}
                  />
                </label>
                <label class="flex flex-col gap-1 text-xs text-muted">
                  Protocol
                  <select
                    class="rounded border border-divider bg-base px-2 py-1 text-sm text-foreground focus:border-accent focus:outline-none"
                    bind:value={app.config.serial!.protocol}
                  >
                    <option value="uart">UART (K+DCAN, raw passthrough)</option>
                    <option value="kwp">KWP2000 (K-line)</option>
                    <option value="isotp">ISO-TP (D-CAN)</option>
                    <option value="tp20">TP2.0 (VAG)</option>
                  </select>
                </label>
                <label class="flex flex-col gap-1 text-xs text-muted">
                  Data bits
                  <select
                    class="rounded border border-divider bg-base px-2 py-1 text-sm text-foreground focus:border-accent focus:outline-none"
                    bind:value={app.config.serial!.dataBits}
                  >
                    <option value={8}>8</option>
                    <option value={7}>7</option>
                  </select>
                </label>
                <label class="flex flex-col gap-1 text-xs text-muted">
                  Parity
                  <select
                    class="rounded border border-divider bg-base px-2 py-1 text-sm text-foreground focus:border-accent focus:outline-none"
                    bind:value={app.config.serial!.parity}
                  >
                    <option value="none">none</option>
                    <option value="even">even</option>
                    <option value="odd">odd</option>
                  </select>
                </label>
                <label class="flex flex-col gap-1 text-xs text-muted">
                  Stop bits
                  <select
                    class="rounded border border-divider bg-base px-2 py-1 text-sm text-foreground focus:border-accent focus:outline-none"
                    bind:value={app.config.serial!.stopBits}
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                  </select>
                </label>
                <label class="flex flex-col gap-1 text-xs text-muted">
                  Init mode
                  <select
                    class="rounded border border-divider bg-base px-2 py-1 text-sm text-foreground focus:border-accent focus:outline-none"
                    bind:value={app.config.serial!.initMode}
                  >
                    <option value="fast">fast</option>
                    <option value="five-baud">5-baud</option>
                  </select>
                </label>
                <label class="col-span-2 flex flex-col gap-1 text-xs text-muted">
                  Timeout (ms)
                  <input
                    type="number"
                    class="rounded border border-divider bg-base px-2 py-1 text-sm text-foreground focus:border-accent focus:outline-none"
                    bind:value={app.config.serial!.timeoutMs}
                  />
                </label>
              </fieldset>
            {/if}

            {#if app.config.interface === "enet"}
              <fieldset class="grid grid-cols-2 gap-3">
                <legend class="col-span-2 text-xs font-bold uppercase tracking-wider text-faint">
                  ENET / DoIP
                </legend>
                <label class="flex flex-col gap-1 text-xs text-muted">
                  Host
                  <input
                    type="text"
                    class="rounded border border-divider bg-base px-2 py-1 text-sm text-foreground focus:border-accent focus:outline-none"
                    bind:value={app.config.enet!.host}
                  />
                </label>
                <label class="flex flex-col gap-1 text-xs text-muted">
                  Port
                  <input
                    type="number"
                    class="rounded border border-divider bg-base px-2 py-1 text-sm text-foreground focus:border-accent focus:outline-none"
                    bind:value={app.config.enet!.port}
                  />
                </label>
              </fieldset>
            {/if}

            <fieldset class="flex flex-col gap-2 rounded border border-divider bg-elevated/60 p-3">
              <legend class="px-1 text-xs font-bold uppercase tracking-wider text-faint">
                Connection
              </legend>
              <div class="flex items-center gap-3">
                <span
                  class="rounded px-2 py-0.5 text-xs font-medium"
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
                {#if connection.phase === "connected"}
                  <button
                    type="button"
                    class="rounded border border-rule px-3 py-1 text-xs text-muted hover:border-rule hover:text-foreground"
                    onclick={() => void disconnect()}
                  >
                    Disconnect
                  </button>
                {:else}
                  <button
                    type="button"
                    class="rounded bg-accent px-3 py-1 text-xs font-medium text-zinc-950 hover:bg-accent-muted disabled:opacity-50"
                    disabled={connection.phase === "connecting"}
                    onclick={() => void connect()}
                  >
                    Connect
                  </button>
                {/if}
              </div>
              {#if connection.errorMessage}
                <p class="rounded border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/40 p-2 text-xs text-red-800 dark:text-red-300">
                  {connection.errorMessage}
                </p>
              {/if}
            </fieldset>
          </div>
        {:else if activeTab === "data"}
          {@const installSource = getInstallSource()}
          {@const isBundled = installSource?.source === "bundled"}
          <div class="flex flex-col gap-4">
            <!-- Fieldset 1: Active install — shows what's currently
                 mounted regardless of source. Bundled source shows
                 stats inline since they're directly relevant; the
                 evict / switch actions live in the dedicated
                 bundled fieldset below. -->
            <fieldset class="flex flex-col gap-2 rounded border border-divider bg-elevated/60 p-3">
              <legend class="px-1 text-xs font-bold uppercase tracking-wider text-faint">
                Active install · {isBundled ? "bundled (OPFS)" : "folder pick"}
              </legend>
              <p class="text-sm text-foreground">
                {app.install?.root.name || "(none active)"}
              </p>
              {#if app.install}
                <ul class="text-xs text-faint">
                  <li>SGDAT: {app.install.sgdat ? "✓" : "✗"}</li>
                  <li>CFGDAT: {app.install.cfgdat ? "✓" : "✗"}</li>
                  <li>EDIABAS/Ecu: {app.install.ecu ? "✓" : "✗"}</li>
                </ul>
              {/if}

              <div class="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  class="rounded border border-rule px-3 py-1 text-xs text-muted hover:border-rule hover:text-foreground"
                  onclick={() => void changeFolder()}
                >
                  {isBundled ? "Switch to folder pick…" : "Change folder…"}
                </button>
                {#if !isBundled && app.install}
                  <!-- "Forget" = the same drop-and-return-to-welcome
                       action, but labeled for the user who doesn't
                       want to pick another folder right away. Useful
                       when wiping the saved handle before, say,
                       importing a bundle from the welcome screen. -->
                  <button
                    type="button"
                    class="rounded px-3 py-1 text-xs text-faint hover:text-foreground hover:underline underline-offset-2"
                    onclick={() => void changeFolder()}
                    title="Drops the saved folder handle and returns to the welcome picker without auto-restoring next session."
                  >
                    Forget folder
                  </button>
                {/if}
              </div>
              <p class="mt-2 text-xs text-faint">
                {isBundled
                  ? "Drops the bundled handle for this session and returns to the welcome picker. The OPFS copy stays in place — see below to fully evict it."
                  : "“Change folder…” takes you back to the welcome picker so you can choose a different folder or import a bundle. “Forget folder” does the same drop but signals you don't intend to re-pick — close the tab or stay on welcome."}
              </p>
            </fieldset>

            <!-- Fieldset 2: Bundled install (OPFS). Always visible
                 when OPFS is supported, regardless of currently-
                 active source. Two states:
                   - bundled active → stats + Evict button.
                   - not active     → "Import a bundle zip" entry
                                      point so the user can switch
                                      from fs-access without going
                                      back through the welcome
                                      screen.
                 See docs/proposals/bundled-install.md. -->
            {#if opfsSupported}
              <fieldset class="flex flex-col gap-2 rounded border border-divider bg-elevated/60 p-3">
                <legend class="px-1 text-xs font-bold uppercase tracking-wider text-faint">
                  Bundled install (OPFS)
                </legend>

                {#if isBundled}
                  <p class="text-sm text-foreground">Active.</p>
                  {#if bundledStats}
                    <ul class="text-xs text-faint pt-1 space-y-0.5">
                      <li>
                        Imported: <span class="text-muted">{new Date(bundledStats.importedAt).toLocaleString()}</span>
                      </li>
                      <li>
                        Files: <span class="text-muted">{bundledStats.fileCount}</span>
                        ·
                        Declared size: <span class="text-muted">{formatBytes(bundledStats.declaredBytes)}</span>
                      </li>
                      {#if bundledStats.storageUsage !== null}
                        <li>
                          OPFS usage: <span class="text-muted">{formatBytes(bundledStats.storageUsage)}</span>
                          {#if bundledStats.storageQuota !== null}
                            / <span class="text-muted">{formatBytes(bundledStats.storageQuota)}</span>
                          {/if}
                        </li>
                      {/if}
                      {#if bundledStats.persisted !== null}
                        <li>
                          Persistent: <span class="text-muted">{bundledStats.persisted ? "yes (won't evict)" : "no (may evict under disk pressure)"}</span>
                        </li>
                      {/if}
                    </ul>
                  {:else if bundledStatsLoading}
                    <p class="text-xs text-faint">Loading stats…</p>
                  {/if}
                  <div class="flex flex-wrap gap-2 pt-2">
                    <button
                      type="button"
                      class="rounded border border-rule px-3 py-1 text-xs text-muted hover:border-rule hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                      onclick={chooseBundleZip}
                      disabled={bundleImporting}
                    >
                      {bundleImporting ? "Re-importing…" : "Re-import bundle…"}
                    </button>
                    <button
                      type="button"
                      class="rounded border border-red-300 dark:border-red-600/50 px-3 py-1 text-xs text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50 disabled:cursor-not-allowed"
                      onclick={() => void evictBundle()}
                      disabled={bundleImporting}
                    >
                      Evict bundle…
                    </button>
                  </div>
                  <p class="text-xs text-faint">
                    Re-import replaces the OPFS contents wholesale (no
                    merge). Evict wipes the OPFS copy and returns to
                    the welcome picker.
                  </p>
                {:else}
                  <p class="text-sm text-foreground">Not active.</p>
                  <p class="text-xs text-faint">
                    Import a <code>bimmerz-bundle</code>-produced zip
                    to switch this session to OPFS-backed storage.
                    Faster startup (no permission re-grant per
                    session), and sidesteps Chrome's
                    <code>.ini</code> blocklist on Windows entirely.
                    <a
                      href="https://github.com/emdzej/inpax/tree/main/apps/bimmerz-bundler"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-accent underline-offset-2 hover:underline"
                    >Make a bundle with bimmerz-bundle.</a>
                  </p>
                  <div class="pt-1">
                    <button
                      type="button"
                      class="rounded border border-rule px-3 py-1 text-xs text-muted hover:border-rule hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                      onclick={chooseBundleZip}
                      disabled={bundleImporting}
                    >
                      {bundleImporting ? "Importing…" : "Import bundle zip…"}
                    </button>
                  </div>
                {/if}

                {#if bundleImporting && bundleImportProgress}
                  <p class="mt-1 text-xs text-faint">
                    {bundleImportProgress.fileCount} files ·
                    {formatBytes(bundleImportProgress.bytesWritten)} ·
                    <span class="truncate inline-block max-w-xs align-bottom">{bundleImportProgress.currentFile}</span>
                  </p>
                {/if}

                {#if bundleImportError}
                  <p class="mt-1 text-xs text-red-700 dark:text-red-300">
                    Import failed: {bundleImportError}
                  </p>
                {/if}

                <input
                  bind:this={bundleZipInput}
                  type="file"
                  accept=".zip,application/zip"
                  class="hidden"
                  onchange={onBundleZipSelected}
                />
              </fieldset>
            {/if}

            <!-- Chrome on Windows hides `.ini` files from the File
                 System Access API, so INPAX can't read INPA.INI /
                 EDIABAS.INI directly. The runtime falls back to
                 `.INIX` copies; this section explains the one-time
                 rename and offers bulk one-liners for PowerShell /
                 cmd. See docs/research/chrome-ini-blocklist.md. -->
            <fieldset class="flex flex-col gap-3 rounded border border-blue-300 dark:border-blue-600/40 bg-blue-50 dark:bg-blue-950/40 p-3">
              <legend class="px-1 text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                Windows: rename .INI → .INIX
              </legend>
              <p class="text-sm text-blue-900 dark:text-blue-200">
                Chrome on Windows silently hides <code>.ini</code>
                files from web pages, so INPAX can't read
                <code>INPA.INI</code> / <code>EDIABAS.INI</code>.
                INPAX falls back to <code>.INIX</code> copies — make
                them once and you're set. macOS / Linux users can
                ignore this.
              </p>

              <details class="rounded border border-blue-300/60 dark:border-blue-600/30 bg-blue-100/60 dark:bg-blue-950/60 p-2">
                <summary class="cursor-pointer text-xs font-semibold text-blue-900 dark:text-blue-200">
                  Just the two files
                </summary>
                <pre class="mt-2 overflow-x-auto rounded bg-white/70 dark:bg-blue-950/80 p-2 text-xs leading-relaxed text-blue-900 dark:text-blue-100"><code>copy C:\EDIABAS\Bin\EDIABAS.INI       C:\EDIABAS\Bin\EDIABAS.INIX
copy C:\EC-APPS\INPA\CFGDAT\INPA.INI  C:\EC-APPS\INPA\CFGDAT\INPA.INIX</code></pre>
                <p class="mt-2 text-xs text-blue-700 dark:text-blue-300">
                  Run in <code>cmd.exe</code>. Copy keeps the
                  originals so your native INPA / Tool32 still work.
                </p>
              </details>

              <details class="rounded border border-blue-300/60 dark:border-blue-600/30 bg-blue-100/60 dark:bg-blue-950/60 p-2">
                <summary class="cursor-pointer text-xs font-semibold text-blue-900 dark:text-blue-200">
                  Bulk: copy every .ini → .INIX under EDIABAS / EC-APPS
                </summary>
                <p class="mt-2 text-xs text-blue-900 dark:text-blue-200">
                  Future-proofs scripts that read other INIs
                  (<code>FUNK.INI</code>, <code>obd.ini</code>, etc.).
                  Pick one shell.
                </p>

                <p class="mt-2 text-xs font-semibold text-blue-900 dark:text-blue-200">PowerShell</p>
                <pre class="mt-1 overflow-x-auto rounded bg-white/70 dark:bg-blue-950/80 p-2 text-xs leading-relaxed text-blue-900 dark:text-blue-100"><code>Get-ChildItem -Path C:\EDIABAS,C:\EC-APPS -Recurse -Filter *.ini |
  ForEach-Object &#123; Copy-Item $_.FullName ($_.FullName -replace '\.ini$','.INIX') -Force &#125;</code></pre>

                <p class="mt-2 text-xs font-semibold text-blue-900 dark:text-blue-200">cmd.exe</p>
                <pre class="mt-1 overflow-x-auto rounded bg-white/70 dark:bg-blue-950/80 p-2 text-xs leading-relaxed text-blue-900 dark:text-blue-100"><code>for /R "C:\EDIABAS" %f in (*.ini) do copy "%f" "%~dpnf.INIX"
for /R "C:\EC-APPS" %f in (*.ini) do copy "%f" "%~dpnf.INIX"</code></pre>

                <p class="mt-2 text-xs text-blue-700 dark:text-blue-300">
                  Each <code>copy</code> prints the source path +
                  "1 file(s) copied." so you can see exactly what's
                  happening. Wrap each <code>%f</code> as
                  <code>%%f</code> if you save these into a
                  <code>.bat</code> file instead of pasting
                  interactively.
                </p>
              </details>

              <p class="text-xs text-blue-700 dark:text-blue-300">
                After running either, click <strong>Change folder…</strong>
                above (or reload the page) to re-read the install
                with the <code>.INIX</code> files now visible.
              </p>
            </fieldset>
          </div>
        {:else}
          <!-- Developer -->
          <div class="flex flex-col gap-4">
            <fieldset class="flex flex-col gap-3 rounded border border-divider bg-elevated/60 p-3">
              <legend class="px-1 text-xs font-bold uppercase tracking-wider text-faint">
                Debug mode
              </legend>
              <label class="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  class="mt-1 accent-accent"
                  checked={settings.debugMode}
                  onchange={(e) => setDebugMode((e.currentTarget as HTMLInputElement).checked)}
                />
                <div class="flex flex-col">
                  <span class="text-sm text-foreground">Enable debug mode</span>
                  <span class="text-xs text-faint">
                    Throttles the VM scheduler so the log stream stays
                    legible while diagnosing. Disable for normal use —
                    the runtime then ticks as fast as the event loop
                    allows (~50 ms), matching real INPA's "no fixed
                    refresh rate, yield-on-idle" behaviour.
                  </span>
                </div>
              </label>

              {#if settings.debugMode}
                <label class="flex flex-col gap-1 text-xs text-muted">
                  Tick interval (ms)
                  <input
                    type="number"
                    min="50"
                    max="60000"
                    step="50"
                    class="rounded border border-divider bg-base px-2 py-1 text-sm text-foreground focus:border-accent focus:outline-none"
                    value={settings.tickMs}
                    onchange={(e) => setTickMs(Number((e.currentTarget as HTMLInputElement).value))}
                  />
                  <span class="text-faint">
                    One scheduler tick = one LINE block. Changes take
                    effect on the next script mount.
                  </span>
                </label>
              {/if}
            </fieldset>
          </div>
        {/if}
      </div>

      <footer class="flex items-center justify-between gap-2 border-t border-divider bg-elevated/50 px-4 py-2">
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="rounded border border-rule px-3 py-1 text-xs text-muted hover:border-rule"
            onclick={reset}
          >
            Reset connection
          </button>
          <!-- Bundled import/export — workspace settings + the
               connection config in one JSON file. The `<input>` is
               hidden; the visible button triggers it via the bound
               ref. -->
          <button
            type="button"
            class="rounded border border-rule px-3 py-1 text-xs text-muted hover:border-rule"
            onclick={() => fileInput?.click()}
            title="Import settings + connection config from a JSON file"
          >
            Import…
          </button>
          <button
            type="button"
            class="rounded border border-rule px-3 py-1 text-xs text-muted hover:border-rule"
            onclick={exportSettings}
            title="Export settings + connection config as a JSON file"
          >
            Export
          </button>
          <input
            bind:this={fileInput}
            type="file"
            accept="application/json,.json"
            class="hidden"
            onchange={onImportFile}
          />
          {#if importError}
            <span class="text-xs text-red-700 dark:text-red-300" title={importError}>
              import failed
            </span>
          {:else if importedAt}
            <span class="text-xs text-accent">imported ✓</span>
          {/if}
        </div>
        <button
          type="button"
          class="rounded bg-accent px-4 py-1 text-sm font-medium text-zinc-950 hover:bg-accent-muted"
          onclick={close}
        >
          Done
        </button>
      </footer>
    </div>
  </div>
{/if}
