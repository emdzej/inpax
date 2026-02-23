/**
 * Null SPS Provider - no-op implementation
 */

import type { ISpsProvider } from '@emdzej/inpax-interfaces';

export class NullSpsProvider implements ISpsProvider {
  init(): void {}
  end(): void {}
  leseVonSPS(..._args: unknown[]): unknown { return null; }
  sendeAnSPS(..._args: unknown[]): unknown { return null; }
  leseVakWerte(..._args: unknown[]): unknown { return null; }
}
