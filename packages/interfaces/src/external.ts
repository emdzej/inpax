/**
 * External Provider
 * Help system and external application launching
 */

export interface IExternalProvider {
  /**
   * Open Windows help file
   */
  winHelp(helpFile: string): void;
  
  /**
   * Open Windows help at specific key
   */
  winHelpKey(helpFile: string, key: string): void;
  
  /**
   * Execute external command
   */
  callWin(cmdLine: string): void;
  
  /**
   * Open file viewer
   */
  viewOpen(fileName: string, title: string): void;
  
  /**
   * Close file viewer
   */
  viewClose(): void;
}
