/**
 * Null EDIABAS Provider - no-op implementation for testing
 */

import { EventEmitter } from 'eventemitter3';
import type { IEdiabasProvider, EdiabasEvents } from '@emdzej/inpax-interfaces';

export class NullEdiabasProvider
  extends EventEmitter<EdiabasEvents>
  implements IEdiabasProvider
{
  async init(): Promise<void> {}
  async end(): Promise<void> {}

  async job(
    _ecu: string,
    _job: string,
    _arg1: string,
    _arg2: string
  ): Promise<void> {
    this.emit('job:complete', { ecu: _ecu, job: _job, sets: 0 });
  }

  resultSets(): number {
    return 0;
  }

  resultText(_result: string, _set: number, _format: string): string {
    return '';
  }

  resultInt(_result: string, _set: number): number {
    return 0;
  }

  resultDigital(_result: string, _set: number): boolean {
    return false;
  }

  resultAnalog(_result: string, _set: number): number {
    return 0;
  }

  resultBinary(_result: string, _set: number): Uint8Array {
    return new Uint8Array(0);
  }

  hasResult(_result: string, _set: number): boolean {
    return false;
  }

  checkJobStatus(_refStr: string): boolean {
    return true;
  }

  isBusy(): boolean {
    return false;
  }

  async fsLesen(_ecu: string, _fileName: string): Promise<void> {}
  async fsLesen2(_ecu: string, _fileName: string): Promise<void> {}

  fsMode(
    _mode: number,
    _fileMode: string,
    _preInfoFile: string,
    _postInfoFile: string,
    _jobName: string
  ): void {}

  getFsModeConfig(): { mode: number; fileMode: string; preInfoFile: string; postInfoFile: string; jobName: string } {
    return { mode: 0, fileMode: '', preInfoFile: '', postInfoFile: '', jobName: 'FS_LESEN' };
  }
}
