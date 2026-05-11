<script lang="ts">
  /**
   * Mounts the runtime for the currently selected IPO, hosts the
   * canvas + F-key bar, and tears the runtime down on unmount / when
   * the selection or connection changes.
   *
   * Connection model: the cable transport is owned by `connection.svelte`
   * (one cable per session, shared across script switches). This
   * component just reads the active transport snapshot — if it's null,
   * we prompt the user to Connect first. Once connected, switching
   * scripts disposes the old runtime and rebuilds against the same
   * transport, so the cable stays open.
   */

  import { app } from "../lib/state.svelte";
  import { connection, getActiveTransport, connect } from "../lib/connection.svelte";
  import { startInpaRuntime, type RuntimeHandle } from "../lib/runtime.svelte";
  import { classicInpaTheme } from "../lib/theme";
  import ScreenCanvas from "./ScreenCanvas.svelte";
  import FKeyBar from "./FKeyBar.svelte";
  import DialogOverlay from "./DialogOverlay.svelte";

  let runtime = $state<RuntimeHandle | null>(null);
  let title = $state("");
  let error = $state<string | null>(null);
  let loading = $state(false);

  // Re-snapshot the title on every TuiProvider state:changed event.
  // settitle() is the most common UI op a script does early, so
  // pinning it gives an immediate visual confirmation the runtime
  // is alive.
  $effect(() => {
    if (!runtime) {
      title = "";
      return;
    }
    const ui = runtime.ui;
    const refresh = () => {
      title = ui.state.title ?? "";
    };
    refresh();
    return ui.onStateChange(refresh);
  });

  // Drive the runtime lifecycle from `app.selectedIpo` AND the
  // connection phase — the runtime is started only once a transport
  // is active, and torn down if the user disconnects mid-script.
  $effect(() => {
    const ipo = app.selectedIpo;
    void connection.phase; // re-run when phase changes
    const active = getActiveTransport();

    if (!ipo || !app.install) {
      runtime?.dispose();
      runtime = null;
      return;
    }
    if (!active) {
      runtime?.dispose();
      runtime = null;
      return;
    }

    let cancelled = false;
    let started: RuntimeHandle | null = null;
    error = null;
    loading = true;

    startInpaRuntime({
      install: app.install,
      ipo,
      transport: active.transport,
      simulation: active.simulation,
      timeoutMs: app.config.serial?.timeoutMs ?? 5000,
    })
      .then((handle) => {
        if (cancelled) {
          void handle.dispose();
          return;
        }
        started = handle;
        runtime = handle;
        loading = false;
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        error = err instanceof Error ? err.message : String(err);
        loading = false;
      });

    return () => {
      cancelled = true;
      if (started) void started.dispose();
    };
  });
</script>

<main class="flex h-full flex-1 flex-col bg-zinc-950">
  {#if !app.selectedIpo}
    <div class="flex h-full flex-col items-center justify-center text-zinc-500">
      <p class="text-lg">Pick a script from the sidebar.</p>
    </div>
  {:else}
    <header class="flex items-center gap-3 border-b border-zinc-800 px-4 py-2 text-sm">
      <span class="font-semibold text-zinc-100">{app.selectedIpo.name}</span>
      <span class="text-zinc-500">·</span>
      <span class="text-zinc-500">{app.selectedIpo.origin}</span>
      {#if title}
        <span class="text-zinc-500">·</span>
        <span class="text-accent">{title}</span>
      {/if}
    </header>

    <section class="relative flex-1 overflow-hidden p-2">
      {#if connection.phase !== "connected"}
        <!-- No live transport — prompt the user to connect. Web Serial
             port pick MUST run inside this user-gesture click, so the
             button calls connect() directly here.
             Gating on `connection.phase` rather than
             `getActiveTransport()` makes this reactive — phase is
             `$state`, the transport ref isn't (it'd need a Proxy that
             breaks the interface's `this` binding). -->
        <div class="flex h-full flex-col items-center justify-center gap-4 text-sm">
          <div class="max-w-md text-center text-zinc-400">
            <p class="mb-2 text-zinc-200">Not connected to an EDIABAS interface.</p>
            <p class="text-xs text-zinc-500">
              {app.config.interface === "webserial"
                ? "Connect to pick your K+DCAN / K-line cable via the browser's port picker."
                : app.config.interface === "simulation"
                  ? "Start the simulation interface — no hardware needed."
                  : `Interface "${app.config.interface}" needs to be wired up first.`}
            </p>
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              class="rounded bg-accent px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-accent-muted disabled:opacity-50"
              disabled={connection.phase === "connecting"}
              onclick={() => void connect()}
            >
              {connection.phase === "connecting" ? "Connecting…" : "Connect"}
            </button>
            <button
              type="button"
              class="rounded border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500"
              onclick={() => (app.showSettings = true)}
            >
              Settings…
            </button>
          </div>
          {#if connection.errorMessage}
            <p class="max-w-md rounded border border-red-700 bg-red-950/40 px-3 py-2 text-xs text-red-300">
              {connection.errorMessage}
            </p>
          {/if}
        </div>
      {:else if loading}
        <div class="flex h-full items-center justify-center">
          <p class="text-sm text-zinc-500">Starting runtime…</p>
        </div>
      {:else if error}
        <div class="flex h-full items-center justify-center">
          <div class="max-w-xl rounded border border-red-600/40 bg-red-950/40 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        </div>
      {:else if runtime}
        <!-- ScreenCanvas fills the full section height via its own
             ResizeObserver — wrap so the canvas can't push the layout.
             `onFrameReady` paints on SCREEN cycle boundaries (one paint
             per full LINE-block cycle) so the canvas never catches a
             half-rewritten line — that was the Battery/Ignition
             flicker root cause.
             Wrapper takes the theme background so the "letter-box" area
             around the cell grid (caused by aspect-ratio fitting) blends
             with the canvas instead of showing the dark app shell. Only
             applied while a runtime is live; the Connect / Loading /
             Error states keep the dark zinc-themed bg so their
             dark-on-dark text stays readable. -->
        <div class="h-full w-full" style="background: {classicInpaTheme.background};">
          <ScreenCanvas screen={runtime.screen} onFrameReady={runtime.onFrameReady} />
        </div>
      {/if}
    </section>

    {#if runtime}
      <footer class="border-t border-zinc-800">
        <FKeyBar ui={runtime.ui} />
      </footer>
      <DialogOverlay ui={runtime.ui} />
    {/if}
  {/if}
</main>
