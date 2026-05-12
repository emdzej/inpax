/**
 * Mock EDIABAS Provider for unit testing
 */

import { EventEmitter } from 'eventemitter3';
import type { IEdiabasProvider, EdiabasEvents } from '@emdzej/inpax-interfaces';

export interface JobCall {
  ecu: string;
  job: string;
  arg1: string;
  arg2: string;
  timestamp: number;
}

export interface MockJobResult {
  sets: number;
  results: Map<string, Map<number, unknown>>;
}

export class MockEdiabasProvider extends EventEmitter<EdiabasEvents> implements IEdiabasProvider {
  /** Recorded job calls for assertions */
  readonly jobCalls: JobCall[] = [];
  
  /** Configured mock results: ecu -> job -> result */
  private mockResults = new Map<string, Map<string, MockJobResult>>();
  
  /** Current job result */
  private currentResult: MockJobResult | null = null;
  
  /** Simulated connection state */
  private _connected = true;

  /** Error to throw on next job (if set) */
  private nextError: { code: number; message: string } | null = null;

  // === Configuration ===

  /**
   * Configure a mock result for a specific ECU/job combination
   */
  setJobResult(ecu: string, job: string, result: MockJobResult): this {
    if (!this.mockResults.has(ecu)) {
      this.mockResults.set(ecu, new Map());
    }
    this.mockResults.get(ecu)!.set(job.toUpperCase(), result);
    return this;
  }

  /**
   * Helper to create a simple result with one set
   */
  setSimpleResult(ecu: string, job: string, values: Record<string, unknown>): this {
    const results = new Map<string, Map<number, unknown>>();
    for (const [key, value] of Object.entries(values)) {
      const setMap = new Map<number, unknown>();
      setMap.set(1, value);
      results.set(key.toUpperCase(), setMap);
    }
    return this.setJobResult(ecu, job, { sets: 1, results });
  }

  /**
   * Set error to be thrown on next job call
   */
  setNextError(code: number, message: string): this {
    this.nextError = { code, message };
    return this;
  }

  /**
   * Simulate connection lost/restored
   */
  setConnected(connected: boolean): void {
    if (this._connected !== connected) {
      this._connected = connected;
      this.emit(connected ? 'connection:restored' : 'connection:lost');
    }
  }

  /**
   * Clear all recorded calls
   */
  clearCalls(): void {
    this.jobCalls.length = 0;
  }

  /**
   * Clear all mock results
   */
  clearResults(): void {
    this.mockResults.clear();
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.clearCalls();
    this.clearResults();
    this.currentResult = null;
    this.nextError = null;
    this._connected = true;
  }

  // === IEdiabasProvider Implementation ===

  async init(): Promise<void> {
    // No-op
  }

  async end(): Promise<void> {
    this.currentResult = null;
  }

  async job(ecu: string, jobName: string, arg1: string, arg2: string): Promise<void> {
    // Record the call
    this.jobCalls.push({
      ecu,
      job: jobName,
      arg1,
      arg2,
      timestamp: Date.now(),
    });

    // Check for configured error
    if (this.nextError) {
      const err = this.nextError;
      this.nextError = null;
      this.emit('job:error', err);
      return;
    }

    // Check connection
    if (!this._connected) {
      this.emit('job:error', { code: -1, message: 'Not connected' });
      return;
    }

    // Find mock result
    const ecuResults = this.mockResults.get(ecu);
    const result = ecuResults?.get(jobName.toUpperCase());

    if (result) {
      this.currentResult = result;
      this.emit('job:complete', { ecu, job: jobName, sets: result.sets });
    } else {
      // Default: empty result
      this.currentResult = { sets: 0, results: new Map() };
      this.emit('job:complete', { ecu, job: jobName, sets: 0 });
    }
  }

  resultSets(): number {
    return this.currentResult?.sets ?? 0;
  }

  resultText(name: string, set: number, _format: string): string {
    const value = this.currentResult?.results.get(name.toUpperCase())?.get(set);
    return value !== undefined ? String(value) : '';
  }

  resultInt(name: string, set: number): number {
    const value = this.currentResult?.results.get(name.toUpperCase())?.get(set);
    return typeof value === 'number' ? Math.floor(value) : 0;
  }

  resultAnalog(name: string, set: number): number {
    const value = this.currentResult?.results.get(name.toUpperCase())?.get(set);
    return typeof value === 'number' ? value : 0;
  }

  resultBinary(name: string, set: number): Uint8Array {
    const value = this.currentResult?.results.get(name.toUpperCase())?.get(set);
    if (value instanceof Uint8Array) return value;
    if (typeof value === 'string') return new TextEncoder().encode(value);
    return new Uint8Array();
  }

  resultDigital(name: string, set: number): boolean {
    const value = this.currentResult?.results.get(name.toUpperCase())?.get(set);
    return Boolean(value);
  }

  hasResult(name: string, set: number): boolean {
    return this.currentResult?.results.get(name.toUpperCase())?.has(set) ?? false;
  }

  checkJobStatus(_ref: string): boolean {
    // In mock, jobs complete synchronously
    return true;
  }

  async fsLesen(ecu: string, fileName: string): Promise<void> {
    await this.job(ecu, 'FS_LESEN', fileName, '');
  }

  async fsLesen2(ecu: string, fileName: string): Promise<void> {
    await this.fsLesen(ecu, fileName);
  }

  fsMode(_mode: number, _fileMode: string, _preInfo: string, _postInfo: string, _jobName: string): void {
    // No-op
  }

  getFsModeConfig(): { mode: number; fileMode: string; preInfoFile: string; postInfoFile: string; jobName: string } {
    return { mode: 0, fileMode: '', preInfoFile: '', postInfoFile: '', jobName: 'FS_LESEN' };
  }
}
