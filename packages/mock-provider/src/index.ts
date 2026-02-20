/**
 * @inpax/mock-provider
 * Mock providers for INPA unit testing
 */

export { MockEdiabasProvider, type JobCall, type MockJobResult } from './mock-ediabas.js';
export { MockUIProvider, type UICall, type InputQueue } from './mock-ui.js';

import type { IInpaRuntime } from '@inpax/interfaces';
import { MockEdiabasProvider } from './mock-ediabas.js';
import { MockUIProvider } from './mock-ui.js';

// Re-use null providers for non-mocked parts
import {
  NullSimulationProvider,
  NullInp1Provider,
  NullPrintProvider,
  NullPemProvider,
  NullDtmProvider,
  NullExternalProvider,
  NullSpsProvider,
} from '@inpax/providers';

export interface MockRuntime extends IInpaRuntime {
  ui: MockUIProvider;
  ediabas: MockEdiabasProvider;
}

/**
 * Create a runtime with mock UI and EDIABAS for testing
 */
export function createMockRuntime(): MockRuntime {
  return {
    ui: new MockUIProvider(),
    ediabas: new MockEdiabasProvider(),
    simulation: new NullSimulationProvider(),
    inp1: new NullInp1Provider(),
    print: new NullPrintProvider(),
    pem: new NullPemProvider(),
    dtm: new NullDtmProvider(),
    external: new NullExternalProvider(),
    sps: new NullSpsProvider(),
  };
}
