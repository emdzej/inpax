/**
 * EdiabasX provider for the INPA interpreter.
 *
 * Binds the 13 `INPAapi*` system functions defined in
 * `@emdzej/inpax-interfaces` to a real `@emdzej/ediabasx-ediabas`
 * runtime. The dispatcher routes opcodes 0x60–0x6C here; this class is
 * what the INPA bytecode actually hits when it asks the ECU a question.
 */

import { EventEmitter } from 'eventemitter3';
import { Ediabas } from '@emdzej/ediabasx-ediabas';
import type {
  EdiabasConfig,
  EdiabasJobResult,
} from '@emdzej/ediabasx-ediabas';
import { formatSingle } from '@emdzej/inpax-core';
import type { IEdiabasProvider, EdiabasEvents } from '@emdzej/inpax-interfaces';

export interface EdiabasXProviderConfig {
  /**
   * Pre-built `Ediabas` instance to wrap directly. Browser hosts
   * build this themselves (file picked via `FileSystemDirectoryHandle`,
   * transport via Web Serial); Node hosts can use the convenience
   * `createNodeProvider` helper in `/node` instead, which still
   * accepts a path to an `ediabas.config.json`.
   *
   * Mutually exclusive with `config`.
   */
  instance?: Ediabas;
  /**
   * Direct EdiabasX configuration. Mutually exclusive with
   * `instance`. Falls back to in-memory simulation if neither is
   * supplied (mainly useful for unit tests).
   */
  config?: EdiabasConfig;
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
  private ediabas: Ediabas | null = null;
  private readonly providerConfig: EdiabasXProviderConfig;

  /** Cached so we only re-load the SGBD when the bytecode names a new ECU. */
  private currentEcu: string | null = null;

  /** Result sets from the most recent job, in emission order. */
  private lastResults: JobResultSet[] = [];

