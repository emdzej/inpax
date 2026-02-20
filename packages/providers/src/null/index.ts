/**
 * Null Provider implementations - no-op for testing
 */

export { NullUIProvider } from './ui.js';
export { NullSimulationProvider } from './simulation.js';
export { NullEdiabasProvider } from './ediabas.js';
export { NullInp1Provider } from './inp1.js';
export { NullPrintProvider } from './print.js';
export { NullPemProvider } from './pem.js';
export { NullDtmProvider } from './dtm.js';
export { NullExternalProvider } from './external.js';
export { NullSpsProvider } from './sps.js';

import type { IInpaRuntime } from '@inpax/interfaces';
import { NullUIProvider } from './ui.js';
import { NullSimulationProvider } from './simulation.js';
import { NullEdiabasProvider } from './ediabas.js';
import { NullInp1Provider } from './inp1.js';
import { NullPrintProvider } from './print.js';
import { NullPemProvider } from './pem.js';
import { NullDtmProvider } from './dtm.js';
import { NullExternalProvider } from './external.js';
import { NullSpsProvider } from './sps.js';

export interface NullRuntimeOptions {
  /** Include optional INP1 provider */
  includeInp1?: boolean;
  /** Include optional SPS provider */
  includeSps?: boolean;
}

/**
 * Create a complete null runtime for testing
 */
export function createNullRuntime(options: NullRuntimeOptions = {}): IInpaRuntime {
  return {
    ui: new NullUIProvider(),
    simulation: new NullSimulationProvider(),
    ediabas: new NullEdiabasProvider(),
    inp1: options.includeInp1 ? new NullInp1Provider() : undefined,
    print: new NullPrintProvider(),
    pem: new NullPemProvider(),
    dtm: new NullDtmProvider(),
    external: new NullExternalProvider(),
    sps: options.includeSps ? new NullSpsProvider() : undefined,
  };
}
