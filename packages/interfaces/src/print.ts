/**
 * Print Provider
 * Screen and file printing
 */

export interface IPrintProvider {
  /**
   * Print current screen to default printer
   */
  printScreen(): void;
  
  /**
   * Print file to specified printer
   * @param fileName File to print
   * @param printerName Printer name
   * @param printerPort Printer port
   * @param errorMsgFlag Show error messages
   * @returns 0 on success, error code otherwise
   */
  printFile(
    fileName: string,
    printerName: string,
    printerPort: string,
    errorMsgFlag: boolean
  ): number;
}
