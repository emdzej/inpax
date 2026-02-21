/**
 * EdiabasX Provider for INPA interpreter
 * 
 * Uses @ediabasx/ediabas for real ECU communication
 */

import { EventEmitter } from 'eventemitter3';
import type { IEdiabasProvider, EdiabasEvents } from '@inpax/interfaces';

// Type definitions for @ediabasx/ediabas
// These match the actual API from the package
interface EdiabasConfig {
  ecuPath: string;
  simulation?: boolean;
  timeout?: number;
  logging?: boolean;
}

interface EdiabasJobResult {
  name: string;
  type: string;
  value: string | number | boolean | Uint8Array | null;
  unit?: string;
  comment?: string;
}

interface Ediabas {
  loadSgbd(filename: string): Promise<void>;
  executeJob(jobName: string, options?: { params?: string[]; timeout?: number }): Promise<EdiabasJobResult[]>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}

// Dynamic import type
type EdiabasModule = {
  Ediabas: new (config: EdiabasConfig) => Ediabas;
  createFromConfigFile: (path: string) => Promise<Ediabas>;
};

export interface EdiabasXProviderConfig {
  /** Path to ediabas.config.json */
  configFile?: string;
  /** Direct Ediabas configuration (if no configFile) */
  config?: EdiabasConfig;
  /** Auto-connect on init */
  autoConnect?: boolean;
}

interface JobResultSet {
  results: Map<string, EdiabasJobResult>;
}

export class EdiabasXProvider extends EventEmitter<EdiabasEvents> implements IEdiabasProvider {
  private ediabas: Ediabas | null = null;
  private readonly providerConfig: EdiabasXProviderConfig;
  
  /** Current loaded ECU */
  private currentEcu: string | null = null;
  
  /** Results from last job execution */
  private lastResults: JobResultSet[] = [];
  
  /** FS mode configuration */
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
    // Dynamic import to handle missing dependency gracefully
    let edModule: EdiabasModule;
    try {
      // @ts-expect-error - @ediabasx/ediabas is an optional runtime dependency
      edModule = await import('@ediabasx/ediabas') as EdiabasModule;
    } catch {
      throw new Error(
        'EdiabasX provider requires @ediabasx/ediabas package. ' +
        'Install it with: npm install @ediabasx/ediabas'
      );
    }

    try {
      if (this.providerConfig.configFile) {
        this.ediabas = await edModule.createFromConfigFile(this.providerConfig.configFile);
      } else if (this.providerConfig.config) {
        this.ediabas = new edModule.Ediabas(this.providerConfig.config);
      } else {
        // Default: simulation mode
        this.ediabas = new edModule.Ediabas({
          ecuPath: process.cwd(),
          simulation: true,
        });
      }

      if (this.providerConfig.autoConnect !== false && !this.ediabas.isConnected()) {
        try {
          await this.ediabas.connect();
          this.emit('connection:restored');
        } catch {
          // Connection may not be required for all operations
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
      await this.ediabas.disconnect();
      this.ediabas = null;
    }
    this.currentEcu = null;
    this.lastResults = [];
    this.emit('connection:lost');
  }

  // === Job Execution ===

  async job(ecu: string, jobName: string, arg1: string, arg2: string): Promise<void> {
    if (!this.ediabas) {
      this.emit('job:error', { code: -1, message: 'Not initialized' });
      return;
    }

    try {
      // Load ECU if changed
      if (this.currentEcu !== ecu) {
        const sgbdFile = ecu.endsWith('.prg') ? ecu : `${ecu}.prg`;
        await this.ediabas.loadSgbd(sgbdFile);
        this.currentEcu = ecu;
      }

      // Build params array
      const params: string[] = [];
      if (arg1) params.push(arg1);
      if (arg2) params.push(arg2);

      // Execute job
      const results = await this.ediabas.executeJob(jobName, { params });

      // Store results (single set for now)
      this.lastResults = [{
        results: new Map(results.map(r => [r.name.toUpperCase(), r])),
      }];

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

  resultSets(): number {
    return this.lastResults.length;
  }

  resultText(name: string, set: number, _format: string): string {
    const result = this.getResult(name, set);
    if (!result) return '';
    
    const value = result.value;
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (value instanceof Uint8Array) return new TextDecoder().decode(value);
    return String(value ?? '');
  }

  resultInt(name: string, set: number): number {
    const result = this.getResult(name, set);
    if (!result) return 0;
    
    const value = result.value;
    if (typeof value === 'number') return Math.floor(value);
    if (typeof value === 'string') return parseInt(value, 10) || 0;
    return 0;
  }

  resultAnalog(name: string, set: number): number {
    const result = this.getResult(name, set);
    if (!result) return 0;
    
    const value = result.value;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return parseFloat(value) || 0;
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
    if (typeof value === 'string') return value.toLowerCase() === 'true' || value === '1';
    return false;
  }

  checkJobStatus(_ref: string): boolean {
    // Jobs complete synchronously in this implementation
    return true;
  }

  // === Fault Storage ===

  async fsLesen(ecu: string, fileName: string): Promise<void> {
    await this.job(ecu, this.fsModeConfig.jobName, fileName, '');
  }

  async fsLesen2(ecu: string, fileName: string): Promise<void> {
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

  private getResult(name: string, set: number): EdiabasJobResult | undefined {
    const setIndex = set - 1; // 1-based to 0-based
    if (setIndex < 0 || setIndex >= this.lastResults.length) {
      return undefined;
    }
    return this.lastResults[setIndex].results.get(name.toUpperCase());
  }

  /**
   * Get underlying Ediabas instance for advanced usage
   */
  getEdiabas(): Ediabas | null {
    return this.ediabas;
  }
}
