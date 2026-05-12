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

  /**
   * Write a file the host will later expose to `viewOpen` (and to any
   * other tooling that needs to read it back). Hosts that don't have a
   * real filesystem keep an in-memory map keyed by name; node hosts
   * write to disk via `fs/promises`.
   *
   * Used by the dispatcher's `INPAapiFsLesen` / `INPAapiFsLesen2`
   * handlers: original INPA formats the fault-store result sets into
   * a plain-text report and writes it to the filename the script
   * passed in. The host then opens that file via `viewopen`.
   */
  writeFile(fileName: string, content: string): void | Promise<void>;
}
