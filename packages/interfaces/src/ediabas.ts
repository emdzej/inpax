/**
 * EDIABAS API Provider
 * Main diagnostic communication interface
 */

import { EventEmitter } from 'eventemitter3';
import type { EdiabasEvents } from './events.js';

export interface IEdiabasProvider extends EventEmitter<EdiabasEvents> {
  // === Lifecycle ===
  
  /**
   * Initialize EDIABAS connection
   */
  init(): Promise<void>;
  
  /**
   * Close EDIABAS connection
   */
  end(): Promise<void>;

  // === Job Execution ===
  
  /**
   * Execute diagnostic job
   * @param ecu ECU/SGBD name (e.g., "D_MOTOR")
   * @param job Job name (e.g., "IDENT")
   * @param arg1 First argument
   * @param arg2 Second argument
   */
  job(ecu: string, job: string, arg1: string, arg2: string): Promise<void>;

  // === Results ===
  
  /**
   * Get number of result sets from last job
   */
  resultSets(): number;
  
  /**
   * Get text result
   * @param result Result name
   * @param set Result set index (1-based)
   * @param format Format string
   */
  resultText(result: string, set: number, format: string): string;
  
  /**
   * Get integer result
   */
  resultInt(result: string, set: number): number;
  
  /**
   * Get boolean result
   */
  resultDigital(result: string, set: number): boolean;
  
  /**
   * Get floating point result
   */
  resultAnalog(result: string, set: number): number;
  
  /**
   * Get binary result
   */
  resultBinary(result: string, set: number): Uint8Array;
  
  /**
   * Check job status
   * @param refStr Reference string to check
   */
  checkJobStatus(refStr: string): boolean;

  // === Fault Storage ===
  
  /**
   * Read fault storage
   */
  fsLesen(ecu: string, fileName: string): Promise<void>;
  
  /**
   * Read fault storage (variant 2)
   */
  fsLesen2(ecu: string, fileName: string): Promise<void>;
  
  /**
   * Set fault storage mode
   * @param mode Mode flags
   * @param fileMode File mode string
   * @param preInfoFile Pre-info filename
   * @param postInfoFile Post-info filename
   * @param jobName Job name for FS operations
   */
  fsMode(
    mode: number,
    fileMode: string,
    preInfoFile: string,
    postInfoFile: string,
    jobName: string
  ): void;
}
