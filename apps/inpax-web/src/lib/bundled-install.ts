/**
 * Bundled-install backend — stream a `bimmerz-bundle`-produced zip
 * into OPFS and surface the result as a `FileSystemDirectoryHandle`
 * the existing `discoverInpaInstall` / `listIpoFiles` /
 * `BrowserSgbdResolver` / `BrowserNativeImportProvider` code paths
 * can read without any change.
 *
 * Why this works without abstraction: per the File System Access
 * spec, `navigator.storage.getDirectory()` returns the **same
 * `FileSystemDirectoryHandle` type** as `showDirectoryPicker()`. So
 * once we've extracted the bundle into OPFS and have the OPFS root
 * handle, every downstream consumer treats it identically. The only
 * differences are:
 *
 *   - **Permissions**: OPFS is origin-scoped, never prompts. We
 *     skip the `queryPermission`/`requestPermission` dance.
 *   - **Chrome's `.ini` blocklist**: doesn't apply to OPFS. Our
 *     longstanding rename-to-`.INIX` workaround on Windows
 *     becomes unnecessary for users on the bundled path. See
 *     `docs/research/chrome-ini-blocklist.md`.
 *
 * The bundle is just a zip with paths relative to the install root:
 * `EC-APPS/INPA/SGDAT/MS43.IPO`, `EDIABAS/Ecu/MS43.prg`, etc.
 * Produced by the `bimmerz-bundle` CLI (`apps/bimmerz-bundler`).
 */

import { Unzip, UnzipInflate } from "fflate";

/**
 * Marker localStorage key tracking which install source is active.
 * Two shapes:
 *
 *   - `{ source: "fs-access" }` — user picked a folder via
 *     `showDirectoryPicker`. Handle is in IndexedDB
 *     (`install-storage.ts`).
 *   - `{ source: "bundled", ... }` — bundle was extracted into
 *     OPFS. Root handle is reached via
 *     `navigator.storage.getDirectory()`. The metadata below is
 *     surfaced in Settings → Data.
 */
const SOURCE_MARKER_KEY = "inpax-install-source";

export type InstallSource =
  | { source: "fs-access" }
  | {
      source: "bundled";
      importedAt: string; // ISO timestamp
      fileCount: number;
      bytes: number; // uncompressed sum
    };

/** Read the current source marker, or `null` if none set yet. */
export function getInstallSource(): InstallSource | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(SOURCE_MARKER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as InstallSource;
  } catch {
    return null;
  }
}

/** Persist the active source marker. */
export function setInstallSource(source: InstallSource): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(SOURCE_MARKER_KEY, JSON.stringify(source));
  } catch {
    /* quota / disabled — best-effort */
  }
}

/** Drop the source marker. Called by `evictBundledInstall` and by
 *  the fs-access path when the user clears everything. */
export function clearInstallSource(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(SOURCE_MARKER_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Whether the runtime is capable of bundled-install. Requires
 * `navigator.storage.getDirectory` (OPFS), present in all modern
 * Chromium browsers and most Firefox builds. Safari support is
 * partial but inpax-web requires Web Serial anyway.
 */
export function isOpfsSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.storage !== "undefined" &&
    typeof navigator.storage.getDirectory === "function"
  );
}

/** Stats for the active bundled install — combines the localStorage
 *  marker (cheap, sync) with `navigator.storage.estimate()` (slow,
 *  async). Returns `null` if no bundle is active. */
export interface BundledStats {
  importedAt: string;
  fileCount: number;
  /** Uncompressed bytes the bundle reported when imported. */
  declaredBytes: number;
  /** OPFS quota usage (origin total, may include other origin data
   *  the browser stashes alongside). */
  storageUsage: number | null;
  /** OPFS quota cap reported by the browser. */
  storageQuota: number | null;
  /** Whether `navigator.storage.persist()` is in effect — when
   *  `true`, OPFS won't be evicted under disk pressure. */
  persisted: boolean | null;
}

