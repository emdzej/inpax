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

  type Tab = "comm" | "data" | "developer";
  let activeTab = $state<Tab>("comm");

  let savedAt = $state<number | null>(null);

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
    // Drop the persisted install handle and reset selection state so
    // the welcome screen comes back clean. The Settings panel itself
    // closes so the user lands on the picker.
    await clearInstallHandle();
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
          <div class="flex flex-col gap-4">
            <fieldset class="flex flex-col gap-2 rounded border border-divider bg-elevated/60 p-3">
              <legend class="px-1 text-xs font-bold uppercase tracking-wider text-faint">
                INPA install
              </legend>
              <p class="text-sm text-foreground">
                {app.install?.root.name || "(no folder selected)"}
              </p>
              {#if app.install}
                <ul class="text-xs text-faint">
                  <li>SGDAT: {app.install.sgdat ? "✓" : "✗"}</li>
                  <li>CFGDAT: {app.install.cfgdat ? "✓" : "✗"}</li>
                  <li>EDIABAS/Ecu: {app.install.ecu ? "✓" : "✗"}</li>
                </ul>
              {/if}
              <div class="pt-2">
                <button
                  type="button"
                  class="rounded border border-rule px-3 py-1 text-xs text-muted hover:border-rule hover:text-foreground"
                  onclick={() => void changeFolder()}
                >
                  Change folder…
                </button>
                <p class="mt-2 text-xs text-faint">
                  Drops the cached handle and returns to the welcome
                  picker. INPA scripts, SGBDs and your pinned startup
                  IPO are all re-read from the new install.
                </p>
              </div>
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
