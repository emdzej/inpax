<script lang="ts">
  import { onMount } from "svelte";
  import { FsaDirectory, HttpDirectory, type VirtualDirectory } from "@emdzej/bimmerz-vfs";
  import { app } from "../lib/state.svelte";
  import {
    discoverInpaInstall,
    isCompleteInstall,
    isFileSystemAccessSupported,
    listIpoFiles,
  } from "@emdzej/inpax-web-provider";
  import { settings, isStartupIpo } from "../lib/settings.svelte";
  import {
    saveInstallHandle,
    loadInstallHandle,
    clearInstallHandle,
    queryHandlePermission,
    requestHandlePermission,
    saveRemoteInstallUrl,
    loadRemoteInstallUrl,
    clearRemoteInstallUrl,
  } from "../lib/install-storage";
  import {
    getInstallSource,
    importZipToOpfs,
    loadBundledInstall,
    setInstallSource,
    isOpfsSupported,
    type ImportProgressEvent,
  } from "../lib/bundled-install";
  import { isEmbedded, embeddedEndpoints } from "../lib/embedded";

  const supported = isFileSystemAccessSupported();
  const opfsSupported = isOpfsSupported();

  // Bundled-install state. When the marker says `source: "bundled"`,
  // the OPFS root is the install — no folder picker involved. The
  // import flow lives inline below; the file input is hidden and
  // triggered programmatically from the visible button.
  let zipInput = $state<HTMLInputElement | null>(null);
  let importProgress = $state<{
    fileCount: number;
    bytesWritten: number;
    currentFile: string;
  } | null>(null);
  let importing = $state(false);

  // Stored handle from a previous session (if any), surfaced so the
  // landing screen can show a "Continue with <folder>" affordance.
  // Permission is checked once on mount — if it's already granted, we
  // skip the picker entirely and go straight to the browse view. If
  // it's "prompt", we wait for the user to click Continue (a user
  // gesture, required by the FileSystem Access API to re-grant).
  let savedHandle = $state<FileSystemDirectoryHandle | null>(null);
  let savedRemoteUrl = $state<string | null>(null);
  let restoring = $state(false);

  // Remote VFS URL the user is typing into the inline form. Bound to
  // the input; submit() builds an HttpDirectory and discovers the
  // install.
  let remoteUrl = $state("");
  let remoteSubmitting = $state(false);

  onMount(async () => {
    /* Embedded build (dongle-hosted SPA): the install URL is fixed
       to the dongle's `${origin}/data`. Mount once on boot, then
       bail — no picker UI gets to render in this build because the
       template branch below also gates on isEmbedded. The flag is a
       compile-time constant so the rest of this onMount tree-shakes
       out of the embedded bundle entirely. */
    if (isEmbedded) {
      restoring = true;
      try {
        const { installHttpBase } = embeddedEndpoints();
        /* `skipSave: true` — the URL is build-time-derived from
           window.location, not user input, so we don't want to
           persist it to localStorage (it'd just be regenerated
           next load anyway and would leak the dongle's IP to a
           later non-embedded session sharing the same origin). */
        await openRemoteInstall(installHttpBase, { skipSave: true });
      } catch (err) {
        app.error = `Couldn't mount the dongle's install at ${embeddedEndpoints().installHttpBase}: ${err instanceof Error ? err.message : String(err)}`;
      } finally {
        restoring = false;
      }
      return;
    }

    /* Remote VFS path takes top priority — no permissions to grant,
       no OPFS read either. If the user saved a URL last session, just
       rebuild the HttpDirectory and discover. The URL probably points
       to a stable server; if it 404s, we surface the error and let
       the user pick a different source. */
    const remoteUrlSaved = loadRemoteInstallUrl();
    if (remoteUrlSaved) {
      restoring = true;
      try {
        await openRemoteInstall(remoteUrlSaved, { skipSave: true });
        return;
      } catch (err) {
        app.error = `Remote install at ${remoteUrlSaved} failed: ${err instanceof Error ? err.message : String(err)}`;
        savedRemoteUrl = remoteUrlSaved;
      } finally {
        restoring = false;
      }
    }

    /* Bundled OPFS install: previously imported zip lives in OPFS,
       no permission prompt needed. The marker is the source of
       truth; contents are read on demand below. */
    const source = getInstallSource();
    if (source?.source === "bundled" && opfsSupported) {
      restoring = true;
      try {
        const root = await loadBundledInstall();
        if (root) {
          await openLocalInstall(root, { skipSave: true, source: "bundled" });
          return;
        }
      } catch (err) {
        app.error = err instanceof Error ? err.message : String(err);
      } finally {
        restoring = false;
      }
    }

    /* FSA-picked install: a saved directory handle may have already
       been granted, in which case we silently restore. */
    if (!supported) return;
    const handle = await loadInstallHandle();
    if (!handle) return;
    const perm = await queryHandlePermission(handle);
    if (perm === "granted") {
      restoring = true;
      try {
        await openLocalInstall(handle, { skipSave: true });
      } catch (err) {
        app.error = err instanceof Error ? err.message : String(err);
      } finally {
        restoring = false;
      }
      return;
    }
    if (perm === "denied") {
      /* Stored handle has been revoked at the OS / browser level.
         Drop it so we don't keep prompting and fall through to the
         fresh picker. */
      await clearInstallHandle();
      return;
    }
    /* "prompt": show the Continue button. */
    savedHandle = handle;
  });

  /**
   * Mount a `VirtualDirectory` as the live INPA install. Drives the
   * UI's transition from welcome → browse. Source-agnostic — works
   * the same for FSA, OPFS, and remote HTTP roots.
   */
  async function mountInstall(root: VirtualDirectory): Promise<void> {
    const install = await discoverInpaInstall(root);
    app.install = install;

    const ipoFiles = [];
    if (install.sgdat) ipoFiles.push(...(await listIpoFiles(install.sgdat, "SGDAT")));
    if (install.cfgdat) ipoFiles.push(...(await listIpoFiles(install.cfgdat, "CFGDAT")));
    app.ipoFiles = ipoFiles;

    /* Auto-mount the user's pinned startup IPO if present.
       Case-insensitive name match ignoring `.ipo` extension. */
    if (settings.startupIpo) {
      const found = ipoFiles.find((e) => isStartupIpo(e.name));
      if (found) app.selectedIpo = found;
    }

    app.view = "browse";
  }

  /**
   * FSA / OPFS path — wraps the directory handle in `FsaDirectory`
   * (same VirtualDirectory backing for both, by design of VFS) and
   * mounts.
   */
  async function openLocalInstall(
    handle: FileSystemDirectoryHandle,
    options: { skipSave?: boolean; source?: "fs-access" | "bundled" } = {}
  ): Promise<void> {
    await mountInstall(new FsaDirectory(handle));
    if (!options.skipSave) {
      await saveInstallHandle(handle);
      clearRemoteInstallUrl();
      /* The bundled path sets its own marker inside importZipToOpfs;
         only stamp the fs-access marker here so we don't overwrite a
         freshly-imported bundle's metadata. */
      if (options.source !== "bundled") {
        setInstallSource({ source: "fs-access" });
      }
    }
    /* Mirror the (now-current) source marker into reactive app
       state so the top-bar pill updates without a reload. The
       marker write above happens BEFORE this read, so the value
       reflects the just-completed change. For the bundled path we
       still pick up the marker importZipToOpfs wrote. */
    app.installSource = getInstallSource();
  }

  /**
   * Remote VFS path — builds an `HttpDirectory` rooted at the user's
   * URL (a tree of `index.json` files served over HTTP) and mounts.
   * No permission grants, no OPFS write, just `fetch`.
   */
  async function openRemoteInstall(
    url: string,
    options: { skipSave?: boolean } = {}
  ): Promise<void> {
    const root = new HttpDirectory(url);
    await mountInstall(root);
    if (!options.skipSave) {
      saveRemoteInstallUrl(url);
      /* Switching to a remote install supersedes any prior FSA / OPFS
         source — clear those markers so a reload comes back here. */
      await clearInstallHandle();
      setInstallSource({ source: "remote" });
    }
    app.installSource = getInstallSource();
  }

  function chooseZip(): void {
    zipInput?.click();
  }

  async function onZipSelected(event: Event): Promise<void> {
    const target = event.currentTarget as HTMLInputElement;
    const file = target.files?.[0];
    target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    if (!opfsSupported) {
      app.error = "Bundled install requires OPFS, not available in this browser";
      return;
    }
    app.error = null;
    importing = true;
    importProgress = {
      fileCount: 0,
      bytesWritten: 0,
      currentFile: file.name,
    };
    try {
      await importZipToOpfs(file, (ev: ImportProgressEvent) => {
        if (ev.kind === "file") {
          importProgress = {
            fileCount: ev.fileIndex + 1,
            bytesWritten: ev.bytesWritten,
            currentFile: ev.path,
          };
        }
      });
      const root = await loadBundledInstall();
      if (!root) {
        throw new Error("Bundle import finished but OPFS root unavailable");
      }
      // Drop any saved fs-access handle — the bundled source is now
      // the active one, and re-loading would race against the marker.
      await clearInstallHandle();
      await openLocalInstall(root, { skipSave: true, source: "bundled" });
    } catch (err) {
      app.error = err instanceof Error ? err.message : String(err);
    } finally {
      importing = false;
      importProgress = null;
    }
  }

  function formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
    return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  async function pickRoot() {
    app.error = null;
    try {
      // `mode: "read"` keeps the prompt minimal — we never write to the
      // INPA tree, only the script's own INI handling will need write
      // permission, and that's a per-file ask later.
      const handle = await window.showDirectoryPicker({ mode: "read" });
      await openLocalInstall(handle);
    } catch (err) {
      // User cancelling the picker throws AbortError — that's expected,
      // not an error to surface.
      if (err instanceof DOMException && err.name === "AbortError") return;
      app.error = err instanceof Error ? err.message : String(err);
    }
  }

  async function continueLast() {
    if (!savedHandle) return;
    app.error = null;
    try {
      const perm = await requestHandlePermission(savedHandle);
      if (perm !== "granted") {
        // User declined the prompt or the handle was revoked. Drop it
        // and fall back to the fresh-pick path.
        await clearInstallHandle();
        savedHandle = null;
        return;
      }
      await openLocalInstall(savedHandle);
    } catch (err) {
      app.error = err instanceof Error ? err.message : String(err);
    }
  }

  /** Submit the remote VFS URL form. */
  async function submitRemote(): Promise<void> {
    const url = remoteUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      app.error = "Remote VFS URL must start with http:// or https://";
      return;
    }
    app.error = null;
    remoteSubmitting = true;
    try {
      await openRemoteInstall(url);
    } catch (err) {
      app.error = err instanceof Error ? err.message : String(err);
    } finally {
      remoteSubmitting = false;
    }
  }

  /** Re-mount the previously-saved remote URL after a load failure. */
  async function continueRemote(): Promise<void> {
    if (!savedRemoteUrl) return;
    app.error = null;
    try {
      await openRemoteInstall(savedRemoteUrl, { skipSave: true });
      savedRemoteUrl = null;
    } catch (err) {
      app.error = err instanceof Error ? err.message : String(err);
    }
  }

  /** Drop the saved remote URL and fall back to fresh picker. */
  function dismissRemote(): void {
    clearRemoteInstallUrl();
    savedRemoteUrl = null;
    app.error = null;
  }
