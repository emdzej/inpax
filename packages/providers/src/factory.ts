/**
 * Runtime Factory and DI System
 * 
 * Provides flexible runtime construction with:
 * - Provider factory registration
 * - Runtime presets (TUI, Test, Null)
 * - Lazy initialization
 * - Composition helpers
 */

import type {
  IInpaRuntime,
  IUIProvider,
  ISimulationProvider,
  IEdiabasProvider,
  IInp1Provider,
  IPrintProvider,
  IPemProvider,
  IDtmProvider,
  IExternalProvider,
  ISpsProvider,
} from '@emdzej/inpax-interfaces';

import {
  NullUIProvider,
  NullSimulationProvider,
  NullEdiabasProvider,
  NullInp1Provider,
  NullPrintProvider,
  NullPemProvider,
  NullDtmProvider,
  NullExternalProvider,
  NullSpsProvider,
} from './null/index.js';

// === Provider Factory Types ===

export type ProviderFactory<T> = () => T;
export type ProviderOrFactory<T> = T | ProviderFactory<T>;

export interface RuntimeConfig {
  ui?: ProviderOrFactory<IUIProvider>;
  simulation?: ProviderOrFactory<ISimulationProvider>;
  ediabas?: ProviderOrFactory<IEdiabasProvider>;
  inp1?: ProviderOrFactory<IInp1Provider>;
  print?: ProviderOrFactory<IPrintProvider>;
  pem?: ProviderOrFactory<IPemProvider>;
  dtm?: ProviderOrFactory<IDtmProvider>;
  external?: ProviderOrFactory<IExternalProvider>;
  sps?: ProviderOrFactory<ISpsProvider>;
}

// === Helper Functions ===

function resolveProvider<T>(providerOrFactory: ProviderOrFactory<T> | undefined, fallback: () => T): T {
  if (providerOrFactory === undefined) {
    return fallback();
  }
  if (typeof providerOrFactory === 'function') {
    return (providerOrFactory as ProviderFactory<T>)();
  }
  return providerOrFactory;
}

// === Runtime Builder ===

export class RuntimeBuilder {
  private config: RuntimeConfig = {};

  ui(provider: ProviderOrFactory<IUIProvider>): this {
    this.config.ui = provider;
    return this;
  }

  simulation(provider: ProviderOrFactory<ISimulationProvider>): this {
    this.config.simulation = provider;
    return this;
  }

  ediabas(provider: ProviderOrFactory<IEdiabasProvider>): this {
    this.config.ediabas = provider;
    return this;
  }

  inp1(provider: ProviderOrFactory<IInp1Provider>): this {
    this.config.inp1 = provider;
    return this;
  }

  print(provider: ProviderOrFactory<IPrintProvider>): this {
    this.config.print = provider;
    return this;
  }

  pem(provider: ProviderOrFactory<IPemProvider>): this {
    this.config.pem = provider;
    return this;
  }

  dtm(provider: ProviderOrFactory<IDtmProvider>): this {
    this.config.dtm = provider;
    return this;
  }

  external(provider: ProviderOrFactory<IExternalProvider>): this {
    this.config.external = provider;
    return this;
  }

  sps(provider: ProviderOrFactory<ISpsProvider>): this {
    this.config.sps = provider;
    return this;
  }

  build(): IInpaRuntime {
    return createRuntime(this.config);
  }
}

// === Main Factory ===

/**
 * Create a runtime with the given configuration.
 * Missing providers fall back to Null implementations.
 */
export function createRuntime(config: RuntimeConfig = {}): IInpaRuntime {
  return {
    ui: resolveProvider(config.ui, () => new NullUIProvider()),
    simulation: resolveProvider(config.simulation, () => new NullSimulationProvider()),
    ediabas: resolveProvider(config.ediabas, () => new NullEdiabasProvider()),
    inp1: resolveProvider(config.inp1, () => new NullInp1Provider()),
    print: resolveProvider(config.print, () => new NullPrintProvider()),
    pem: resolveProvider(config.pem, () => new NullPemProvider()),
    dtm: resolveProvider(config.dtm, () => new NullDtmProvider()),
    external: resolveProvider(config.external, () => new NullExternalProvider()),
    sps: resolveProvider(config.sps, () => new NullSpsProvider()),
  };
}

/**
 * Start building a runtime with fluent API.
 */
export function buildRuntime(): RuntimeBuilder {
  return new RuntimeBuilder();
}

// === Presets ===

/**
 * Create a runtime with all Null providers.
 * Useful for testing or running scripts without side effects.
 */
export function createNullRuntime(): IInpaRuntime {
  return createRuntime();
}

/**
 * Create a runtime for testing with optional overrides.
 */
export function createTestRuntime(overrides: RuntimeConfig = {}): IInpaRuntime {
  return createRuntime(overrides);
}

// === Lazy Runtime ===

/**
 * Runtime that initializes providers lazily on first access.
 */
export class LazyRuntime implements IInpaRuntime {
  private _ui?: IUIProvider;
  private _simulation?: ISimulationProvider;
  private _ediabas?: IEdiabasProvider;
  private _inp1?: IInp1Provider;
  private _print?: IPrintProvider;
  private _pem?: IPemProvider;
  private _dtm?: IDtmProvider;
  private _external?: IExternalProvider;
  private _sps?: ISpsProvider;

  constructor(private factories: RuntimeConfig) {}

  get ui(): IUIProvider {
    if (!this._ui) {
      this._ui = resolveProvider(this.factories.ui, () => new NullUIProvider());
    }
    return this._ui;
  }

  get simulation(): ISimulationProvider {
    if (!this._simulation) {
      this._simulation = resolveProvider(this.factories.simulation, () => new NullSimulationProvider());
    }
    return this._simulation;
  }

  get ediabas(): IEdiabasProvider {
    if (!this._ediabas) {
      this._ediabas = resolveProvider(this.factories.ediabas, () => new NullEdiabasProvider());
    }
    return this._ediabas;
  }

  get inp1(): IInp1Provider {
    if (!this._inp1) {
      this._inp1 = resolveProvider(this.factories.inp1, () => new NullInp1Provider());
    }
    return this._inp1;
  }

  get print(): IPrintProvider {
    if (!this._print) {
      this._print = resolveProvider(this.factories.print, () => new NullPrintProvider());
    }
    return this._print;
  }

  get pem(): IPemProvider {
    if (!this._pem) {
      this._pem = resolveProvider(this.factories.pem, () => new NullPemProvider());
    }
    return this._pem;
  }

  get dtm(): IDtmProvider {
    if (!this._dtm) {
      this._dtm = resolveProvider(this.factories.dtm, () => new NullDtmProvider());
    }
    return this._dtm;
  }

  get external(): IExternalProvider {
    if (!this._external) {
      this._external = resolveProvider(this.factories.external, () => new NullExternalProvider());
    }
    return this._external;
  }

  get sps(): ISpsProvider {
    if (!this._sps) {
      this._sps = resolveProvider(this.factories.sps, () => new NullSpsProvider());
    }
    return this._sps;
  }
}

/**
 * Create a lazy runtime that initializes providers on first access.
 */
export function createLazyRuntime(factories: RuntimeConfig): IInpaRuntime {
  return new LazyRuntime(factories);
}
