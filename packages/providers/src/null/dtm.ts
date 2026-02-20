/**
 * Null DTM Provider - no-op implementation
 */

import type { IDtmProvider } from '@inpax/interfaces';

export class NullDtmProvider implements IDtmProvider {
  findLogUnit(_logUnit: string): boolean {
    return false;
  }

  getSGVar(_sgArt: string): string {
    return '';
  }

  getSGArt(_sgVar: string): string {
    return '';
  }

  getVarWert(_varName: string): string {
    return '';
  }

  setupGetVarWert(_varName: string): string {
    return '';
  }

  setupGetStartPosition(): void {}

  setupGetNextAssoc(): [boolean, string, string] {
    return [false, '', ''];
  }

  logUnitEintragen(_logUnit: string): void {}

  sgEintragen(_sgArt: string, _sgVar: string): void {}

  loescheAuftrag(): void {}

  variableEintragen(_name: string, _value: string): void {}

  variableLoeschen(_name: string): boolean {
    return false;
  }

  loescheAlleVariablen(): void {}

  setupVariableEintragen(_name: string, _value: string): void {}

  setupVariableLoeschen(_name: string): boolean {
    return false;
  }
}
