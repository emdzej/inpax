<script lang="ts">
  import { onMount } from "svelte";
  import { app } from "../lib/state.svelte";
  import {
    discoverInpaInstall,
    isCompleteInstall,
    isFileSystemAccessSupported,
  } from "../lib/inpa-install";
  import { listIpoFiles } from "../lib/ipo-browser";
  import {
    saveInstallHandle,
    loadInstallHandle,
    clearInstallHandle,
    queryHandlePermission,
    requestHandlePermission,
  } from "../lib/install-storage";

  const supported = isFileSystemAccessSupported();

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
    options: { skipSave?: boolean } = {}
  ): Promise<void> {
    const install = await discoverInpaInstall(handle);
    app.install = install;

    const ipoFiles = [];
    if (install.sgdat) ipoFiles.push(...(await listIpoFiles(install.sgdat, "SGDAT")));
    if (install.cfgdat) ipoFiles.push(...(await listIpoFiles(install.cfgdat, "CFGDAT")));
    app.ipoFiles = ipoFiles;

    app.view = "browse";
    if (!options.skipSave) {
      await saveInstallHandle(handle);
    }
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
    <p class="mt-2 text-zinc-400">BMW INPA scripts, in your browser.</p>
  </div>

  {#if !supported}
    <div class="max-w-md rounded border border-red-600/40 bg-red-950/40 px-4 py-3 text-sm text-red-300">
      <strong class="font-semibold">Unsupported browser.</strong>
      INPAX needs the File System Access API and Web Serial — both Chromium-only.
      Use Chrome, Edge, or Opera.
    </div>
  {:else if restoring}
    <p class="text-sm text-zinc-500">Restoring last folder…</p>
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
          class="text-xs text-zinc-500 hover:text-zinc-300 underline-offset-2 hover:underline"
          onclick={pickRoot}
        >
          Pick a different folder
        </button>
      </div>
    {:else}
      <button
        class="rounded bg-accent px-6 py-3 font-medium text-zinc-950 hover:bg-accent-muted transition"
        onclick={pickRoot}
      >
        Pick your INPA install folder
      </button>
      <p class="max-w-md text-center text-sm text-zinc-500">
        Point at the root that contains <code class="text-zinc-300">EC-APPS/</code> and
        <code class="text-zinc-300">EDIABAS/</code>. We auto-discover the scripts
        (SGDAT, CFGDAT) and the SGBD files under EDIABAS/Ecu.
      </p>
    {/if}
  {/if}

  {#if app.error}
    <div class="max-w-md rounded border border-red-600/40 bg-red-950/40 px-4 py-3 text-sm text-red-300">
      {app.error}
    </div>
  {/if}

  {#if app.install && !isCompleteInstall(app.install)}
    <div class="max-w-md rounded border border-yellow-600/40 bg-yellow-950/40 px-4 py-3 text-sm text-yellow-200">
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
