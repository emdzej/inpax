/**
 * Null PEM Provider - no-op implementation
 */

import type { IPemProvider } from '@emdzej/inpax-interfaces';

export class NullPemProvider implements IPemProvider {
  initialisiere(): boolean { return true; }
  protokollKopf(): boolean { return true; }
  protokollZeile(): boolean { return true; }
  sgzKopfzeile(): boolean { return true; }
  trennLinie(): boolean { return true; }
  endLinie(): boolean { return true; }
  loescheTabZeilenPuffer(): boolean { return true; }
  uebertrageTabZeilenPuffer(): boolean { return true; }
  protokollAusgabe(): boolean { return true; }
  druckeEtikett(): boolean { return true; }
  printFormular(): boolean { return true; }
  printerFf(): boolean { return true; }
  freeMem(): boolean { return true; }
  loadFormular(): boolean { return true; }
  defaultDruckfeld(): boolean { return true; }
  defaultBesetzen(): boolean { return true; }
  forgetFormular(): boolean { return true; }
  writeDruckfeld(): boolean { return true; }
}
