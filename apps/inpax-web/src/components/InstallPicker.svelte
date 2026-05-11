<script lang="ts">
  import { app } from "../lib/state.svelte";
  import {
    discoverInpaInstall,
    isCompleteInstall,
    isFileSystemAccessSupported,
  } from "../lib/inpa-install";
  import { listIpoFiles } from "../lib/ipo-browser";

  const supported = isFileSystemAccessSupported();

  async function pickRoot() {
    app.error = null;
    try {
      // `mode: "read"` keeps the prompt minimal — we never write to the
      // INPA tree, only the script's own INI handling will need write
      // permission, and that's a per-file ask later.
      const handle = await window.showDirectoryPicker({ mode: "read" });
      const install = await discoverInpaInstall(handle);
      app.install = install;

      // Collect IPO files from SGDAT and CFGDAT. CFGDAT is usually
      // tiny (startus.ipo + maybe a couple of helpers); SGDAT is the
      // bulk of the scripts. Combine them; sidebar groups by `origin`.
      const ipoFiles = [];
      if (install.sgdat) ipoFiles.push(...(await listIpoFiles(install.sgdat, "SGDAT")));
      if (install.cfgdat) ipoFiles.push(...(await listIpoFiles(install.cfgdat, "CFGDAT")));
      app.ipoFiles = ipoFiles;

      app.view = "browse";
    } catch (err) {
      // User cancelling the picker throws AbortError — that's expected,
      // not an error to surface.
      if (err instanceof DOMException && err.name === "AbortError") return;
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
