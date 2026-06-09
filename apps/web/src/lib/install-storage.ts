/**
 * Persist the user's INPA install folder choice between sessions.
 *
 * `FileSystemDirectoryHandle` is structured-cloneable but NOT
 * JSON-serializable, so we use IndexedDB (one tiny single-record
 * key/value store) instead of `localStorage`. The handle itself is
 * preserved; the file *access permission* is not — browsers drop
 * permissions across reloads for security. On startup we
 * `queryPermission({ mode: "read" })` and, if it returns
 * `"granted"`, the handle is usable directly. If it returns
 * `"prompt"`, a user gesture (the "Continue with last folder"
 * button) calls `requestPermission` to re-grant.
 *
 * Chromium-only: the FileSystem Access API + persistent handles
 * are part of the same WICG spec the rest of inpax-web depends on.
 * Firefox / Safari users will never get here — they're blocked
 * earlier by `isFileSystemAccessSupported()`.
 */

const DB_NAME = "inpax-web";
const DB_VERSION = 1;
const STORE_NAME = "install";
const RECORD_KEY = "root";

/**
 * Permission states the Chromium FileSystem Access API exposes.
 */
type PermissionState = "granted" | "denied" | "prompt";

/**
 * Minimal duck-type for the Chromium-only permission methods. The
 * built-in `FileSystemDirectoryHandle` types declare these as
 * always-present; in practice older Chromiums and our test
 * harness omit them, so we narrow via this cast.
 */
type HandleWithPermissions = {
  queryPermission?: (desc?: { mode?: "read" | "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (desc?: { mode?: "read" | "readwrite" }) => Promise<PermissionState>;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Save the install root handle. Idempotent — replaces any prior entry. */
export async function saveInstallHandle(
  handle: FileSystemDirectoryHandle
): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const req = tx.objectStore(STORE_NAME).put(handle, RECORD_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    db.close();
  } catch (err) {
    console.warn("[inpax-web/install-storage] save failed:", err);
  }
}

/** Read the previously-saved handle, or `null` if none / IDB unavailable. */
export async function loadInstallHandle(): Promise<FileSystemDirectoryHandle | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const db = await openDb();
    const handle = await new Promise<FileSystemDirectoryHandle | null>(
      (resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).get(RECORD_KEY);
        req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle) ?? null);
        req.onerror = () => reject(req.error);
      }
    );
    db.close();
    return handle;
  } catch (err) {
    console.warn("[inpax-web/install-storage] load failed:", err);
    return null;
  }
}

/** Remove any persisted handle. Called when the user picks a new folder. */
export async function clearInstallHandle(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const req = tx.objectStore(STORE_NAME).delete(RECORD_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    db.close();
  } catch (err) {
    console.warn("[inpax-web/install-storage] clear failed:", err);
  }
}

/**
 * Check whether the stored handle still has live read access.
 *
 *   - `"granted"`: usable right away (e.g. user previously chose
 *     "Remember this site's permission" — rare but possible).
 *   - `"prompt"`: needs a `requestPermission` call inside a user
 *     gesture before files can be read.
 *   - `"denied"`: the handle is poisoned; the caller should
 *     drop it and re-prompt with a fresh `showDirectoryPicker`.
 */
export async function queryHandlePermission(
  handle: FileSystemDirectoryHandle
): Promise<PermissionState> {
  const h = handle as unknown as HandleWithPermissions;
  if (!h.queryPermission) return "prompt";
  try {
    return await h.queryPermission({ mode: "read" });
  } catch {
    return "prompt";
  }
}

/**
 * Request read permission for the stored handle. MUST be called from
 * inside a user gesture (button click) or the browser rejects it.
 * Returns the resulting permission state.
 */
export async function requestHandlePermission(
  handle: FileSystemDirectoryHandle
): Promise<PermissionState> {
  const h = handle as unknown as HandleWithPermissions;
  if (!h.requestPermission) return "prompt";
  try {
    return await h.requestPermission({ mode: "read" });
  } catch {
    return "denied";
  }
}

/* ── Remote VFS URL persistence (no permission grants needed) ────── */

import { isEmbedded, embeddedEndpoints } from "./embedded";

const REMOTE_URL_KEY = "inpax.web.install.remoteUrl";

/**
 * Persist the URL of a remote VFS install root (HttpDirectory base
 * URL — points to a tree of `index.json` files served over HTTP).
 * No permission grants involved; just localStorage.
 *
 * No-op in embedded builds — the install URL is build-time fixed
 * (the dongle's own `/data` endpoint); persisting wouldn't matter,
 * and skipping the write keeps localStorage clean.
 */
export function saveRemoteInstallUrl(url: string): void {
  if (isEmbedded) return;
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(REMOTE_URL_KEY, url);
  } catch (err) {
    console.warn("[inpax-web/install-storage] save remote URL failed:", err);
  }
}

/**
 * Read the previously-saved remote VFS URL, or `null`.
 *
 * In embedded builds always returns the dongle's `${origin}/data`
 * endpoint, regardless of what's in localStorage. Lets the top-bar
 * source pill's tooltip resolve to the right URL without forcing
 * every call site to branch on `isEmbedded`.
 */
export function loadRemoteInstallUrl(): string | null {
  if (isEmbedded) return embeddedEndpoints().installHttpBase;
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(REMOTE_URL_KEY);
  } catch {
    return null;
  }
}

/** Remove the persisted remote URL. No-op in embedded builds. */
export function clearRemoteInstallUrl(): void {
  if (isEmbedded) return;
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(REMOTE_URL_KEY);
  } catch (err) {
    console.warn("[inpax-web/install-storage] clear remote URL failed:", err);
  }
}
