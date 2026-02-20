/**
 * Null Simulation Provider - no-op implementation
 */

import type { ISimulationProvider } from '@inpax/interfaces';

export class NullSimulationProvider implements ISimulationProvider {
  async simNum(
    _title: string,
    _text: string,
    min: number,
    _max: number
  ): Promise<number> {
    return min;
  }

  async simDigital(
    _title: string,
    _text: string,
    _falseStr: string,
    _trueStr: string
  ): Promise<boolean> {
    return false;
  }
}