</script>

<div class="flex h-full flex-col items-center justify-center gap-8 p-8">
  {#if isEmbedded}
    <!-- Dongle-hosted build: install auto-mounts from `${origin}/data`
         on boot (see onMount above). If we're here, either we're still
         restoring or the mount failed. Surface a focused message; the
         three-tile picker is dead code in this build. -->
    <h1 class="text-4xl font-bold text-accent">INPAX</h1>
    {#if restoring}
      <p class="text-sm text-faint">Mounting install from dongle…</p>
    {:else if app.error}
      <div class="max-w-md rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-600/40 dark:bg-red-950/40 dark:text-red-300">
        {app.error}
      </div>
      <p class="text-xs text-faint">
        The dongle's <code class="text-muted">{embeddedEndpoints().installHttpBase}</code> endpoint isn't reachable.
        Check the dongle's status LED and refresh.
      </p>
    {:else}
      <p class="text-sm text-faint">Waiting for dongle…</p>
    {/if}
  {:else}
  <div class="max-w-2xl text-center">
    <h1 class="text-4xl font-bold text-accent">INPAX</h1>
    <p class="mt-2 text-muted">BMW INPA scripts, in your browser.</p>
    <!-- Build metadata: same shape as the in-app header pill — small,
         faint, links to the matching release tag and the GitHub repo
         so a curious newcomer has somewhere to land. -->
    <div class="mt-3 flex items-center justify-center gap-3 text-xs text-faint">
      <a
        href="https://github.com/emdzej/inpax/releases/tag/{__APP_VERSION__}"
        target="_blank"
        rel="noopener noreferrer"
        class="transition hover:text-foreground"
        title="View release notes on GitHub"
      >
        {__APP_VERSION__}
      </a>
      <span aria-hidden="true">·</span>
      <a
        href="https://github.com/emdzej/inpax"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1 transition hover:text-foreground"
        title="inpax on GitHub"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          width="14"
          height="14"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"
          />
        </svg>
        GitHub
      </a>
    </div>
  </div>

  {#if !supported}
    <!-- Non-Chromium browser: the FSA-based picker is unavailable, but
         remote VFS + (in client mode) Web Serial-free server access
         still work. Soft warning instead of a hard block. -->
    <div class="max-w-md rounded border border-amber-300 dark:border-amber-600/40 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
      <strong class="font-semibold">Limited browser support.</strong>
      The File System Access API and Web Serial are Chromium-only —
      "Pick install folder" and embedded-mode connections won't work.
      You can still mount a remote install over HTTP and run jobs
      through a remote ediabasx-server (Settings → Mode → Client).
    </div>
  {/if}
  {#if restoring}
    <p class="text-sm text-faint">Restoring last install…</p>
  {:else}
    {#if savedRemoteUrl}
      <!-- Previously-saved remote URL failed to load (server down /
           moved). Offer one-click retry, or dismiss to fall through
           to the fresh-picker UI. -->
      <div class="flex flex-col items-center gap-3 max-w-md">
        <p class="text-sm text-foreground">
          Remote install at <code class="text-muted">{savedRemoteUrl}</code> failed to load.
        </p>
        <div class="flex gap-3">
          <button
            class="rounded bg-accent px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-accent-muted transition"
            onclick={continueRemote}
          >
            Retry
          </button>
          <button
            class="rounded border border-rule px-4 py-2 text-sm text-muted hover:border-faint hover:text-foreground transition"
            onclick={dismissRemote}
          >
            Pick a different install
          </button>
        </div>
      </div>
    {:else if savedHandle}
      <!-- Browser dropped the permission across the reload but the
           handle's still around. Re-grant in one click instead of
           making the user re-navigate the filesystem. -->
      <div class="flex flex-col items-center gap-3">
        <button
          class="rounded bg-accent px-6 py-3 font-medium text-zinc-950 hover:bg-accent-muted transition"
          onclick={continueLast}
        >
          Continue with {savedHandle.name}
        </button>
        <button
          class="text-xs text-faint hover:text-muted underline-offset-2 hover:underline"
          onclick={pickRoot}
        >
          Pick a different folder
        </button>
      </div>
    {:else if importing}
      <!-- In-flight bundle import. fflate streams entries one at a
           time so we show "N files, M MB written, currently
           <path>" — meaningful progress on a 1+ GB bundle without
           an exact total. -->
      <div class="flex flex-col items-center gap-3 max-w-xl w-full">
        <p class="text-sm font-medium text-foreground">Importing bundle…</p>
        {#if importProgress}
          <p class="text-xs text-faint">
            {importProgress.fileCount} files · {formatBytes(importProgress.bytesWritten)}
          </p>
          <p class="text-xs text-faint truncate max-w-full">
            {importProgress.currentFile}
          </p>
        {/if}
      </div>
    {:else}
      <!-- Three onboarding paths. All produce a VirtualDirectory the
           rest of the app reads through; the only difference is where
           the bytes live (local disk, OPFS, remote HTTP). Picking one
           does NOT lock you into a connection mode — that's a separate
           Settings choice (embedded cable vs remote ediabasx-server).
           Even client mode needs an install for INPA's .ipo scripts
           — the server only resolves SGBDs, not scripts. -->
      <div class="flex flex-col items-stretch gap-4 max-w-3xl w-full md:flex-row">
        <button
          class="flex flex-1 flex-col items-center gap-2 rounded border border-rule bg-surface p-4 text-center transition hover:border-accent hover:bg-elevated disabled:opacity-50 disabled:cursor-not-allowed"
          onclick={pickRoot}
          disabled={!supported}
          title={supported ? "" : "File System Access API requires Chrome / Edge / Opera"}
        >
          <span class="font-semibold text-foreground">Pick install folder</span>
          <span class="text-xs text-faint">
            Use the OS folder picker. Works against your live INPA install
            on disk. Re-grants permission each session.
          </span>
        </button>
        <button
          class="flex flex-1 flex-col items-center gap-2 rounded border border-rule bg-surface p-4 text-center transition hover:border-accent hover:bg-elevated disabled:opacity-50 disabled:cursor-not-allowed"
          onclick={chooseZip}
          disabled={!opfsSupported}
          title={opfsSupported
            ? "Pick a zip produced by bimmerz CLI tools"
            : "OPFS not supported in this browser"}
        >
          <span class="font-semibold text-foreground">Import bundle zip</span>
          <span class="text-xs text-faint">
            One-time import. Stays available across sessions, no
            re-grant needed.
            <a
              href="https://github.com/emdzej/bimmerz/tree/main/apps/cli"
              target="_blank"
              rel="noopener noreferrer"
              class="text-accent underline-offset-2 hover:underline"
              onclick={(e: Event) => e.stopPropagation()}
            >Make one with bimmerz CLI tools.</a>
          </span>
        </button>
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <form
          class="flex flex-1 flex-col items-stretch gap-2 rounded border border-rule bg-surface p-4 text-center transition hover:border-accent hover:bg-elevated"
          onsubmit={(e) => { e.preventDefault(); void submitRemote(); }}
        >
          <span class="font-semibold text-foreground">Mount remote folder</span>
          <span class="text-xs text-faint">
            Point at a directory served via HTTP with
            <code class="text-muted">index.json</code> listings. Works in
            any browser; no permission grants.
            <a
              href="https://github.com/emdzej/bimmerz/tree/main/packages/vfs"
              target="_blank"
              rel="noopener noreferrer"
              class="text-accent underline-offset-2 hover:underline"
              onclick={(e: Event) => e.stopPropagation()}
            >How to serve one.</a>
          </span>
          <input
            type="url"
            class="rounded border border-rule bg-base px-2 py-1 text-xs text-foreground placeholder:text-faint focus:border-accent focus:outline-none"
            placeholder="http://localhost:3000"
            bind:value={remoteUrl}
            disabled={remoteSubmitting}
            required
          />
          <button
            type="submit"
            class="rounded bg-accent px-3 py-1 text-xs font-medium text-zinc-950 hover:bg-accent-muted disabled:cursor-not-allowed disabled:opacity-50"
            disabled={remoteSubmitting || !remoteUrl.trim()}
          >
            {remoteSubmitting ? "Mounting…" : "Mount"}
          </button>
        </form>
      </div>
      <input
        bind:this={zipInput}
        type="file"
        accept=".zip,application/zip"
        class="hidden"
        onchange={onZipSelected}
      />
      <p class="max-w-md text-center text-sm text-faint">
        Folder pick reads from <code class="text-muted">EC-APPS/</code> and
        <code class="text-muted">EDIABAS/</code>. We auto-discover the scripts
        (SGDAT, CFGDAT) and the SGBD files under EDIABAS/Ecu.
      </p>

      <!-- Heads-up about Chrome's File System Access API hiding `.ini`
           files from web pages on Windows. Without this rename
           workaround, real INPA installs miss their config (INPA.INI
           version banner, EDIABAS.INI defaults) on Windows Chrome.
           Linux / macOS users are unaffected. See
           docs/research/chrome-ini-blocklist.md. -->
      <details
        class="max-w-md rounded border border-blue-300 dark:border-blue-600/40 bg-blue-50 dark:bg-blue-950/40 px-4 py-3 text-sm text-blue-900 dark:text-blue-200"
      >
        <summary class="cursor-pointer font-semibold">
          On Windows? Rename your <code>.INI</code> files first
        </summary>
        <div class="mt-2 space-y-2 text-left">
          <p>
            Chrome on Windows silently hides <code>.ini</code> files
            from web pages (security feature for config-like file
            types). INPAX can't read <code>INPA.INI</code> /
            <code>EDIABAS.INI</code> without your help.
          </p>
          <p class="font-semibold">One-time fix:</p>
          <p>
            Copy these two files to a <code>.INIX</code> extension —
            INPAX will pick them up automatically, your native INPA
            install keeps working as-is:
          </p>
          <pre class="rounded bg-blue-100 dark:bg-blue-950/60 p-2 text-xs leading-relaxed text-blue-900 dark:text-blue-200 overflow-x-auto"><code>copy C:\EDIABAS\Bin\EDIABAS.INI       EDIABAS.INIX
copy C:\EC-APPS\INPA\CFGDAT\INPA.INI  INPA.INIX</code></pre>
          <p class="text-xs text-blue-700 dark:text-blue-300">
            macOS / Linux users (and anyone using the
            zip-import flow when we ship it) can skip this.
          </p>
        </div>
      </details>
    {/if}
  {/if}

  {#if app.error}
    <div class="max-w-md rounded border border-red-300 dark:border-red-600/40 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-300">
      {app.error}
    </div>
  {/if}

  {#if app.install && !isCompleteInstall(app.install)}
    <div class="max-w-md rounded border border-yellow-300 dark:border-yellow-600/40 bg-yellow-50 dark:bg-yellow-950/40 px-4 py-3 text-sm text-yellow-800 dark:text-yellow-200">
      <strong class="font-semibold">Partial INPA install.</strong>
      Found:
      <ul class="mt-1 list-inside list-disc">
        <li class:opacity-50={!app.install.cfgdat}>EC-APPS/INPA/CFGDAT {app.install.cfgdat ? "✓" : "✗"}</li>
        <li class:opacity-50={!app.install.sgdat}>EC-APPS/INPA/SGDAT {app.install.sgdat ? "✓" : "✗"}</li>
        <li class:opacity-50={!app.install.ecu}>EDIABAS/Ecu {app.install.ecu ? "✓" : "✗"}</li>
      </ul>
    </div>
  {/if}
  {/if}
</div>
