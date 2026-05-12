/**
 * Null External Provider - no-op implementation
 */

import type { IExternalProvider } from '@emdzej/inpax-interfaces';

export class NullExternalProvider implements IExternalProvider {
  winHelp(_helpFile: string): void {}
  winHelpKey(_helpFile: string, _key: string): void {}
  callWin(_cmdLine: string): void {}
  viewOpen(_fileName: string, _title: string): void {}
  viewClose(): void {}
  writeFile(_fileName: string, _content: string): void {}
}
