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
  import { getActiveTransport } from "../lib/connection.svelte";
  import { startInpaRuntime, type RuntimeHandle } from "../lib/runtime.svelte";
  import { classicInpaTheme } from "../lib/theme";
  import ScreenCanvas from "./ScreenCanvas.svelte";
  import FKeyBar from "./FKeyBar.svelte";
  import DialogOverlay from "./DialogOverlay.svelte";
  import ScriptSelectDialog from "./ScriptSelectDialog.svelte";
  import ConnectDialog from "./ConnectDialog.svelte";
  import UserBoxOverlay from "./UserBoxOverlay.svelte";
  import ViewerDialog from "./ViewerDialog.svelte";

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

  // Wire up the `scriptselect` → swap-IPO flow. The interpreter's
  // scriptselect handler fires `script:switch` on the ui once the
  // user picks an IPO in the dialog; resolve that to one of our
  // `app.ipoFiles` entries (case-insensitive, with or without the
  // `.IPO` extension) and update `app.selectedIpo` — the runtime
  // lifecycle effect below picks up the change and rebuilds.
  $effect(() => {
    if (!runtime) return;
    const ui = runtime.ui;
    const handler = ({ ipo, iniFile }: { ipo: string; iniFile: string }) => {
      const wanted = ipo.toLowerCase().replace(/\.ipo$/, "");
      const found = app.ipoFiles.find(
        (e) => e.name.toLowerCase().replace(/\.ipo$/, "") === wanted
      );
      if (!found) {
        // Surface the missing-file case so the user knows the script
        // tried to switch to something we couldn't resolve.
        error = `scriptselect: IPO "${ipo}" not found in SGDAT/CFGDAT (from ${iniFile})`;
        return;
      }
      app.selectedIpo = found;
    };
    ui.on("script:switch", handler);
    return () => {
      ui.off("script:switch", handler);
    };
  });

  // Drive the runtime lifecycle from `app.selectedIpo` alone — the
  // moment the user picks a script, mount the runtime. The script's
  // own `INPAapiInit` will then drive the cable open (via the
  // dispatcher → `ui.ensureConnected()` flow); we no longer gate on
  // `connection.phase` here. `getTransport` is a callback the
  // EdiabasXProvider pulls at `init()` time, so a still-null
  // transport at IPO-mount time is fine — by the time `INPAapiInit`
  // fires, the user will have clicked Connect inside the modal.
  $effect(() => {
    const ipo = app.selectedIpo;

    if (!ipo || !app.install) {
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
      getTransport: () => getActiveTransport()?.transport ?? null,
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
      // Null the reactive `runtime` reference too. Otherwise it keeps
      // pointing at the just-disposed handle until the new one
      // resolves; child components (`FKeyBar`, `ScreenCanvas`, the
      // dialog overlays) read `runtime.ui` and won't notice the swap
      // until `runtime` is reassigned to the new handle. The brief
      // `null` state forces them to unmount and re-mount fresh
      // against the new TuiProvider.
      runtime = null;
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
      {#if loading}
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
        <div class="relative h-full w-full" style="background: {classicInpaTheme.background};">
          <ScreenCanvas screen={runtime.screen} ui={runtime.ui} onFrameReady={runtime.onFrameReady} />
          <!-- UserBoxOverlay sits on top of the canvas so scripts'
               `userboxopen`/`userboxftextout` progress dialogs (e.g.
               "Fehlerspeicher lesen") become visible. -->
          <UserBoxOverlay ui={runtime.ui} />
        </div>
      {/if}
    </section>

    {#if runtime}
      <!-- `{#key runtime}` forces every child to fully remount when
           the runtime handle is swapped (IPO change via scriptselect).
           Without it Svelte 5 sees the same `<FKeyBar>` block before
           and after the swap and just patches the `ui` prop in place —
           any internal `$state` the component already snapshotted from
           the OLD provider (menu items, title, etc.) sticks around.
           With it, the children unmount + mount fresh against the new
           `runtime.ui`, picking up the new provider's empty state and
           then populating from its `setitem` calls. -->
      {#key runtime}
        <footer class="border-t border-zinc-800">
          <FKeyBar ui={runtime.ui} />
        </footer>
        <DialogOverlay ui={runtime.ui} />
        <ScriptSelectDialog ui={runtime.ui} />
        <ConnectDialog ui={runtime.ui} />
        <ViewerDialog external={runtime.external} />
      {/key}
    {/if}
  {/if}
</main>
