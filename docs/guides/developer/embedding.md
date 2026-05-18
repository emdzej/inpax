# Embedding INPAX

A guide for embedding the INPAX runtime (parser + VM + dispatcher +
providers) into your own application. Audience: a developer adding
BMW INPA script execution to a new browser app, a Node CLI, an
Electron tool, or anything else that wants to run `.IPO` bytecode
against a real or simulated ECU.

The full pipeline ships across several `@emdzej/inpax-*` packages —
this guide shows how to assemble them. Two worked end-to-end
examples already exist in the monorepo:

- **CLI / terminal** — [`apps/cli`](../../../apps/cli) (Node + ink TUI).
- **Browser SPA** — [`apps/inpax-web`](../../../apps/inpax-web) (Svelte 5 + Vite).

Read this guide for the conceptual shape; copy from the apps when you
need a complete reference.

---

## 1. The runtime, conceptually

INPA scripts are stack-based bytecode that read sensor values, draw
text-mode screens, and respond to F-keys. The bytecode itself is
host-agnostic — every system call (`scriptselect`, `setscreen`,
`INPAapiJob`, `viewopen`, …) hits a **provider** that supplies the
side-effect. Embedding INPAX means:

```
.ipo bytes
    │
    ▼
parseIpo() → IpoFile
    │
    ▼
new VM(ipo, { runtime }) → VM
    │   ↕  every system call routes through `runtime` (the provider graph)
    │
    ▼
new MainScheduler(vm) → starts the OnIdle loop
    └─ Screen executor — runs INIT / LINE blocks of the active SCREEN
    └─ State-machine executor — runs CONTINUOUS state-machine ticks
    └─ F-key dispatch — handles user menu actions
```

You pick which providers to plug in. Missing providers fall back to
Null implementations (no-op stubs) so the script can still run end-
to-end without crashing.

---

## 2. Package map

A minimal embed pulls in the **VM core**, the **provider
interfaces**, a **runtime builder**, and at least one **UI provider**:

