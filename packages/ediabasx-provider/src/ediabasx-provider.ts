/**
 * EdiabasX provider for the INPA interpreter.
 *
 * Binds the 13 `INPAapi*` system functions defined in
 * `@emdzej/inpax-interfaces` to any `IEdiabas` implementation
 * (`EmbeddedEdiabas` for local cable / simulation, `EdiabasClient`
 * for remote server). The dispatcher routes opcodes 0x60–0x6C here;
 * this class is what the INPA bytecode actually hits when it asks
 * the ECU a question.
 *
 * The caller owns IEdiabas construction — picks the concrete
 * implementation (`EmbeddedEdiabas` / `EdiabasClient`), wires the
 * interface / transport / loadSgbdResolver / server URL, and hands
 * the result here as `instance`. Provider stays purely about
 * adapting `IEdiabas` to the INPA result/status surface.
 */

import { EventEmitter } from 'eventemitter3';
import type {
  IEdiabas,
  EdiabasJobResponse,
  EdiabasResultEntry,
  EdiabasResultSet,
} from '@emdzej/ediabasx-core';
import type { EdiabasJobResult } from '@emdzej/ediabasx-ediabas';
import { formatSingle } from '@emdzej/inpax-core';
import type { IEdiabasProvider, EdiabasEvents } from '@emdzej/inpax-interfaces';

export interface EdiabasXProviderConfig {
  /**
   * Pre-built `IEdiabas` implementation — caller picks
   * `EmbeddedEdiabas` (local cable / Web Serial / J2534 / Gateway /
   * simulation) or `EdiabasClient` (remote JSON-RPC server, direct
   * WebSocket or Bimmerz Connect relay) and builds it before
   * handing it here.
   *
   * Mutually exclusive with `getInstance`. Both modes converge on
   * the same surface: `init`/`end`/`job(ecu, name, params?)`.
   * Provider doesn't care which.
   */
  instance?: IEdiabas;
  /**
   * Lazy factory invoked at `init()` time. Use this when the
   * IEdiabas isn't ready at provider-construction (e.g., inpax's
   * deferred-Connect flow: the IPO mounts and the provider is built
   * BEFORE the user clicks Connect; the script's `INPAapiInit`
   * triggers `ui.ensureConnected()`, the user picks a cable /
   * server, and only THEN can the IEdiabas be built). Return
   * `null` if no IEdiabas is ready yet — the provider's subsequent
   * `connect failed` event surfaces it cleanly.
   *
   * Mutually exclusive with `instance`.
   */
  getInstance?: () => IEdiabas | null;
  /**
   * Establish the comm link during `init()`. Set false if the
   * caller wants to defer connection until the first job runs.
   * Defaults to true.
   */
  autoConnect?: boolean;
}

/**
 * One emitted result set from the underlying VM, indexed by name for
 * O(1) lookup by `INPAapiResult*` calls. Names are upper-cased to
 * match BMW INPA's case-insensitive lookup convention.
 */
interface JobResultSet {
  results: Map<string, EdiabasJobResult>;
}

const SYSTEM_JOB_STATUS = 'JOB_STATUS';