  /**
   * Metadata / system result snapshot from `ediabas.getSystemResults()` —
   * populated at SGBD load time (VARIANTE from the basename, plus the
   * INFO job's ECU / ORIGIN / REVISION / AUTHOR / COMMENT / PACKAGE /
   * SPRACHE) and refreshed on every executeJob (JOB_STATUS). Used as
   * a by-name fallback when the per-set lookup misses — matches what
   * native EDIABAS exposes to scripts that read SGBD metadata without
   * knowing which set holds it.
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

  constructor(config: EdiabasXProviderConfig = {}) {
    super();
    this.providerConfig = config;
  }

  // === Lifecycle ===

  async init(): Promise<void> {
    try {
      if (this.providerConfig.instance) {
        this.ediabas = this.providerConfig.instance;
      } else if (this.providerConfig.config) {
        this.ediabas = new Ediabas(this.providerConfig.config);
      } else {
        // No config supplied — fall back to an empty simulation. The
        // ecuPath default used to be `process.cwd()`, which broke
        // browser bundles; an empty string is safe in both runtimes
        // and the simulation interface doesn't actually touch disk
        // unless the host supplies sim data.
        this.ediabas = new Ediabas({
          ecuPath: '',
          simulation: true,
        });
      }

      if (this.providerConfig.autoConnect !== false) {
        try {
          await this.ediabas.connect();
          this.emit('connection:restored');
        } catch (err) {
          // Some scripts run only metadata-style jobs and never need
          // the link. Don't fatal-error here; surface on `job:error`
          // when a job actually fails.
          const message = err instanceof Error ? err.message : String(err);
          this.emit('job:error', { code: -1, message: `connect failed: ${message}` });
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.emit('job:error', { code: -1, message: `Init failed: ${message}` });
      throw err;
    }
  }

  async end(): Promise<void> {
    if (this.ediabas) {
      try {
        await this.ediabas.disconnect();
      } catch {
        /* ignore — we're tearing down anyway */
      }
      this.ediabas = null;
    }
    this.currentEcu = null;
    this.lastResults = [];
    this.lastJobStatus = '';
    this.emit('connection:lost');
  }

  // === Job Execution ===

  async job(ecu: string, jobName: string, arg1: string, arg2: string): Promise<void> {
    if (!this.ediabas) {
      this.emit('job:error', { code: -1, message: 'Not initialized — call init() first' });
      return;
    }

    try {
      // Load the SGBD on the first hit and whenever the script switches
      // ECUs. INPA scripts often hit multiple ECUs in sequence
      // (e.g. DME → EGS → CAS); only the first call per ECU pays the
      // file-load cost.
      if (this.currentEcu !== ecu) {
        await this.ediabas.loadSgbd(this.resolveSgbdFile(ecu));
        this.currentEcu = ecu;
      }

      // INPA passes empty strings when an arg is unused. Pass through
      // as positional params — EdiabasX `executeJob` accepts an array
      // and the BEST2 `par*` opcodes read from it by index.
      const params = [arg1, arg2].filter((p) => p !== undefined);

      const sets = await this.ediabas.executeJob(jobName, { params });

      // EdiabasX returns one entry per emitted `enewset` group. INPA
      // exposes them through `resultSets()` (1-based count) and the
      // `set` argument on every `result*()` lookup. Keep the order
      // and build a name-indexed map per set for O(1) reads.
      this.lastResults = sets.map((set) => ({
        results: new Map(set.map((r) => [r.name.toUpperCase(), r])),
      }));

      // Snapshot the system result set (VARIANTE + INFO job outputs +
      // most recent JOB_STATUS) so by-name lookups that miss the per-
      // job sets transparently fall through to SGBD metadata. The map
      // is re-keyed by uppercase name for case-insensitive lookups.
      this.systemResults = new Map(
        Array.from(this.ediabas.getSystemResults(), ([name, value]) => [
          name.toUpperCase(),
          value,
        ])
      );

      // Capture JOB_STATUS for `checkJobStatus()`. EDIABAS emits it
      // somewhere in the result stream — usually set 1 — but a few
      // jobs put it on the trailing set. Scan in reverse so the
      // most-recent emission wins (mirrors how the BEST2 `_resultDict`
      // behaves before `enewset` commits).
      this.lastJobStatus = '';
      for (let i = this.lastResults.length - 1; i >= 0; i--) {
        const status = this.lastResults[i].results.get(SYSTEM_JOB_STATUS);
        if (status !== undefined) {
          this.lastJobStatus = this.coerceText(status.value);
          break;
        }
      }

      this.emit('job:complete', {
        ecu,
        job: jobName,
        sets: this.lastResults.length,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.emit('job:error', { code: -1, message });
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

  // === Helpers ===

  /**
   * BMW SGBDs are stored as `.prg` (compiled per-ECU bytecode) or
   * `.grp` (group definitions that delegate to ECU-specific PRGs).
   * Pass the raw name through if the caller already supplied an
   * extension; otherwise default to `.prg` (the common case for
   * INPA scripts that name an ECU directly).
   */
  private resolveSgbdFile(ecu: string): string {
    if (ecu.toLowerCase().endsWith('.prg') || ecu.toLowerCase().endsWith('.grp')) {
      return ecu;
    }
    return `${ecu}.prg`;
  }

  private getResult(name: string, set: number): EdiabasJobResult | undefined {
    // INPA uses 1-based set indexing throughout. Convert before
    // touching the array.
    const key = name.toUpperCase();
    const setIndex = set - 1;
    if (setIndex >= 0 && setIndex < this.lastResults.length) {
      const hit = this.lastResults[setIndex].results.get(key);
      if (hit !== undefined) return hit;
    }
    // Transparent metadata fallback. Scripts read VARIANTE / ECU /
    // REVISION / etc. by name without caring which set holds them —
    // and `set=0` lookups (the native EDIABAS system-result idiom)
    // bypass the per-set range entirely and land here.
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
   * Get the underlying Ediabas instance — escape hatch for callers
   * that want to drive it directly (e.g. running a job not exposed
   * through the INPAapi surface).
   */
  getEdiabas(): Ediabas | null {
    return this.ediabas;
  }
}
