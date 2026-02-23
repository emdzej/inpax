/**
 * @emdzej/inpax-interfaces
 * TypeScript interfaces for INPA runtime providers
 */

// Events
export * from './events.js';

// Providers
export type { IUIProvider } from './ui.js';
export type { ISimulationProvider } from './simulation.js';
export type { IEdiabasProvider } from './ediabas.js';
export type { IInp1Provider } from './inp1.js';
export type { IPrintProvider } from './print.js';
export type { IPemProvider } from './pem.js';
export type { IDtmProvider } from './dtm.js';
export type { IExternalProvider } from './external.js';
export type { ISpsProvider } from './sps.js';

// Runtime
export type { IInpaRuntime } from './runtime.js';
