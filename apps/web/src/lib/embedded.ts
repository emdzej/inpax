/**
 * Embedded build helpers — when inpax-web is hosted by the dongle
 * itself (`vite --mode embedded` → `/inpax/` base on a device like
 * the ESP32-P4), connection + install paths are locked to the
 * dongle's HTTP origin instead of letting the user pick. See
 * `vite.config.ts` for the build-mode contract.
 *
 * Two endpoints, both at the dongle's HTTP root (siblings of the
 * `/inpax/` SPA prefix):
 *
 *   • `ws://<origin>/rpc/ediabasx` — JSON-RPC IEdiabas server the
 *     dongle exposes. `EdiabasClient` opens this socket and the
 *     rest of the app talks through the standard IEdiabas surface.
 *   • `http://<origin>/data` — VFS root (a tree of `index.json`
 *     listings, same shape `bimmerz data index` produces). The
 *     install layer mounts an `HttpDirectory` rooted there on boot.
 *
 * The constant `isEmbedded` is a `define` substitution — every
 * `if (!isEmbedded)` block tree-shakes out of the embedded build,
 * and vice versa, so there's no runtime cost in either bundle.
 *
 * Same shape as `apps/web/src/lib/embedded.ts` in ediabasx; kept
 * separate per app so each can evolve its own endpoint conventions.
 */

/** Set to `true` by `vite --mode embedded`; `false` otherwise. */
export const isEmbedded: boolean = __EMBEDDED__;

/**
 * Endpoints the dongle serves alongside the SPA. Computed lazily
 * so the origin is read fresh on every call — handy if the dongle's
 * IP/host changes between sessions (different AP, different LAN
 * IP); the persisted SPA artefact still picks up the right URLs.
 */
export function embeddedEndpoints(): {
  serverWsUrl: string;
  installHttpBase: string;
} {
  const origin = window.location.origin;
  return {
    /* `replace(/^http/, 'ws')` upgrades both http→ws and https→wss
       (regex anchored on the start so the trailing `s` survives).
       Dongle default is plain `http:` (TLS provisioning on ESP32
       SoftAP is awkward); a reverse-proxied deploy might still
       front it with TLS. */
    serverWsUrl: `${origin.replace(/^http/, "ws")}/rpc/ediabasx`,
    installHttpBase: `${origin}/data`,
  };
}
