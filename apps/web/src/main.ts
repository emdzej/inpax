import "./app.css";
import App from "./App.svelte";
import { mount } from "svelte";
import { isEmbedded } from "./lib/embedded";

const target = document.getElementById("app");
if (!target) {
  throw new Error("Missing #app mount point");
}

mount(App, { target });

// Register the service worker. `autoUpdate` mode means a new build's
// SW activates after the next page reload — no user-facing prompt
// needed. The two optional callbacks are wired only for diagnostics;
// the actual update / offline-ready behaviour happens inside Workbox.
//
// Skipped in the embedded build — vite.config.ts drops the PWA plugin
// entirely there, so `virtual:pwa-register` doesn't resolve. The
// dynamic import gated by `!isEmbedded` (compile-time constant)
// tree-shakes out of the embedded bundle.
if (!isEmbedded) {
  void import("virtual:pwa-register").then(({ registerSW }) => {
    registerSW({
      onRegisteredSW(swUrl) {
        if (typeof console !== "undefined") {
          console.info(`[pwa] service worker registered at ${swUrl}`);
        }
      },
      onOfflineReady() {
        if (typeof console !== "undefined") {
          console.info("[pwa] offline-ready — bundle is cached, app works without network");
        }
      },
    });
  });
}
