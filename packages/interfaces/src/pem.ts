/**
 * PEM Provider
 * BMW Protocol/Label Print system
 */

export interface IPemProvider {
  /** Initialize PEM system */
  initialisiere(): boolean;
  
  /** Write protocol header */
  protokollKopf(): boolean;
  
  /** Write protocol line */
  protokollZeile(): boolean;
  
  /** Write SGZ header line */
  sgzKopfzeile(): boolean;
  
  /** Write separator line */
  trennLinie(): boolean;
  
  /** Write end line */
  endLinie(): boolean;
  
  /** Clear tab line buffer */
  loescheTabZeilenPuffer(): boolean;
  
  /** Transfer tab line buffer */
  uebertrageTabZeilenPuffer(): boolean;
  
  /** Output protocol */
  protokollAusgabe(): boolean;
  
  /** Print label */
  druckeEtikett(): boolean;
  
  /** Print form */
  printFormular(): boolean;
  
  /** Printer form feed */
  printerFf(): boolean;
  
  /** Free PEM memory */
  freeMem(): boolean;
  
  /** Load form template */
  loadFormular(): boolean;
  
  /** Set default print field */
  defaultDruckfeld(): boolean;
  
  /** Populate defaults */
  defaultBesetzen(): boolean;
  
  /** Unload form template */
  forgetFormular(): boolean;
  
  /** Write to print field */
  writeDruckfeld(): boolean;
}
