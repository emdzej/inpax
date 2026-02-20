/**
 * INPA Runtime - Composite interface
 * Aggregates all providers needed to run INPA scripts
 */

import type { IUIProvider } from './ui.js';
import type { ISimulationProvider } from './simulation.js';
import type { IEdiabasProvider } from './ediabas.js';
import type { IInp1Provider } from './inp1.js';
import type { IPrintProvider } from './print.js';
import type { IPemProvider } from './pem.js';
import type { IDtmProvider } from './dtm.js';
import type { IExternalProvider } from './external.js';
import type { ISpsProvider } from './sps.js';

export interface IInpaRuntime {
  /** Combined UI provider (screen, menu, text, input, messageboxes) */
  ui: IUIProvider;
  
  /** Simulation input provider */
  simulation: ISimulationProvider;
  
  /** Main EDIABAS diagnostic API */
  ediabas: IEdiabasProvider;
  
  /** Alternative EDIABAS API (optional) */
  inp1?: IInp1Provider;
  
  /** Print provider */
  print: IPrintProvider;
  
  /** BMW PEM protocol/label system */
  pem: IPemProvider;
  
  /** Data Transfer Manager */
  dtm: IDtmProvider;
  
  /** External applications/help */
  external: IExternalProvider;
  
  /** PLC interface (optional) */
  sps?: ISpsProvider;
}