export async function getBundledStats(): Promise<BundledStats | null> {
  const source = getInstallSource();
  if (!source || source.source !== "bundled") return null;

  let storageUsage: number | null = null;
  let storageQuota: number | null = null;
  let persisted: boolean | null = null;
  if (typeof navigator !== "undefined" && navigator.storage) {
    try {
      const est = await navigator.storage.estimate();
      storageUsage = est.usage ?? null;
      storageQuota = est.quota ?? null;
    } catch {
      /* ignore */
    }
    if (typeof navigator.storage.persisted === "function") {
      try {
        persisted = await navigator.storage.persisted();
      } catch {
        /* ignore */
      }
    }
  }

  return {
    importedAt: source.importedAt,
    fileCount: source.fileCount,
    declaredBytes: source.bytes,
    storageUsage,
    storageQuota,
    persisted,
  };
}

/**
 * Get the OPFS root handle if we have an active bundled install.
 * Returns `null` when no bundle marker is set — the caller should
 * fall back to the fs-access path.
 */
export async function loadBundledInstall(): Promise<FileSystemDirectoryHandle | null> {
  if (!isOpfsSupported()) return null;
  const source = getInstallSource();
  if (!source || source.source !== "bundled") return null;
  try {
    return await navigator.storage.getDirectory();
  } catch {
    return null;
  }
}

/**
 * Wipe the bundled install: drop every entry in OPFS, clear the
 * marker. Idempotent.
 */
export async function evictBundledInstall(): Promise<void> {
  if (isOpfsSupported()) {
    try {
      const root = await navigator.storage.getDirectory();
      // Snapshot entry names first — mutating the directory while
      // iterating can skip entries.
      const names: string[] = [];
      for await (const [name] of root.entries()) names.push(name);
      for (const name of names) {
        try {
          await root.removeEntry(name, { recursive: true });
        } catch {
          /* one stubborn entry shouldn't block the rest */
        }
      }
    } catch {
      /* OPFS gone entirely is fine — we're trying to wipe */
    }
  }
  clearInstallSource();
}

/** Progress events emitted during `importZipToOpfs`. */
export type ImportProgressEvent =
  | { kind: "start"; totalBytesEstimate: number }
  | { kind: "file"; path: string; fileIndex: number; bytesWritten: number }
  | { kind: "fileFailed"; path: string; error: string }
  | {
      kind: "done";
      fileCount: number;
      bytes: number;
      decodedFileCount: number;
      decodedBytes: number;
      failures: ReadonlyArray<ImportFailure>;
    };

/** One file the importer couldn't write to OPFS. */
export interface ImportFailure {
  /** The path inside the zip — POSIX, no leading slash. */
  path: string;
  /** Error message from the underlying write attempt. */
  error: string;
}

/** Summary returned by `importZipToOpfs`. */
export interface ImportResult {
  /** Files that successfully landed in OPFS. */
  fileCount: number;
  /** Bytes that successfully landed in OPFS (sum of written file sizes). */
  bytes: number;
  /** Entries fflate handed us — includes ones that later failed to write. */
  decodedFileCount: number;
  /** Sum of decoded entry sizes — should equal `bytes` if all writes succeeded. */
  decodedBytes: number;
  /** Per-file write failures. Empty array means a clean import. */
  failures: ReadonlyArray<ImportFailure>;
}

/**
 * Stream a zip into OPFS. Each entry's bytes are buffered (per
 * entry, not the whole zip) then written via `createWritable`. We
 * don't try to write zip entries directly through `WritableStream`
 * piping because OPFS file handles need `mkdir`-style parent dir
 * creation per entry, which the zip iteration model doesn't
 * naturally express.
 *
 * Memory bound: ~one largest zip entry at a time, plus fflate's
 * internal buffers. INPA SGBDs are typically <5 MB each, IPOs are
 * smaller; this comfortably fits in browser RAM even for a 2 GB
 * install bundle.
 *
 * Wipes any existing OPFS content before extracting — re-import
 * replaces rather than merges (per
 * `docs/proposals/bundled-install.md`).
 */