| Package | Role | Required? |
|---|---|---|
| `@emdzej/inpax-parser` | `.IPO` bytecode → `IpoFile` AST | Yes |
| `@emdzej/inpax-interpreter` | `VM` + `MainScheduler` + screen / state-machine executors | Yes |
| `@emdzej/inpax-providers` | `createRuntime({...})` builder + Null fallbacks | Yes |
| `@emdzej/inpax-interfaces` | `IUIProvider`, `IEdiabasProvider`, … type contracts | Types only |
| `@emdzej/inpax-ui-provider-core` | Abstract `UIProvider` base for your renderer | Yes (you'll extend it) |
| `@emdzej/inpax-core` | CP1252 + shared helpers (`formatMany`, `SystemFunction` enum) | Yes (transitive) |
| `@emdzej/inpax-dispatcher` | System-function dispatcher (BEST2 syscall router) | Yes (transitive) |

Add the provider implementations you need:

| Package | Implements | When |
|---|---|---|
| `@emdzej/inpax-web-provider` | `WebUIProvider` + `BrowserExternalProvider` + `BrowserNativeImportProvider` + browser primitives + Svelte 5 components | Browser host |
| `@emdzej/inpax-tui-provider` + `@emdzej/inpax-tui` | `TuiProvider` + ink-based terminal renderer | Terminal host |
| `@emdzej/inpax-cli-provider` | `CliProvider` for headless / scripted runs | Node, no UI |
| `@emdzej/inpax-ediabasx-provider` | `EdiabasXProvider` — real ECU communication via `@emdzej/ediabasx-ediabas` | Any host with real hardware |
| `@emdzej/inpax-mock-provider` | Fake EDIABAS for unit tests | Testing |

For real-ECU transport, the `ediabasx-*` packages live in a sibling
monorepo and ship to npm under the same scope:

| Package | Transport |
|---|---|
| `@emdzej/ediabasx-ediabas` | The core `Ediabas` class — loads PRG/GRP, drives the VM |
| `@emdzej/ediabasx-interface-serial` | Web Serial + Node serialport (K-Line / K+DCAN) |
| `@emdzej/ediabasx-interface-enet` | DoIP / HSFZ over Ethernet |
| `@emdzej/ediabasx-interfaces` | JSON-RPC gateway (client + server). Browser-safe `/client` subpath |

---

## 3. The provider protocol

`createRuntime(config)` (from `@emdzej/inpax-providers`) takes a
config object whose keys map onto the BEST2 subsystems. Pass in what
you implement; the builder fills the rest with Null providers:

```typescript
import { createRuntime } from "@emdzej/inpax-providers";

const runtime = createRuntime({
  ui,          // IUIProvider           — screens, menus, dialogs, F-keys
  ediabas,     // IEdiabasProvider      — INPAapiJob, INPAapiResult, etc.
  external,    // IExternalProvider     — viewopen / viewclose / shell
  inp1,        // IInp1Provider         — older INP1 protocol surface
  print,       // IPrintProvider        — print to file / printer
  pem,         // IPemProvider          — partitioned EEPROM
  dtm,         // IDtmProvider          — diagnostic trouble manager
  sps,         // ISpsProvider          — programming sessions
  simulation,  // ISimulationProvider   — canned-response fixtures
});
```

You typically supply:

- **`ui`** — always. The UI provider owns the cell grid, menu items,
  input dialogs, and the F-key dispatch surface. Pick `WebUIProvider`
  (browser), `TuiProvider` (terminal), or write your own by
  extending `UIProvider` from `@emdzej/inpax-ui-provider-core`.
- **`ediabas`** — when running against a real ECU. Wrap a configured
  `Ediabas` instance with `EdiabasXProvider`.
- **`external`** — if your scripts use `viewopen` / `viewclose`. The
  browser package ships `BrowserExternalProvider`; Node hosts
  typically use the Null one.

Everything else is fine on Null defaults unless you've got scripts
that actually exercise that subsystem (PEM / DTM / SPS are rare;
print is occasional).

---

## 4. Minimal embed (Node / headless)

```typescript
import { readFile } from "node:fs/promises";
import { parseIpo } from "@emdzej/inpax-parser";
import { VM, MainScheduler } from "@emdzej/inpax-interpreter";
import { createRuntime } from "@emdzej/inpax-providers";
import { CliProvider } from "@emdzej/inpax-cli-provider";

// 1. Parse the bytecode
const buffer = await readFile("./MS43.IPO");
const ipo = parseIpo(buffer);

// 2. Build providers — CLI provider stdio in, null everything else
const ui = new CliProvider();
const runtime = createRuntime({ ui });

// 3. Construct the VM + scheduler
const vm = new VM(ipo, { runtime });
const scheduler = new MainScheduler(vm);

// 4. Run
await scheduler.start();
```

This will fault on the first `INPAapiInit` because no `ediabas`
provider is registered (the Null one returns errors). Add real
hardware and a transport — see §6.

---

## 5. Browser embed (Svelte 5 + Vite)

```svelte
<script lang="ts">
  import { parseIpo } from "@emdzej/inpax-parser";
  import { VM, MainScheduler } from "@emdzej/inpax-interpreter";
  import { createRuntime } from "@emdzej/inpax-providers";
  import {
    WebUIProvider,
    BrowserExternalProvider,
    BrowserNativeImportProvider,
    discoverInpaInstall,
    makeBrowserSgbdResolver,
    loadScriptSelect,
    setLibTheme,
    classicInpaTheme,
    ScreenCanvas,
    FKeyBar,
    MenuTitleBar,
    DialogOverlay,
    ViewerDialog,
    UserBoxOverlay,
    ScriptSelectDialog,
    LiveIndicator,
    ScrollIndicator,
  } from "@emdzej/inpax-web-provider";
  import { EdiabasXProvider } from "@emdzej/inpax-ediabasx-provider";
  import { Ediabas } from "@emdzej/ediabasx-ediabas";
  import {
    SerialInterface,
    WebSerialTransport,
  } from "@emdzej/ediabasx-interface-serial";

  // ── 1. Theme context (once, near the root) ────────────────────────
  setLibTheme(classicInpaTheme);

  // ── 2. Install discovery — user picks the INPA install folder ────
  const root = await showDirectoryPicker();
  const install = await discoverInpaInstall(root);
  if (!install.ecu || !install.cfgdat) {
    throw new Error("Pick a folder that contains EDIABAS/Ecu and EC-APPS/INPA/CFGDAT");
  }

  // ── 3. Hardware transport (Web Serial cable) ─────────────────────
  const port = await navigator.serial.requestPort();
  const transport = new SerialInterface({
    port: "webserial",
    baudRate: 115200,
    transport: new WebSerialTransport(port),
    probeAdapterOnConnect: true,
  });

  // ── 4. Ediabas — SGBD loading + ECU job dispatch ─────────────────
  const ediabas = new Ediabas({
    ecuPath: ".",
    transport,
    loadSgbdResolver: makeBrowserSgbdResolver(install.ecu),
  });

  // ── 5. Providers ──────────────────────────────────────────────────
  const ui = new WebUIProvider();
  const external = new BrowserExternalProvider();
  const nativeImports = new BrowserNativeImportProvider({ install });
  await nativeImports.prefetchIniFiles();

  const runtime = createRuntime({
    ui,
    external,
    ediabas: new EdiabasXProvider({ ediabas }),
    inp1: nativeImports, // INP1Provider lookups go through native imports
  });

  // ── 6. Bytecode → VM → scheduler ─────────────────────────────────
  const ipoBytes = await fetchIpoFromInstall(install.sgdat!, "MS43.IPO");
  const ipo = parseIpo(ipoBytes);
  const vm = new VM(ipo, { runtime });
  const scheduler = new MainScheduler(vm);
  await scheduler.start();
</script>

<!-- Components read from the provider; no per-paint wiring needed -->
<ScreenCanvas screen={ui.screenBuffer} {ui} onFrameReady={cb => scheduler.on("cycle:complete", cb)} />
<FKeyBar {ui} />
<MenuTitleBar {ui} />
<DialogOverlay {ui} />
<UserBoxOverlay {ui} />
<ViewerDialog {external} />
<ScriptSelectDialog
  {ui}
  loader={(name) => loadScriptSelect(install.cfgdat!, name)}
/>
<LiveIndicator {ui} />
<ScrollIndicator {ui} />
```

That's everything. Full reference at
[`apps/inpax-web`](../../../apps/inpax-web) — `lib/runtime.svelte.ts`
shows the production wiring with connection lifecycle, install
persistence, and bundle-import support.

---

## 6. Connecting to a real ECU

The `ediabas` provider wraps a configured `Ediabas` instance. The
`Ediabas` constructor takes a `transport` and an SGBD resolver:

```typescript
import { Ediabas } from "@emdzej/ediabasx-ediabas";
```

### Pick a transport

| Transport | Constructor | Where |
|---|---|---|
| Web Serial (browser) | `new SerialInterface({ transport: new WebSerialTransport(port), … })` | Local cable, Chrome/Edge/Opera |
| Node serialport | `new SerialInterface({ transport: new NodeSerialTransport(), port, … })` from `@emdzej/ediabasx-interface-serial/node` | Node CLI |
| ENET / DoIP | `new EnetInterface({ host, port })` | Wired Ethernet to ECU |
| Gateway (TCP) | `new GatewayClient({ host, port, transport: "tcp" })` | Any Node consumer of a remote `ediabasx gateway` |
| Gateway (WebSocket) | `new GatewayClient({ url: "ws://host:6801", transport: "websocket" })` from `@emdzej/ediabasx-interfaces/client` | Browser host wanting a remote cable |
| Simulation | `new SimulationInterface()` from `@emdzej/ediabasx-interface-base` | Tests / offline development |

### Loading SGBDs

The VM asks Ediabas to load `.prg` / `.grp` files when scripts mount
a new ECU. Hosts customise the source via `loadSgbdResolver` on the
Ediabas config:

- **Node** — defaults to `node:fs` reads under `ecuPath`. Set
  `ecuPath` to `<INPA install>/EDIABAS/Ecu`.
- **Browser** — `makeBrowserSgbdResolver(ecuDirHandle)` from
  `@emdzej/inpax-web-provider`. Reads via the `FileSystemDirectoryHandle`,
  handles `.prg ↔ .grp` swap + case-insensitive lookup for installs
  rsync'd from Windows.

### The remote-cable pattern

If the browser can't talk to the cable directly (cable in the
garage, browser on the couch), run the `ediabasx gateway` CLI on the
host with the hardware:

