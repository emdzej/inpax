/**
 * Node-only convenience for inpax's EdiabasXProvider.
 *
 * Lives in a separate subpath (`@emdzej/inpax-ediabasx-provider/node`)
 * so the main entry stays browser-safe — `@emdzej/ediabasx-ediabas/node`
 * pulls in `node:fs`, which would otherwise show up in any Vite/webpack
 * bundle that imports the provider.
 *
 * Browser callers build their own `IEdiabas` (typically
 * `EmbeddedEdiabas` with a `loadSgbdResolver` reading from a
 * `FileSystemDirectoryHandle`, or `EdiabasClient` against a remote
 * server) and hand it to `new EdiabasXProvider({ instance })`. This
 * helper is the Node analogue — load an `ediabas.config.json`, build
 * the configured interface, wrap it in `EmbeddedEdiabas`, pass to the
 * provider.
 */

import path from 'node:path';
import { EmbeddedEdiabas } from '@emdzej/ediabasx-client';
import {
  EdiabasXProvider,
  type EdiabasXProviderConfig,
} from './ediabasx-provider.js';

export interface NodeEdiabasXProviderConfig
  extends Omit<EdiabasXProviderConfig, 'instance'> {
  /**
   * Path to an `ediabas.config.json` file. Loaded via
   * `@emdzej/ediabasx-ediabas/node`'s `loadConfig` + interface
   * factory — same shape `ediabasx run` consumes, so a single
   * config drives both the standalone CLI and inpax scripts.
   */
  configFile: string;
}

/**
 * Build an EdiabasXProvider from a JSON config file path.
 *
 * Decomposed from the upstream `createFromConfigFile` so we can build
 * an `EmbeddedEdiabas` (implementing `IEdiabas`) instead of a bare
 * `Ediabas` — the provider's surface is `IEdiabas`-only since 0.7.0
 * of the consumer side.
 */
export async function createNodeProvider(
  config: NodeEdiabasXProviderConfig,
): Promise<EdiabasXProvider> {
  const { loadConfig, defaultInterfaceFactory } = await import(
    '@emdzej/ediabasx-ediabas/node'
  );
  const loaded = await loadConfig(config.configFile);
  if (!loaded) {
    throw new Error(`ediabasx config not found at ${config.configFile}`);
  }
  const { config: cfg, path: absolutePath } = loaded;

  /* Build the EDIABAS interface via the same factory the standalone
     CLI uses. `interface.type === 'simulation'` produces a
     `SimulationInterface`; serial/enet/j2534/gateway produce their
     respective backends. */
  const iface = await defaultInterfaceFactory(cfg.interface);

  /* Resolve the SGBD path relative to the config file's directory
     (same convention as `createFromConfig`). */
  const sgbdPath = path.resolve(path.dirname(absolutePath), cfg.paths.sgbd);

  const ediabas = new EmbeddedEdiabas({
    sgbdPath,
    interface: iface,
    timeout: cfg.timeouts?.response,
  });

  return new EdiabasXProvider({
    instance: ediabas,
    autoConnect: config.autoConnect,
  });
}

export { EdiabasXProvider, Inp1Adapter } from './index.js';
