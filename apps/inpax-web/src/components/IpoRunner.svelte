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
  import { classicInpaTheme, darkInpaTheme } from "../lib/theme";
  import { isDarkTheme } from "../lib/settings.svelte";
  import ScreenCanvas from "./ScreenCanvas.svelte";
  import FKeyBar from "./FKeyBar.svelte";
  import MenuTitleBar from "./MenuTitleBar.svelte";
  import DialogOverlay from "./DialogOverlay.svelte";
  import ScriptSelectDialog from "./ScriptSelectDialog.svelte";
  import ConnectDialog from "./ConnectDialog.svelte";
  import UserBoxOverlay from "./UserBoxOverlay.svelte";
  import ViewerDialog from "./ViewerDialog.svelte";
  import LiveIndicator from "./LiveIndicator.svelte";
  import ScrollIndicator from "./ScrollIndicator.svelte";

  let runtime = $state<RuntimeHandle | null>(null);
  let title = $state("");
  let error = $state<string | null>(null);
  let loading = $state(false);

  // Active canvas theme — same derivation as inside ScreenCanvas, so
  // the wrapper's letter-box background matches the canvas's own fill
  // when the cell grid is letter-boxed inside its container.
  const canvasTheme = $derived(isDarkTheme() ? darkInpaTheme : classicInpaTheme);

  // Reference to the ScreenCanvas's underlying `<canvas>`, wired up
  // by the `bindCanvas` callback below. The screenshot button reads
  // bytes off this to feed `navigator.clipboard.write` or fall back
  // to a download.
  let canvasEl = $state<HTMLCanvasElement | null>(null);
  let snapshotState = $state<"idle" | "ok" | "downloaded" | "error">("idle");
  let snapshotTimer: ReturnType<typeof setTimeout> | null = null;

  function flashSnapshot(next: typeof snapshotState): void {
    snapshotState = next;
    if (snapshotTimer) clearTimeout(snapshotTimer);
    snapshotTimer = setTimeout(() => {
      snapshotState = "idle";
      snapshotTimer = null;
    }, 1800);
  }

  async function takeScreenshot(): Promise<void> {
    if (!canvasEl) return;
    const blob: Blob | null = await new Promise((resolve) =>
      canvasEl!.toBlob((b) => resolve(b), "image/png"),
    );
    if (!blob) {
      flashSnapshot("error");
      return;
    }
    // Preferred path: copy PNG bytes to the system clipboard. Requires
    // a secure context AND ClipboardItem (Chromium ≥ 76 / FF ≥ 127).
    // If anything in that chain is missing or the browser denies,
    // fall back to a download so the user still gets the bytes.
    const Item = (window as unknown as { ClipboardItem?: typeof ClipboardItem })
      .ClipboardItem;
    if (
      navigator.clipboard &&
      typeof navigator.clipboard.write === "function" &&
      Item
    ) {
      try {
        await navigator.clipboard.write([new Item({ "image/png": blob })]);
        flashSnapshot("ok");
        return;
      } catch {
        /* fall through to download */
      }
    }
    // Download fallback.
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .replace("T", "_")
      .slice(0, 19);
    const base = app.selectedIpo?.name.replace(/\.ipo$/i, "") ?? "inpax";
    a.download = `${base}_${stamp}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    flashSnapshot("downloaded");
  }

  // Re-snapshot the title on every WebUIProvider state:changed event.
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

  // Pagination keymap — ↑ / ↓ step one LINE block, PgUp / PgDn step
  // a full page (visibleCount - 1), Home / End jump to top / bottom.
  // Gated on `isEditableTarget` (same predicate FKeyBar uses) so the
  // shortcuts don't steal input from text fields. No-op if the
  // active SCREEN doesn't overflow (`scrollLines` clamps internally).
  // See `docs/research/screen-line-pagination.md`.
  function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
  }

  $effect(() => {
    if (!runtime) return;
    const ui = runtime.ui;
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      // Only consume the key when the active SCREEN actually overflows
      // — otherwise leave the event alone so other handlers (or the
      // browser) can react. `state.totalLines > visibleLineCount` is
      // the same predicate ScrollIndicator uses to decide visibility.
      const overflowing =
        ui.state.totalLines > ui.state.visibleLineCount &&
        ui.state.visibleLineCount > 0;
      if (!overflowing) return;
      const page = Math.max(1, ui.state.visibleLineCount - 1);
      switch (e.key) {
        case "ArrowUp":
          ui.scrollLines(-1);
          e.preventDefault();
          return;
        case "ArrowDown":
          ui.scrollLines(1);
          e.preventDefault();
          return;
        case "PageUp":
          ui.scrollLines(-page);
          e.preventDefault();
          return;
        case "PageDown":
          ui.scrollLines(page);
          e.preventDefault();
          return;
        case "Home":
          ui.scrollToTop();
          e.preventDefault();
          return;
        case "End":
          ui.scrollToBottom();
          e.preventDefault();
          return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Wire `exit()` / `exitwindows()` → clear the selection so the
  // lifecycle effect below disposes the runtime and the UI falls back
  // to the "Pick a script from the sidebar" idle state. Real INPA on
  // Windows terminates the process; for inpax-web we just unload the
  // script — the user stays in the app and can pick another.
  $effect(() => {
    if (!runtime) return;
    const ui = runtime.ui;
    const handler = () => {
      app.selectedIpo = null;
    };
    ui.on("script:exit", handler);
    return () => {
      ui.off("script:exit", handler);
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
      // against the new WebUIProvider.
      runtime = null;
    };
  });
</script>

<main class="flex h-full flex-1 flex-col bg-base">
  {#if !app.selectedIpo}
    <div class="flex h-full flex-col items-center justify-center text-faint">
      <p class="text-lg">Pick a script from the sidebar.</p>
    </div>
  {:else}
    <header class="flex items-center gap-3 border-b border-divider px-4 py-2 text-sm">
      <!-- Lead with the script-supplied title (what the user is
           actually looking at), trail with the on-disk source in
           muted parens. The path uses the Windows-style separator
           because that's what's familiar from the BMW install
           layout (`SGDAT\MS430.IPO`). -->
      {#if title}
        <span class="font-semibold text-foreground">{title}</span>
        <span class="text-faint">({app.selectedIpo.origin}\{app.selectedIpo.name})</span>
      {:else}
        <!-- Pre-`settitle` (or scripts that don't call it): only
             the path is meaningful, so promote it from "context" to
             "label" while keeping the muted tone. -->
        <span class="font-semibold text-foreground">{app.selectedIpo.origin}\{app.selectedIpo.name}</span>
      {/if}
      <!-- Screenshot button — pushed to the far right via `ml-auto`.
           Tries `navigator.clipboard.write` first; on browsers
           without image clipboard support (or when the page lacks a
           secure context — i.e. the LAN-dev-server flow on
           http://) falls back to triggering a PNG download. The
           `snapshotState` flash gives feedback without a toast
           library. -->
      <button
        type="button"
        class="ml-auto flex items-center gap-1.5 rounded border border-rule px-2 py-1 text-xs text-muted transition hover:border-rule hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!canvasEl}
        onclick={() => void takeScreenshot()}
        title={snapshotState === "ok"
          ? "Copied PNG to clipboard"
          : snapshotState === "downloaded"
            ? "Saved PNG (clipboard write blocked)"
            : snapshotState === "error"
              ? "Couldn't capture canvas"
              : "Copy canvas as PNG to clipboard (falls back to download)"}
      >
        <span aria-hidden="true" class="text-sm">
          {#if snapshotState === "ok"}✓{:else if snapshotState === "downloaded"}⬇{:else if snapshotState === "error"}✕{:else}⎙{/if}
        </span>
        <span>
          {#if snapshotState === "ok"}Copied{:else if snapshotState === "downloaded"}Saved{:else if snapshotState === "error"}Failed{:else}Screenshot{/if}
        </span>
      </button>
    </header>

    <section class="relative flex-1 overflow-hidden p-2">
      {#if loading}
        <div class="flex h-full items-center justify-center">
          <p class="text-sm text-faint">Starting runtime…</p>
        </div>
      {:else if error}
        <div class="flex h-full items-center justify-center">
          <div class="max-w-xl rounded border border-red-300 dark:border-red-600/40 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-300">
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
             Wrapper takes the active INPA-canvas background so the
             "letter-box" area around the cell grid (caused by aspect-
             ratio fitting) blends with the canvas. The canvas itself
             selects between `classicInpaTheme` (light) and
             `darkInpaTheme` (dark) via `isDarkTheme()`; the script's
             explicit colour codes get mapped through the active
             palette so both themes stay readable. -->
        <div class="relative h-full w-full" style="background: {canvasTheme.background};">
          <ScreenCanvas
            screen={runtime.screen}
            ui={runtime.ui}
            onFrameReady={runtime.onFrameReady}
            bindCanvas={(el) => (canvasEl = el)}
          />
          <!-- UserBoxOverlay sits on top of the canvas so scripts'
               `userboxopen`/`userboxftextout` progress dialogs (e.g.
               "Fehlerspeicher lesen") become visible. -->
          <UserBoxOverlay ui={runtime.ui} />
          <!-- Corner pulse for cyclic screens — at-a-glance "data is
               refreshing" signal that the original INPA achieved via
               per-LINE blinking dots. -->
          <LiveIndicator ui={runtime.ui} />
          <!-- Bottom-right ▲/▼ buttons for screens whose LINE-block
               count exceeds the viewport. Hidden entirely when
               `totalLines <= visibleLineCount`. See
               `docs/research/screen-line-pagination.md`. -->
          <ScrollIndicator ui={runtime.ui} />
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
        <MenuTitleBar ui={runtime.ui} />
        <footer class="border-t border-divider">
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
