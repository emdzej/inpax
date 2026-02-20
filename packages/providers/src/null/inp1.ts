/**
 * Null INP1 Provider - no-op implementation
 */

import { EventEmitter } from 'eventemitter3';
import type { IInp1Provider, Inp1Events } from '@inpax/interfaces';

export class NullInp1Provider
  extends EventEmitter<Inp1Events>
  implements IInp1Provider
{
  async init(): Promise<boolean> {
    return true;
  }

  end(): void {}

  job(_ecu: string, _job: string, _arg1: string, _arg2: string): void {}

  state(): number {
    return 0; // idle
  }

  resultText(_result: string, _set: number, _format: string): [boolean, string] {
    return [false, ''];
  }

  resultInt(_result: string, _set: number): [boolean, number] {
    return [false, 0];
  }

  resultSets(): [boolean, number] {
    return [true, 0];
  }

  resultReal(_result: string, _set: number): [boolean, number] {
    return [false, 0];
  }

  resultBinary(_result: string, _set: number): [boolean, Uint8Array] {
    return [false, new Uint8Array(0)];
  }

  errorCode(): number {
    return 0;
  }

  errorText(): string {
    return '';
  }
}
