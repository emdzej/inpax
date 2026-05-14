<script lang="ts">
  import { onMount } from "svelte";
  import { app } from "../lib/state.svelte";
  import {
    discoverInpaInstall,
    isCompleteInstall,
    isFileSystemAccessSupported,
  } from "../lib/inpa-install";
  import { listIpoFiles } from "../lib/ipo-browser";
  import { settings, isStartupIpo } from "../lib/settings.svelte";
  import {
    saveInstallHandle,
    loadInstallHandle,
    clearInstallHandle,
    queryHandlePermission,
    requestHandlePermission,
  } from "../lib/install-storage";
  import {
    getInstallSource,
    importZipToOpfs,
    loadBundledInstall,
    setInstallSource,
    isOpfsSupported,
    type ImportProgressEvent,
  } from "../lib/bundled-install";

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
  let restoring = $state(false);

  onMount(async () => {
    if (!supported) return;

    // Bundled-install path takes priority: if a bundle was imported
    // previously, OPFS already has the content and `discoverInpaInstall`
    // works against the OPFS root without any permission prompt. The
    // marker is the source of truth; the OPFS contents are read on
    // demand below.
    const source = getInstallSource();
    if (source?.source === "bundled" && opfsSupported) {
      restoring = true;
      try {
        const root = await loadBundledInstall();
        if (root) {
          await openInstall(root, { skipSave: true, source: "bundled" });
          return;
        }
      } catch (err) {
        app.error = err instanceof Error ? err.message : String(err);
      } finally {
        restoring = false;
      }
    }

    const handle = await loadInstallHandle();
    if (!handle) return;
    const perm = await queryHandlePermission(handle);
    if (perm === "granted") {
      // Silent restore — no extra click needed.
      restoring = true;
      try {
        await openInstall(handle, { skipSave: true });
      } catch (err) {
        app.error = err instanceof Error ? err.message : String(err);
      } finally {
        restoring = false;
      }
      return;
    }
    if (perm === "denied") {
      // Stored handle has been revoked at the OS / browser level.
      // Drop it so we don't keep prompting and fall through to the
      // fresh picker.
      await clearInstallHandle();
      return;
    }
    // "prompt": show the Continue button.
    savedHandle = handle;
  });

  async function openInstall(
    handle: FileSystemDirectoryHandle,
    options: { skipSave?: boolean; source?: "fs-access" | "bundled" } = {}
  ): Promise<void> {
    const install = await discoverInpaInstall(handle);
    app.install = install;

    const ipoFiles = [];
    if (install.sgdat) ipoFiles.push(...(await listIpoFiles(install.sgdat, "SGDAT")));
    if (install.cfgdat) ipoFiles.push(...(await listIpoFiles(install.cfgdat, "CFGDAT")));
    app.ipoFiles = ipoFiles;

    // Auto-mount the user's pinned startup IPO, if the install has it.
    // Match is case-insensitive and ignores the `.ipo` extension, so
    // `Ms43_sp2.IPO` pinned earlier still resolves against an install
    // that exposes it as `ms43_sp2.ipo` (or any other casing).
    if (settings.startupIpo) {
      const found = ipoFiles.find((e) => isStartupIpo(e.name));
      if (found) app.selectedIpo = found;
    }

    app.view = "browse";
    if (!options.skipSave) {
      await saveInstallHandle(handle);
      // The bundled path sets its own marker inside importZipToOpfs;
      // only stamp the fs-access marker here so we don't overwrite a
      // freshly-imported bundle's metadata.
      if (options.source !== "bundled") {
        setInstallSource({ source: "fs-access" });
      }
    }
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
      await openInstall(root, { skipSave: true, source: "bundled" });
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
      await openInstall(handle);
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
      await openInstall(savedHandle);
    } catch (err) {
      app.error = err instanceof Error ? err.message : String(err);
    }
  }
</script>

<div class="flex h-full flex-col items-center justify-center gap-8 p-8">
  <div class="max-w-2xl text-center">
    <h1 class="text-4xl font-bold text-accent">INPAX</h1>
    <p class="mt-2 text-muted">BMW INPA scripts, in your browser.</p>
  </div>

  {#if !supported}
    <div class="max-w-md rounded border border-red-300 dark:border-red-600/40 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-300">
      <strong class="font-semibold">Unsupported browser.</strong>
      INPAX needs the File System Access API and Web Serial — both Chromium-only.
      Use Chrome, Edge, or Opera.
    </div>
  {:else if restoring}
    <p class="text-sm text-faint">Restoring last folder…</p>
  {:else}
    {#if savedHandle}
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
      <!-- Two paths to onboarding. Pick folder is the original
           File System Access flow; Import bundle extracts a
           `bimmerz-bundle`-produced zip into OPFS. The bundle path
           sidesteps Chrome's .ini blocklist entirely on Windows
           and survives page reloads without permission re-grants. -->
      <div class="flex flex-col items-stretch gap-4 max-w-xl w-full md:flex-row">
        <button
          class="flex flex-1 flex-col items-center gap-2 rounded border border-rule bg-surface p-4 text-center transition hover:border-accent hover:bg-elevated"
          onclick={pickRoot}
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
            ? "Pick a zip produced by bimmerz-bundle"
            : "OPFS not supported in this browser"}
        >
          <span class="font-semibold text-foreground">Import bundle zip</span>
          <span class="text-xs text-faint">
            One-time import. Stays available across sessions, no
            re-grant needed.
            <a
              href="https://github.com/emdzej/inpax/tree/main/apps/bimmerz-bundler"
              target="_blank"
              rel="noopener noreferrer"
              class="text-accent underline-offset-2 hover:underline"
              onclick={(e: Event) => e.stopPropagation()}
            >Make one with bimmerz-bundle.</a>
          </span>
        </button>
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
</div>
