<script lang="ts">
  /**
   * Modal for the script-driven connect flow.
   *
   * Watches the TuiProvider's `inputDialog` for a `type === 'connect'`
   * payload — set by `TuiProvider.ensureConnected()`, which the
   * dispatcher's `INPAapiInit` awaits. When the dialog appears:
   *
   *   1. We render a modal explaining what's happening — current
   *      interface, current connection state — with a Connect
   *      button (the user gesture Web Serial requires for
   *      `requestPort()` lives here) and a Skip button.
   *   2. Watching `connection.phase`: as soon as it becomes
   *      "connected", auto-resolve via `ui.submitInput(undefined)` —
   *      the dispatcher continues to `provider.init()` which will
   *      pull the freshly-built transport from `getActiveTransport`
   *      and open the cable.
   *   3. Skip resolves via `ui.cancelInput()`; the dispatcher's
   *      `provider.init()` then fails the connect step naturally
   *      (transport callback returns null), the script continues,
   *      and subsequent jobs will emit `job:error` until the user
   *      reconnects manually from Settings.
   */

  import type { TuiProvider, InputDialog } from "@emdzej/inpax-tui-provider";
  import { app } from "../lib/state.svelte";
  import { connection, connect } from "../lib/connection.svelte";

  type Props = { ui: TuiProvider };
  const { ui }: Props = $props();

  let dialog = $state<InputDialog | null>(null);
  // Two modes: 'connect' (initial; show settings) and 'connect-error'
  // (post-failure; show retry/continue/stop). Mode is derived from
  // the dialog type so the same modal handles both.
  const isErrorDialog = $derived(dialog?.type === "connect-error");

  $effect(() => {
    const refresh = () => {
      const next = ui.getInputDialog();
      dialog =
        next && (next.type === "connect" || next.type === "connect-error")
          ? { ...next }
          : null;
    };
    refresh();
    return ui.onStateChange(refresh);
  });

  // Once the connection flips to `connected` while the *connect*
  // modal is open, auto-resolve so the dispatcher can finish
  // `INPAapiInit`. Skipped for the error variant — the user has to
  // pick retry/continue/stop explicitly there.
  $effect(() => {
    if (dialog?.type === "connect" && connection.phase === "connected") {
      ui.submitInput(undefined);
    }
  });

  function doConnect(): void {
    // `connect()` from connection.svelte runs the Web Serial port
    // picker inside this click's user-gesture chain. The phase
    // watcher above auto-closes the modal once it succeeds.
    void connect();
  }

  function skip(): void {
    ui.cancelInput();
  }

  function openSettings(): void {
    app.showSettings = true;
  }

  // Error-mode actions. Each resolves the dialog with the matching
  // string; the dispatcher's INPAapiInit loop reads it and decides
  // whether to retry the init, continue with a broken connection,
  // or throw to halt the script.
  function retry(): void {
    ui.submitInput("retry");
  }
  function continueAnyway(): void {
    ui.submitInput("continue");
  }
  function stopScript(): void {
    ui.submitInput("stop");
  }
</script>

{#if dialog}
  <div
    class="fixed inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm"
    role="dialog"
    aria-modal="true"
  >
    <div class="w-full max-w-md rounded border border-zinc-700 bg-zinc-900 shadow-2xl">
      <header class="border-b border-zinc-800 px-4 py-3">
        <h2 class="text-sm font-bold uppercase tracking-wider text-zinc-300">
          {isErrorDialog ? "EDIABAS connection failed" : "EDIABAS connection"}
        </h2>
        <p class="mt-1 text-xs text-zinc-500">
          {isErrorDialog
            ? "The script's INPAapiInit couldn't open the link."
            : "The script is initialising the diagnostic link."}
        </p>
      </header>

      {#if isErrorDialog}
        <section class="space-y-3 px-4 py-4 text-sm text-zinc-300">
          <p class="rounded border border-red-700 bg-red-950/40 p-3 text-xs text-red-300">
            {dialog.text}
          </p>
          <p class="text-xs text-zinc-500">
            <span class="text-zinc-300">Retry</span> reopens the connect dialog so you can change
            settings and try again.
            <span class="text-zinc-300">Continue</span> lets the script proceed —
            later <code>INPAapiJob</code> calls will fail until you reconnect from Settings.
            <span class="text-zinc-300">Stop</span> aborts the script.
          </p>
        </section>

        <footer class="flex items-center justify-end gap-2 border-t border-zinc-800 bg-zinc-950/50 px-4 py-2">
          <button
            type="button"
            class="rounded px-3 py-1 text-sm text-red-400 hover:bg-red-900/40 hover:text-red-300"
            onclick={stopScript}
          >
            Stop script
          </button>
          <button
            type="button"
            class="rounded px-3 py-1 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            onclick={continueAnyway}
          >
            Continue
          </button>
          <button
            type="button"
            class="rounded bg-accent px-4 py-1 text-sm font-medium text-zinc-950 hover:bg-accent-muted"
            onclick={retry}
          >
            Retry
          </button>
        </footer>
      {:else}
        <section class="space-y-3 px-4 py-4 text-sm text-zinc-300">
          <div class="flex items-center justify-between">
            <span class="text-zinc-400">Interface</span>
            <span class="font-mono text-zinc-200">{app.config.interface}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-zinc-400">Status</span>
            <span
              class="rounded px-2 py-0.5 text-xs"
              class:bg-green-900={connection.phase === "connected"}
              class:text-green-200={connection.phase === "connected"}
              class:bg-amber-900={connection.phase === "connecting"}
              class:text-amber-200={connection.phase === "connecting"}
              class:bg-red-900={connection.phase === "error"}
              class:text-red-200={connection.phase === "error"}
              class:bg-zinc-800={connection.phase === "idle" || connection.phase === "disconnected"}
              class:text-zinc-300={connection.phase === "idle" || connection.phase === "disconnected"}
            >
              {connection.message}
            </span>
          </div>
          {#if connection.errorMessage}
            <p class="rounded border border-red-700 bg-red-950/40 p-2 text-xs text-red-300">
              {connection.errorMessage}
            </p>
          {/if}
          {#if app.config.interface === "webserial"}
            <p class="text-xs text-zinc-500">
              Clicking <span class="text-zinc-300">Connect</span> opens the browser's port
              picker — this counts as the user gesture Web Serial needs.
            </p>
          {/if}
        </section>

        <footer class="flex items-center justify-between gap-2 border-t border-zinc-800 bg-zinc-950/50 px-4 py-2">
          <button
            type="button"
            class="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-400 hover:border-zinc-500"
            onclick={openSettings}
          >
            Settings…
          </button>
          <div class="flex gap-2">
            <button
              type="button"
              class="rounded px-3 py-1 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              onclick={skip}
            >
              Skip
            </button>
            <button
              type="button"
              class="rounded bg-accent px-4 py-1 text-sm font-medium text-zinc-950 hover:bg-accent-muted disabled:opacity-50"
              disabled={connection.phase === "connecting" || connection.phase === "connected"}
              onclick={doConnect}
            >
              {connection.phase === "connecting" ? "Connecting…" : "Connect"}
            </button>
          </div>
        </footer>
      {/if}
    </div>
  </div>
{/if}
