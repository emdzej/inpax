/**
 * DTM Provider
 * Data Transfer Manager - variable and log unit management
 */

export interface IDtmProvider {
  // === Lookup ===
  
  /**
   * Find logical unit
   * @returns true if found
   */
  findLogUnit(logUnit: string): boolean;
  
  /**
   * Get SG variable by SG type
   */
  getSGVar(sgArt: string): string;
  
  /**
   * Get SG type by SG variable
   */
  getSGArt(sgVar: string): string;
  
  /**
   * Get variable value
   */
  getVarWert(varName: string): string;

  // === Setup ===
  
  /**
   * Get setup variable value
   */
  setupGetVarWert(varName: string): string;
  
  /**
   * Reset setup iteration to start
   */
  setupGetStartPosition(): void;
  
  /**
   * Get next setup association
   * @returns [found, name, value]
   */
  setupGetNextAssoc(): [boolean, string, string];

  // === Registration ===
  
  /**
   * Register logical unit
   */
  logUnitEintragen(logUnit: string): void;
  
  /**
   * Register SG entry
   */
  sgEintragen(sgArt: string, sgVar: string): void;
  
  /**
   * Clear order/task
   */
  loescheAuftrag(): void;

  // === Variables ===
  
  /**
   * Register variable
   */
  variableEintragen(name: string, value: string): void;
  
  /**
   * Delete variable
   * @returns true if deleted
   */
  variableLoeschen(name: string): boolean;
  
  /**
   * Delete all variables
   */
  loescheAlleVariablen(): void;
  
  /**
   * Register setup variable
   */
  setupVariableEintragen(name: string, value: string): void;
  
  /**
   * Delete setup variable
   * @returns true if deleted
   */
  setupVariableLoeschen(name: string): boolean;
}
