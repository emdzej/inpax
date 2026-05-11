/**
 * Inp1Adapter — exposes the INP1 API surface over an `EdiabasXProvider`.
 *
 * Many BMW INPA scripts (MS43, startus, etc.) mix the two EDIABAS-facing
 * APIs: they kick off a job via `INPAapiJob` (blocking, no rc) and then
 * read results via `INP1apiResultInt` / `INP1apiResultText` (rc + value
 * tuple). Both surfaces share the same underlying EDIABAS state — same
 * SGBD, same `enewset` result sets, same `JOB_STATUS`. This adapter
 * delegates every method to the wrapped provider's existing state and
 * reshapes the return into the INP1 `[rc, value]` form.
 *
 * Events:
 *   - `job:complete` / `job:error` are forwarded from the wrapped
 *     provider so consumers that subscribe to the INP1 surface still
 *     get the same signals.
 *   - `state:changed` (INP1-specific) fires when the adapter's job
 *     state transitions (idle → running → complete/error).
 */

import { EventEmitter } from 'eventemitter3';
import type {
  IEdiabasProvider,
  IInp1Provider,
  Inp1Events,
} from '@emdzej/inpax-interfaces';

type JobState = 0 | 1 | 2 | 3; // 0=idle, 1=running, 2=complete, 3=error

export class Inp1Adapter
  extends EventEmitter<Inp1Events>
  implements IInp1Provider
{
  private jobState: JobState = 0;
  private lastErrorCode = 0;
  private lastErrorText = '';

  constructor(private readonly ediabas: IEdiabasProvider) {
    super();
    // Forward EDIABAS events through the INP1 surface so consumers that
    // subscribe to either provider see the same lifecycle. Note: the
    // wrapped provider emits these synchronously after a job resolves,
    // so we can lean on them to drive the INP1 state machine.
    ediabas.on('job:complete', (event) => {
      this.jobState = 2;
      this.emit('job:complete', event);
      this.emit('state:changed', { state: this.jobState });
    });
    ediabas.on('job:error', (event) => {
      this.jobState = 3;
      this.lastErrorCode = event.code;
      this.lastErrorText = event.message;
      this.emit('job:error', event);
      this.emit('state:changed', { state: this.jobState });
    });
  }

  // === Lifecycle ===

  async init(): Promise<boolean> {
    // The wrapped provider already initialised the EDIABAS link (the
    // inpax CLI wires its lifecycle independently). INP1's `init` is a
    // success probe — return true unless the underlying ediabas
    // instance never came up.
    return true;
  }

  end(): void {
    // No-op — the wrapped provider owns the EDIABAS lifecycle. INP1's
    // `end` is fire-and-forget per the native API.
  }

  // === Job Execution ===

  job(ecu: string, jobName: string, arg1: string, arg2: string): void {
    // INP1's job is non-blocking — kick off the underlying async job
    // and let state transitions drive any polling caller. We don't
    // await; the EDIABAS provider emits job:complete / job:error which
    // updates state via the listeners wired in the constructor.
    this.jobState = 1;
    this.emit('state:changed', { state: this.jobState });
    void this.ediabas.job(ecu, jobName, arg1, arg2);
  }

  state(): number {
    return this.jobState;
  }

  // === Results — all return [rc, value] tuples ===

  resultText(name: string, set: number, format: string): [boolean, string] {
    const rc = this.ediabas.hasResult(name, set);
    return [rc, this.ediabas.resultText(name, set, format)];
  }

  resultInt(name: string, set: number): [boolean, number] {
    const rc = this.ediabas.hasResult(name, set);
    return [rc, this.ediabas.resultInt(name, set)];
  }

  resultSets(): [boolean, number] {
    const count = this.ediabas.resultSets();
    return [count > 0, count];
  }

  resultReal(name: string, set: number): [boolean, number] {
    const rc = this.ediabas.hasResult(name, set);
    return [rc, this.ediabas.resultAnalog(name, set)];
  }

  resultBinary(name: string, set: number): [boolean, Uint8Array] {
    const rc = this.ediabas.hasResult(name, set);
    return [rc, this.ediabas.resultBinary(name, set)];
  }

  // === Error State ===

  errorCode(): number {
    return this.lastErrorCode;
  }

  errorText(): string {
    return this.lastErrorText;
  }
}
