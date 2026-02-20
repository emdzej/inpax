/**
 * INP1 API Provider
 * Alternative EDIABAS API with explicit return codes
 */

import { EventEmitter } from 'eventemitter3';
import type { Inp1Events } from './events.js';

export interface IInp1Provider extends EventEmitter<Inp1Events> {
  /**
   * Initialize INP1 connection
   * @returns true on success
   */
  init(): Promise<boolean>;
  
  /**
   * Close INP1 connection
   */
  end(): void;
  
  /**
   * Execute job (non-blocking)
   */
  job(ecu: string, job: string, arg1: string, arg2: string): void;
  
  /**
   * Get job state
   * @returns 0=idle, 1=running, 2=complete, 3=error
   */
  state(): number;
  
  /**
   * Get text result with success flag
   * @returns [success, value]
   */
  resultText(result: string, set: number, format: string): [boolean, string];
  
  /**
   * Get integer result with success flag
   */
  resultInt(result: string, set: number): [boolean, number];
  
  /**
   * Get result set count with success flag
   */
  resultSets(): [boolean, number];
  
  /**
   * Get real (floating point) result with success flag
   */
  resultReal(result: string, set: number): [boolean, number];
  
  /**
   * Get binary result with success flag
   */
  resultBinary(result: string, set: number): [boolean, Uint8Array];
  
  /**
   * Get last error code
   */
  errorCode(): number;
  
  /**
   * Get last error text
   */
  errorText(): string;
}