export async function importZipToOpfs(
  zip: File | Blob,
  onProgress?: (event: ImportProgressEvent) => void,
): Promise<ImportResult> {
  if (!isOpfsSupported()) {
    throw new Error("OPFS is not supported in this browser");
  }

  const root = await navigator.storage.getDirectory();

  // Replace, don't merge.
  await wipeDirectory(root);

  onProgress?.({ kind: "start", totalBytesEstimate: zip.size });

  // Decode-side counters — bumped immediately when fflate hands us a
  // finalised entry. Tells us what the zip claimed to contain.
  let decodedFileCount = 0;
  let decodedBytes = 0;
  // Write-side counters — bumped only when the OPFS write resolves.
  // These are the numbers we actually trust for the install marker.
  let fileCount = 0;
  let bytesWritten = 0;
  const failures: ImportFailure[] = [];

  // Per-entry write promises so we can await all of them at the end
  // before reporting `done`. Without this, callers see "done" while
  // the last few entries are still flushing to OPFS.
  //
  // Each promise is wrapped in `.catch()` so one bad filename doesn't
  // reject `Promise.all` and abort everything else. The failure is
  // recorded for the caller to surface.
  const writePromises: Array<Promise<void>> = [];

  const unzipper = new Unzip((entry) => {
    // Directories in zips end with `/` and contain no data. We
    // create dirs implicitly via `getDirectoryHandle({ create: true })`
    // along the file path so explicit dir entries are skip-safe.
    if (entry.name.endsWith("/")) return;

    const chunks: Uint8Array[] = [];
    let entrySize = 0;
    entry.ondata = (err, chunk, final) => {
      if (err) {
        // fflate calls ondata from its own internal loop. Throwing
        // here gets swallowed by fflate and silently drops the
        // entry — exactly the bug we're trying to surface. Record
        // and continue instead.
        const message = err.message || String(err);
        console.warn(`[bundled-install] unzip failed: ${entry.name} — ${message}`);
        failures.push({ path: entry.name, error: `unzip: ${message}` });
        onProgress?.({ kind: "fileFailed", path: entry.name, error: message });
        return;
      }
      if (chunk && chunk.length > 0) {
        chunks.push(chunk);
        entrySize += chunk.length;
      }
      if (final) {
        const data = concatUint8Arrays(chunks, entrySize);
        decodedFileCount++;
        decodedBytes += data.length;

        const path = entry.name;
        const writePromise = writeOpfsFile(root, path, data).then(
          () => {
            fileCount++;
            bytesWritten += data.length;
            onProgress?.({
              kind: "file",
              path,
              fileIndex: fileCount - 1,
              bytesWritten,
            });
          },
          (writeErr: unknown) => {
            // Swallow at this layer so a bad filename (Windows
            // reserved name, illegal character, etc.) doesn't abort
            // the rest of the import. Console.warn so the offending
            // path is visible in DevTools; record for the caller's
            // summary.
            const message =
              writeErr instanceof Error ? writeErr.message : String(writeErr);
            console.warn(
              `[bundled-install] write failed: ${path} — ${message}`,
            );
            failures.push({ path, error: message });
            onProgress?.({ kind: "fileFailed", path, error: message });
          },
        );
        writePromises.push(writePromise);
      }
    };
    entry.start();
  });
  // `register(UnzipInflate)` enables DEFLATE decoding. Without it
  // fflate can only handle STORE (no compression) entries — our
  // bundler defaults to STORE so this would mostly work even
  // without it, but a user could compress their bundle externally.
  unzipper.register(UnzipInflate);

  // Pump the zip through the unzipper in chunks. Reading via the
  // Blob's stream avoids slurping the whole zip into a single
  // ArrayBuffer.
  const reader = zip.stream().getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      unzipper.push(new Uint8Array(0), true);
      break;
    }
    if (value && value.length > 0) {
      unzipper.push(value);
    }
  }

  // Wait for every per-entry write to flush before marking done.
  // Each write promise already swallows its own rejection into
  // `failures`, so this never throws.
  await Promise.all(writePromises);

  // Best-effort persistent-storage request — flips OPFS to
  // "won't be evicted under disk pressure". User may have already
  // granted; either way we move on.
  if (typeof navigator !== "undefined" && navigator.storage?.persist) {
    try {
      await navigator.storage.persist();
    } catch {
      /* ignore */
    }
  }

  // Marker reflects what actually landed in OPFS, not what fflate
  // decoded. If decode > written, the user has a real problem and
  // the failures array tells them which paths.
  setInstallSource({
    source: "bundled",
    importedAt: new Date().toISOString(),
    fileCount,
    bytes: bytesWritten,
  });

  // Summary log — visible in DevTools regardless of whether the
  // UI surfaces the failures array. Lets a user dig in even if the
  // host SPA forgets to render the warning.
  if (failures.length > 0) {
    console.warn(
      `[bundled-install] import completed with ${failures.length} failure(s)`,
      {
        decodedFiles: decodedFileCount,
        decodedBytes,
        writtenFiles: fileCount,
        writtenBytes: bytesWritten,
        failures,
      },
    );
  } else {
    console.info(
      `[bundled-install] import clean: ${fileCount} files / ${bytesWritten} bytes`,
    );
  }

  onProgress?.({
    kind: "done",
    fileCount,
    bytes: bytesWritten,
    decodedFileCount,
    decodedBytes,
    failures,
  });

  return {
    fileCount,
    bytes: bytesWritten,
    decodedFileCount,
    decodedBytes,
    failures,
  };
}

