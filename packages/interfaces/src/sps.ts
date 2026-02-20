/**
 * SPS Provider
 * PLC (Programmable Logic Controller) interface
 */

export interface ISpsProvider {
  /**
   * Initialize SPS connection
   */
  init(): void;
  
  /**
   * Close SPS connection
   */
  end(): void;
  
  /**
   * Read from SPS
   */
  leseVonSPS(...args: unknown[]): unknown;
  
  /**
   * Send to SPS
   */
  sendeAnSPS(...args: unknown[]): unknown;
  
  /**
   * Read VAK values
   */
  leseVakWerte(...args: unknown[]): unknown;
}