```bash
ediabasx gateway --transport websocket \
  --interface kdcan --serial-port /dev/cu.usbserial-XXX
```

Then in the browser use `GatewayClient` from the `/client` subpath:

```typescript
import { GatewayClient } from "@emdzej/ediabasx-interfaces/client";

const transport = new GatewayClient({
  url: "ws://garage-machine.local:6801",
  transport: "websocket",
});
```

The client is browser-safe — its TCP path uses a lazy `node:net`
import so esbuild and Vite don't try to bundle Node primitives.

---

## 7. Lifecycle hooks

`MainScheduler` and the provider event emitters give you the
extension points you'll need for a real UI:

| Event | Fires when | Use for |
|---|---|---|
| `scheduler.on("cycle:complete", cb)` | Full SCREEN cycle finished (INIT + every visible LINE) | Atomic paint trigger. Wire to `ScreenCanvas.onFrameReady` |
| `scheduler.on("idle", cb)` | One scheduler tick where nothing happened | Diagnostics, debouncing |
| `ui.onStateChange(cb)` | Any provider state mutation | Reactive UI re-render |
| `ui.on("menu:select", cb)` | User picked an F-key item | Custom analytics, logging |
| `ui.on("input:submit", cb)` | Dialog resolved | Validation, telemetry |