// ============ internal helpers ============

async function wipeDirectory(dir: FileSystemDirectoryHandle): Promise<void> {
  // Snapshot to avoid concurrent-modification weirdness during the
  // iterator's remove pass.
  const names: string[] = [];
  for await (const [name] of dir.entries()) names.push(name);
  for (const name of names) {
    try {
      await dir.removeEntry(name, { recursive: true });
    } catch (err) {
      console.warn("[bundled-install] failed to remove", name, err);
    }
  }
}

/**
 * Write `data` to `root/<path>`, creating any intermediate dirs.
 * Path uses POSIX separators (matches the zip's entry naming).
 */
async function writeOpfsFile(
  root: FileSystemDirectoryHandle,
  path: string,
  data: Uint8Array,
): Promise<void> {
  // Normalise + split. Some zips have backslash-separated paths
  // (Windows-zipped from cmd.exe pre-2018-ish); handle defensively.
  const segments = path
    .replace(/\\/g, "/")
    .split("/")
    .filter((s) => s.length > 0);
  if (segments.length === 0) return;
  const filename = segments.pop()!;

  let current = root;
  for (const seg of segments) {
    current = await current.getDirectoryHandle(seg, { create: true });
  }

  const fileHandle = await current.getFileHandle(filename, { create: true });
  // `FileSystemWritableFileStream` is the OPFS write surface;
  // `write(data)` accepts Uint8Array directly. The cast to a
  // freshly-typed view sidesteps a TS 5.7+ tightening where the
  // FileSystem Access types use `ArrayBufferView<ArrayBuffer>` and
  // fflate returns `Uint8Array<ArrayBufferLike>` — same runtime
  // shape, different generic argument.
  const writable = await fileHandle.createWritable();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await writable.write(data as any);
  } finally {
    await writable.close();
  }
}

function concatUint8Arrays(chunks: Uint8Array[], totalSize: number): Uint8Array {
  if (chunks.length === 1) return chunks[0];
  const out = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}