export class EdiabasXProvider
  extends EventEmitter<EdiabasEvents>
  implements IEdiabasProvider
{
  private ediabas: IEdiabas | null = null;
  private readonly providerConfig: EdiabasXProviderConfig;

  /**
   * Result sets from the most recent job (DATA sets only, not the
   * system set at index 0 — see `job()` for the slice). INPA's
   * `result*(name, set)` accessors are 1-based on data sets, so
   * `lastResults[0]` corresponds to INPA `set=1`.
   */
  private lastResults: JobResultSet[] = [];

  /**
   * Metadata / system result snapshot from the most recent job's
   * `sets[0]` (the system set built fresh per job by
   * `Ediabas.buildSystemSet` — mirrors C# `CreateSystemResultDict`).
   * Carries VARIANTE / OBJECT / JOBNAME / SAETZE / GRUPPE / FAMILIE
   * plus the persistent metadata accumulator (ECU / ORIGIN /
   * REVISION / AUTHOR / COMMENT / PACKAGE / SPRACHE / JOB_STATUS …).
   * Used as a by-name fallback when per-set lookup misses, and the
   * target of the INPA `set=0` "transparent metadata" idiom.
   */
  private systemResults: Map<string, EdiabasJobResult> = new Map();

  /**
   * `JOB_STATUS` from the most recent job, captured for
   * `INPAapiCheckJobStatus()`. EDIABAS always emits this as a system
   * result; see the BEST2 interpreter's `eoj` handler.
   */
  private lastJobStatus: string = '';

  /** Configuration for the BMW INPA fault-storage convention. */
  private fsModeConfig = {
    mode: 0,
    fileMode: '',
    preInfoFile: '',
    postInfoFile: '',
    jobName: 'FS_LESEN',
  };

  /**
   * In-flight async-call counter. Bumped on entry to every public
   * async method (init/end/job/fsLesen/fsLesen2) and decremented in
   * the matching finally. The counter, rather than a boolean, lets
   * overlapping calls (e.g. a script that fires two jobs before the
   * first one resolves) coalesce naturally: the indicator stays on
   * until the *last* outstanding call settles.
   */
  private inFlight = 0;

  constructor(config: EdiabasXProviderConfig) {
    super();
    this.providerConfig = config;
  }

  /**
   * Snapshot of the in-flight busy state. Useful for hosts that mount
   * an indicator after some calls have already started.
   */
  isBusy(): boolean {
    return this.inFlight > 0;
  }

  private beginBusy(): void {
    this.inFlight++;
    this.emit('busy:changed', { busy: true, inFlight: this.inFlight });
  }

  private endBusy(): void {
    if (this.inFlight > 0) this.inFlight--;
    this.emit('busy:changed', {
      busy: this.inFlight > 0,
      inFlight: this.inFlight,
    });
  }

  // === Lifecycle ===

  async init(): Promise<void> {
    this.beginBusy();
    try {
      /* Caller-built IEdiabas — could be EmbeddedEdiabas (with its
         own interface/transport baked in at construction time) or
         EdiabasClient (with server URL + transport choice).
         Either way: just bind and init.

         When the caller supplied a `getInstance` factory instead of
         a direct `instance`, resolve it now — this is inpax's
         deferred-Connect path where the IEdiabas isn't ready until
         `ui.ensureConnected()` has run. */
      const resolved =
        this.providerConfig.instance ?? this.providerConfig.getInstance?.() ?? null;
      if (!resolved) {
        throw new Error(
          'No IEdiabas available — provider was given neither `instance` nor a `getInstance` factory returning a non-null value',
        );
      }
      this.ediabas = resolved;

      if (this.providerConfig.autoConnect !== false) {
        try {
          await this.ediabas.init();
          this.emit('connection:restored');
        } catch (err) {
          /* Some scripts run only metadata-style jobs and never need
             the link. Don't fatal-error here; surface on `job:error`
             when a job actually fails. */
          const message = err instanceof Error ? err.message : String(err);
          this.emit('job:error', { code: -1, message: `connect failed: ${message}` });
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.emit('job:error', { code: -1, message: `Init failed: ${message}` });
      throw err;
    } finally {
      this.endBusy();
    }
  }

  /**
   * Detach from the underlying IEdiabas. **Does NOT call `end()` on
   * the IEdiabas itself** — the IEdiabas is owned by the caller
   * (typically inpax's `connection.svelte.ts`, which manages its
   * lifecycle independently of per-IPO runtime mounts). If we
   * tore it down here, switching IPOs would close the shared
   * connection (and for `EdiabasClient` over a relay socket, that
   * means closing the WebSocket — fatal for the next IPO mount).
   *
   * Callers that want to explicitly disconnect the IEdiabas should
   * do so directly (e.g. `connection.disconnect()` in inpax-web).
   */
  async end(): Promise<void> {
    this.beginBusy();
    try {
      this.ediabas = null;
      this.lastResults = [];
      this.lastJobStatus = '';
      this.emit('connection:lost');
    } finally {
      this.endBusy();
    }
  }

  // === Job Execution ===

  async job(ecu: string, jobName: string, arg1: string, arg2: string): Promise<void> {
    if (!this.ediabas) {
      this.emit('job:error', { code: -1, message: 'Not initialized — call init() first' });
      return;
    }
    void arg2; /* INPA's RESULTS filter — not yet supported in IEdiabas.job */

    this.beginBusy();
    try {
      /* INPA's `apiJob(ECU, JOB, PARAMS, RESULTS)` follows BMW EDIABAS
         convention: PARAMS is a single semicolon-delimited string that
         EDIABAS splits into individual `par(0)`, `par(1)`, … `par(N)`
         slots before the BEST2 program runs. `IEdiabas.job(ecu, job,
         params)` takes that exact string — so we pass `arg1` straight
         through, no split needed (no semicolons → empty becomes
         `undefined` so no `par()` slots are set, matching the
         no-params case). `RESULTS` is a result-name filter; the
         IEdiabas surface doesn't yet expose it, so we drop it.

         The IEdiabas implementation (EmbeddedEdiabas / EdiabasClient)
         handles SGBD load + INITIALISIERUNG + IDENT + variant swap
         internally. We don't need a parallel currentEcu cache —
         EmbeddedEdiabas tracks `loadedSgbdPath` itself; EdiabasClient
         delegates to the server's persistent Ediabas. */
      const params = arg1 === '' ? undefined : arg1;

      const response = await this.ediabas.job(ecu, jobName, params);

      /* The IEdiabas response shape is `{ sets: EdiabasResultSet[] }`
         where `sets[0]` is the system set (VARIANTE/OBJECT/JOBNAME/
         SAETZE/GRUPPE/FAMILIE + persistent metadata) and `sets[1..N]`
         are the bytecode-emitted data sets. INPA's 1-based-on-data-
         sets convention maps cleanly onto `sets[1..N]` — slice off
         sets[0] for the system-set fallback map. Mirrors native
         EDIABAS `apiResultText(name, 0, …)` reading the system set
         and `apiResultText(name, 1..N, …)` reading data sets. */
      const allSets = response.sets;
      const systemSet = allSets[0];
      const dataSets = allSets.slice(1);

      this.lastResults = dataSets.map((set) => ({
        results: new Map(
          Object.values(set).map((entry: EdiabasResultEntry) => [
            entry.name.toUpperCase(),
            convertEntry(entry),
          ]),
        ),
      }));

      /* System set (sets[0]) keyed by uppercase for case-insensitive
         lookups. Already includes JOB_STATUS via the persistent
         accumulator merge in `Ediabas.buildSystemSet`, so the
         reverse-scan over `lastResults` that the pre-IEdiabas
         provider did is no longer needed — pull JOB_STATUS straight
         from systemResults. */
      this.systemResults = new Map(
        systemSet
          ? Object.values(systemSet).map((entry: EdiabasResultEntry) => [
              entry.name.toUpperCase(),
              convertEntry(entry),
            ])
          : [],
      );

      const status = this.systemResults.get(SYSTEM_JOB_STATUS);
      this.lastJobStatus = status ? this.coerceText(status.value) : '';

      this.emit('job:complete', {
        ecu,
        job: jobName,
        sets: this.lastResults.length,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.emit('job:error', { code: -1, message });
    } finally {
      this.endBusy();
    }
  }

  // === Results ===

  /**
   * Whether a named result exists in the given set. Drives INP1's `rc`
   * return flag without forcing callers to peek at private internals.
   */
  hasResult(name: string, set: number): boolean {
    return this.getResult(name, set) !== undefined;
  }

  resultSets(): number {
    return this.lastResults.length;
  }

  /**
   * Return an iterable of `[name, EdiabasJobResult]` for every field
   * in the given 1-based result set, or `null` if the index is out of
   * range. Hosts get the raw value (with type) so they can render
   * Uint8Array fields as hex, numbers with their original precision,
   * etc. — needed for fault-store reports where the `value` of fields
   * like `F_HEX_CODE` is binary, not text, and `coerceText`'s UTF-8
   * fallback would produce mojibake.
   */
  resultSetEntries(set: number): Iterable<[string, EdiabasJobResult]> | null {
    const setIndex = set - 1;
    if (setIndex < 0 || setIndex >= this.lastResults.length) return null;
    return this.lastResults[setIndex].results.entries();
  }

  resultText(name: string, set: number, format: string): string {
    const result = this.getResult(name, set);
    if (!result) return '';

    const value = result.value;
    // Honour `format` when the underlying value is numeric. INPA
    // uses C-style `%d`, `%i`, `%u`, `%x`, `%X`, `%o`, `%e`, `%f`,
    // `%g` and `%s`. Anything else falls through to plain
    // coercion — matches the original INPA behaviour of "if I don't
    // understand the format, stringify what I have".
    if (typeof value === 'number' && format) {
      return formatSingle(value, format);
    }
    return this.coerceText(value);
  }

  resultInt(name: string, set: number): number {
    const result = this.getResult(name, set);
    if (!result) return 0;

    const value = result.value;
    if (typeof value === 'number') {
      // C-style `(int)x` semantics: truncate toward zero, not floor.
      return value >= 0 ? Math.floor(value) : Math.ceil(value);
    }
    if (typeof value === 'string') {
      const parsed = parseInt(value, 10);
      return Number.isNaN(parsed) ? 0 : parsed;
    }
    if (typeof value === 'boolean') return value ? 1 : 0;
    return 0;
  }

  resultAnalog(name: string, set: number): number {
    const result = this.getResult(name, set);
    if (!result) return 0;

    const value = result.value;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return Number.isNaN(parsed) ? 0 : parsed;
    }
    if (typeof value === 'boolean') return value ? 1 : 0;
    return 0;
  }

  resultBinary(name: string, set: number): Uint8Array {
    const result = this.getResult(name, set);
    if (!result) return new Uint8Array();

    const value = result.value;
    if (value instanceof Uint8Array) return value;
    if (typeof value === 'string') return new TextEncoder().encode(value);
    return new Uint8Array();
  }

  resultDigital(name: string, set: number): boolean {
    const result = this.getResult(name, set);
    if (!result) return false;

    const value = result.value;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const t = value.trim().toLowerCase();
      return t === 'true' || t === '1' || t === 'okay' || t === 'ja' || t === 'yes';
    }
    return false;
  }

  checkJobStatus(ref: string): boolean {
    // BMW INPA convention: returns true when the last job's
    // JOB_STATUS system result matches `ref` exactly. Most scripts
    // check against `"OKAY"` to gate further work.
    return this.lastJobStatus === ref;
  }

  // === Fault Storage ===

  async fsLesen(ecu: string, fileName: string): Promise<void> {
    // INPA's contract: run the configured fault-storage job (default
    // `FS_LESEN`) and surface the result via the standard
    // `result*()` API; `fileName` is a hint INPA scripts use for
    // their own bookkeeping, not something EDIABAS itself writes to.
    // Pass it through as `arg1` so any SGBD that consumes the
    // filename receives it.
    await this.job(ecu, this.fsModeConfig.jobName, fileName, '');
    this.emit('fs:complete', {
      ecu,
      fileName,
      faultCount: this.lastResults.length,
    });
  }

  async fsLesen2(ecu: string, fileName: string): Promise<void> {
    // INPA's FS_LESEN2 differs from FS_LESEN only in the job name
    // some SGBDs prefer; the configurable `fsModeConfig.jobName`
    // covers both. Delegate.
    await this.fsLesen(ecu, fileName);
  }

  fsMode(
    mode: number,
    fileMode: string,
    preInfoFile: string,
    postInfoFile: string,
    jobName: string
  ): void {
    this.fsModeConfig = {
      mode,
      fileMode,
      preInfoFile,
      postInfoFile,
      jobName: jobName || 'FS_LESEN',
    };
  }

  getFsModeConfig(): {
    mode: number;
    fileMode: string;
    preInfoFile: string;
    postInfoFile: string;
    jobName: string;
  } {
    return { ...this.fsModeConfig };
  }

  // === Helpers ===

  private getResult(name: string, set: number): EdiabasJobResult | undefined {
    /* INPA uses 1-based set indexing on DATA sets — `set=1` is the
       first data set, which is `lastResults[0]` after the `sets[0]`
       slice. `set=0` is the native EDIABAS system-result idiom;
       falls through to the systemResults map. */
    const key = name.toUpperCase();
    const setIndex = set - 1;
    if (setIndex >= 0 && setIndex < this.lastResults.length) {
      const hit = this.lastResults[setIndex].results.get(key);
      if (hit !== undefined) return hit;
    }
    /* Transparent metadata fallback. Scripts read VARIANTE / ECU /
       REVISION / etc. by name without caring which set holds them. */
    return this.systemResults.get(key);
  }

  private coerceText(value: EdiabasJobResult['value']): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (value instanceof Uint8Array) return new TextDecoder().decode(value);
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    return value === null || value === undefined ? '' : String(value);
  }

  /**
   * Get the underlying IEdiabas instance — escape hatch for callers
   * that want to drive it directly (e.g. running a job not exposed
   * through the INPAapi surface).
   */
  getEdiabas(): IEdiabas | null {
    return this.ediabas;
  }
}

/* ── EdiabasResultEntry (wire) → EdiabasJobResult (local) ────────── */

/**
 * Convert an IEdiabas-wire `EdiabasResultEntry` (where binary values
 * arrive as `number[]` and types use the wire vocabulary) to the
 * `EdiabasJobResult` shape the rest of the INPA stack expects
 * (`Uint8Array` for binary, interpreter-native type names). Same
 * conversion ediabasx-web's runtime.svelte.ts does.
 */
function convertEntry(entry: EdiabasResultEntry): EdiabasJobResult {
  return {
    name: entry.name,
    type: wireTypeToLocal(entry.type),
    value: Array.isArray(entry.value) ? new Uint8Array(entry.value) : entry.value,
    unit: entry.unit,
    comment: entry.comment,
  };
}

function wireTypeToLocal(wireType: EdiabasResultEntry['type']): EdiabasJobResult['type'] {
  switch (wireType) {
    case 'integer': return 'int';
    case 'text': return 'string';
    default: return wireType as EdiabasJobResult['type'];
  }
}
