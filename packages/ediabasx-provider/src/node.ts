/**
 * Node-only convenience for inpax's EdiabasXProvider.
 *
 * Lives in a separate subpath (`@emdzej/inpax-ediabasx-provider/node`)
 * so the main entry stays browser-safe — the `createFromConfigFile`
 * helper from `@emdzej/ediabasx-ediabas/node` pulls in `node:fs`, which
 * would otherwise show up in any Vite/webpack bundle that imports the
 * provider.
 *
 * Browser callers build their own `Ediabas` instance (using the file
 * bytes they read via the File System Access API and a Web Serial
 * transport) and hand it to `new EdiabasXProvider({ instance })`.
 */

import {
  EdiabasXProvider,
  type EdiabasXProviderConfig,
} from './ediabasx-provider.js';

export interface NodeEdiabasXProviderConfig
  extends Omit<EdiabasXProviderConfig, 'instance'> {
  /**
   * Path to an `ediabas.config.json` file. Loaded via
   * `@emdzej/ediabasx-ediabas/node`'s `createFromConfigFile()` — the
   * canonical Node convenience. Mutually exclusive with `config` /
   * `instance` (which are inherited from the base type).
   */
  configFile?: string;
}

/**
 * Build an EdiabasXProvider from a JSON config file path. Mirrors the
 * pre-split behaviour of the provider when it accepted `configFile`
 * directly — kept here so Node consumers don't need to know about the
 * lower-level `createFromConfigFile` themselves.
 */
export async function createNodeProvider(
  config: NodeEdiabasXProviderConfig = {}
): Promise<EdiabasXProvider> {
  if (config.configFile) {
    const { createFromConfigFile } = await import(
      '@emdzej/ediabasx-ediabas/node'
    );
    const ediabas = await createFromConfigFile(config.configFile);
    return new EdiabasXProvider({
      instance: ediabas,
      autoConnect: config.autoConnect,
    });
  }
  return new EdiabasXProvider(config);
}

export { EdiabasXProvider, Inp1Adapter } from './index.js';
