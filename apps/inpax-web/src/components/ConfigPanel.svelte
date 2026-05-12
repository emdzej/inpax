<script lang="ts">
  /**
   * Connection configuration panel — modal overlay opened from the
   * header gear icon. Binds directly to `app.config.*` (Svelte 5
   * proxy state); a single `$effect` mirrors the writes to
   * localStorage so settings persist across reloads.
   *
   * Layout / option set mirrors ediabasx-web's Wizard.svelte so users
   * who've used both apps see the same surface.
   */

  import { app } from "../lib/state.svelte";
  import { resetConfig, saveConfig, isWebSerialSupported, type InterfaceType } from "../lib/config";
  import { connection, connect, disconnect } from "../lib/connection.svelte";
  import { settings, setTheme, type ThemeChoice } from "../lib/settings.svelte";

  const themeOptions: Array<{ value: ThemeChoice; label: string; help: string }> = [
    { value: "system", label: "System", help: "Follows your OS theme — live-updates when you toggle dark mode at the OS level." },
    { value: "light", label: "Light", help: "Force the light palette." },
    { value: "dark", label: "Dark", help: "Force the dark palette (the original inpax look)." },
  ];

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
    // In-place mutate so the reactive proxy keeps its identity.
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

  const savedLabel = $derived.by(() => {
    if (!savedAt) return null;
    const d = new Date(savedAt);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `Saved · ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  });
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
          <h2 class="text-sm font-bold uppercase tracking-wider text-muted">Connection Settings</h2>
          <p class="mt-1 text-xs text-faint">
            Persists in <code class="text-muted">localStorage</code>. Applied next time you Connect.
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

      <div class="flex-1 overflow-auto p-4">
        <div class="flex flex-col gap-6">
          <fieldset class="flex flex-col gap-2">
            <legend class="text-xs font-bold uppercase tracking-wider text-faint">
              Theme
            </legend>
            <div class="flex flex-col gap-2">
              {#each themeOptions as option (option.value)}
                <label
                  class="flex cursor-pointer items-start gap-3 rounded border bg-surface p-3 hover:border-rule"
                  class:border-accent={settings.theme === option.value}
                  class:border-divider={settings.theme !== option.value}
                >
                  <input
                    type="radio"
                    name="theme"
                    value={option.value}
                    checked={settings.theme === option.value}
                    onchange={() => setTheme(option.value)}
                    class="mt-1 accent-accent"
                  />
                  <div class="flex-1">
                    <div class="text-sm font-medium text-foreground">{option.label}</div>
                    <div class="mt-0.5 text-xs text-faint">{option.help}</div>
                  </div>
                </label>
              {/each}
            </div>
          </fieldset>

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
              <div class="rounded border border-amber-700 bg-amber-950 p-3 text-xs text-amber-200">
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
                class:bg-green-900={connection.phase === "connected"}
                class:text-green-200={connection.phase === "connected"}
                class:bg-amber-900={connection.phase === "connecting"}
                class:text-amber-200={connection.phase === "connecting"}
                class:bg-red-900={connection.phase === "error"}
                class:text-red-200={connection.phase === "error"}
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
              <p class="rounded border border-red-700 bg-red-950/40 p-2 text-xs text-red-300">
                {connection.errorMessage}
              </p>
            {/if}
          </fieldset>
        </div>
      </div>

      <footer class="flex items-center justify-between border-t border-divider bg-elevated/50 px-4 py-2">
        <button
          type="button"
          class="rounded border border-rule px-3 py-1 text-xs text-muted hover:border-rule"
          onclick={reset}
        >
          Reset to defaults
        </button>
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
