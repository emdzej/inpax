/**
 * Null Print Provider - no-op implementation
 */

import type { IPrintProvider } from '@emdzej/inpax-interfaces';

export class NullPrintProvider implements IPrintProvider {
  printScreen(): void {}

  printFile(
    _fileName: string,
    _printerName: string,
    _printerPort: string,
    _errorMsgFlag: boolean
  ): number {
    return 0; // success
  }
}