Stopping cleanly:

```typescript
await scheduler.stop();   // halts the OnIdle loop, drops pending F-key actions
await ediabas.disconnect(); // closes the cable / WebSocket
```

---

## 8. Scripts that need INPA's CALLE imports

INPA's BEST2 bytecode can call out to Windows DLL entry points
(`kernel32::GetPrivateProfileStringA`, `api32::__apiGetConfig`,
`user32::wvsprintfA`, …) via the CALLE opcode. The dispatcher routes
these to an `INativeImportProvider`. Browser hosts use
`BrowserNativeImportProvider` from `@emdzej/inpax-web-provider`,
which:

- Reads INI files from the picked install (`INPA.INI`, `EDIABAS.INI`).
- Returns synthetic Windows values for `GetWindowsDirectoryA`, etc.
- Routes `__apiGetConfig` through a known-key table you can override.

INPA's INI reads are synchronous from the script's perspective, so
the provider needs the INI bytes in memory by the time the script
runs. Call `prefetchIniFiles()` once during runtime setup:

```typescript
const nativeImports = new BrowserNativeImportProvider({ install });
await nativeImports.prefetchIniFiles();
```

For Node hosts, see the equivalent in
[`apps/cli/src/native-imports/`](../../../apps/cli/src/native-imports)
— a DLL-family-per-file shim reading from `node:fs`.

---

## 9. Configuration

The VM accepts a few knobs. Tune for diagnostic vs production:

```typescript
const vm = new VM(ipo, {
  runtime,
  debug: true,                         // verbose per-instruction logging
  screenExecutor: {
    debug: true,                       // log every screen phase transition
  },
  stateMachineExecutor: {
    debug: true,
  },
});

const scheduler = new MainScheduler(vm, {
  tickInterval: 50,                    // ms between ticks (default 16 = ~60fps)
  debug: true,
});
```

Real INPA's scheduling is "as fast as the event loop allows"; the
default 16 ms tick matches that on modern hosts. Bump to 500 ms when
debugging so the log stream stays legible.

---

## 10. Browser-specific gotchas

Three settings the host app's tooling needs because `@emdzej/inpax-web-provider`
ships Svelte 5 source (no precompiled `dist/`):

- **`tsconfig.json`: `verbatimModuleSyntax: false`.**
  Svelte's `.svelte.ts` module parser rejects the `type` keyword in
  import specifiers (both `import type` and `import { type X }`).
  Turning this off lets TS elide type-only bindings automatically.

- **`vite.config.ts`: don't add the package to `optimizeDeps.include`.**
  Vite's pre-bundling step uses esbuild, which doesn't run the
  Svelte plugin's TS preprocessor. Leaving the package out of the
  include list routes it through the main transformation pipeline
  (which does include the plugin).

- **`tailwind.config.ts`: scan the library's source.** Tailwind's JIT
  only emits classes it finds in `content` paths. Add
  `"<path-to>/node_modules/@emdzej/inpax-web-provider/src/**/*.{ts,svelte}"`
  to the glob (or the workspace path if you're consuming via pnpm
  workspace links). Without this, `FKeyBar` stacks vertically
  because `flex` never makes it into the CSS bundle.

These are also called out at the bottom of
[`packages/web-provider/README.md`](../../../packages/web-provider/README.md).

---

## 11. Worked examples in this repo

For full production wiring including connection lifecycle,
install persistence, settings storage, and PWA setup:

- **`apps/cli`** — terminal runtime. `src/run/` shows the headless +
  TUI variants; `src/native-imports/` is the Node CALLE shim.
- **`apps/inpax-web`** — browser SPA. `src/lib/runtime.svelte.ts` is
  the per-IPO graph builder; `src/lib/connection.svelte.ts` handles
  WebSerial vs gateway-WebSocket transport selection;
  `src/components/IpoRunner.svelte` is the orchestration shell.

These are the **canonical** wirings — copy from them rather than
inventing your own, then strip what you don't need.

---

## 12. See also

- **[`AGENTS.md`](../../../AGENTS.md)** — repo orientation, workspace
  map, release workflow, known gotchas.
- **[`packages/web-provider/README.md`](../../../packages/web-provider/README.md)**
  — full export list + worked Svelte example.
- **[`packages/interpreter/README.md`](../../../packages/interpreter/README.md)**
  — VM model + step / debug API.
- **[`packages/ui-provider-core/README.md`](../../../packages/ui-provider-core/README.md)**
  — provider state shape (what your custom renderer reads).
- **[`docs/guides/developer/inpa/`](./inpa/)** — the INPA scripting
  language reference, when you need to know what bytecode you're
  executing.
