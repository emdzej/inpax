/**
 * System Function Dispatcher
 * Maps system function IDs to provider method calls
 */

import type { IInpaRuntime } from '@inpax/interfaces';

/** System function IDs */
export const SysFuncId = {
  // Menu (0x00-0x02, 0xA1)
  SETMENUTITLE: 0x00,
  SETMENU: 0x01,
  SETITEM: 0x02,
  SETITEMREPEAT: 0xa1,

  // Screen (0x03-0x04, 0x1A, 0x50-0x51)
  SETTITLE: 0x03,
  SETSCREEN: 0x04,
  SETCOLOR: 0x1a,
  CLEARRECT: 0x50,
  BLANKSCREEN: 0x51,

  // Text Output (0x48-0x4A, 0x4E-0x4F)
  TEXT: 0x48,
  TEXTOUT: 0x49,
  FTEXTOUT: 0x4a,
  HEXDUMP: 0x4e,
  FTEXTCLEAR: 0x4f,

  // Data Output (0x4B-0x4D)
  DIGITALOUT: 0x4b,
  ANALOGOUT: 0x4c,
  MULTIANALOGOUT: 0x4d,

  // Input (0x3E-0x47)
  GETINPUTSTATE: 0x3e,
  INPUTTEXT: 0x3f,
  INPUTNUM: 0x40,
  INPUTHEX: 0x41,
  INPUTDIGITAL: 0x42,
  INPUT2TEXT: 0x43,
  INPUT2HEXNUM: 0x44,
  INPUT2HEX: 0x45,
  INPUTINT: 0x46,
  INPUT2INT: 0x47,

  // Message Boxes (0x52-0x58)
  MESSAGEBOX: 0x52,
  INFOBOX: 0x53,
  USERBOXOPEN: 0x54,
  USERBOXCLOSE: 0x55,
  USERBOXFTEXTOUT: 0x56,
  USERBOXCLEAR: 0x57,
  USERBOXSETCOLOR: 0x58,

  // Simulation (0x5E-0x5F)
  SIMNUM: 0x5e,
  SIMDIGITAL: 0x5f,

  // EDIABAS (0x60-0x6C)
  INPAAPI_INIT: 0x60,
  INPAAPI_END: 0x61,
  INPAAPI_JOB: 0x62,
  INPAAPI_RESULTTEXT: 0x63,
  INPAAPI_RESULTINT: 0x64,
  INPAAPI_RESULTSETS: 0x65,
  INPAAPI_RESULTDIGITAL: 0x66,
  INPAAPI_RESULTANALOG: 0x67,
  INPAAPI_RESULTBINARY: 0x68,
  INPAAPI_CHECKJOBSTATUS: 0x69,
  INPAAPI_FSLESEN2: 0x6a,
  INPAAPI_FSLESEN: 0x6b,
  INPAAPI_FSMODE: 0x6c,

  // INP1 (0x6D-0x77)
  INP1API_INIT: 0x6d,
  INP1API_END: 0x6e,
  INP1API_JOB: 0x6f,
  INP1API_STATE: 0x70,
  INP1API_RESULTTEXT: 0x71,
  INP1API_RESULTINT: 0x72,
  INP1API_RESULTSETS: 0x73,
  INP1API_RESULTREAL: 0x74,
  INP1API_RESULTBINARY: 0x75,
  INP1API_ERRORCODE: 0x76,
  INP1API_ERRORTEXT: 0x77,

  // Print (0x17-0x18)
  PRINTSCREEN: 0x17,
  PRINTFILE: 0x18,

  // PEM (0x2B-0x3D)
  PEM_INITIALISIERE: 0x2b,
  PEM_PROTOKOLLKOPF: 0x2c,
  PEM_PROTOKOLLZEILE: 0x2d,
  PEM_SGZKOPFZEILE: 0x2e,
  PEM_TRENNLINIE: 0x2f,
  PEM_ENDLINIE: 0x30,
  PEM_LOESCHETABZEILENPUFFER: 0x31,
  PEM_UEBERTRAGETABZEILENPUFFER: 0x32,
  PEM_PROTOKOLLAUSGABE: 0x33,
  PEM_DRUCKEETIKETT: 0x34,
  PEM_PRINTFORMULAR: 0x35,
  PEM_PRINTERFF: 0x36,
  PEM_FREEMEM: 0x37,
  PEM_LOADFORMULAR: 0x38,
  PEM_DEFAULTDRUCKFELD: 0x39,
  PEM_DEFAULTBESETZEN: 0x3a,
  PEM_FORGETFORMULAR: 0x3b,
  PEM_WRITEDRUCKFELD: 0x3d,

  // DTM (0x7D-0x8B)
  DTM_FINDLOGUNIT: 0x7d,
  DTM_GETSGVAR: 0x7e,
  DTM_GETSGART: 0x7f,
  DTM_GETVARWERT: 0x80,
  DTM_SETUPGETVARWERT: 0x81,
  DTM_SETUPGETSTARTPOSITION: 0x82,
  DTM_SETUPGETNEXTASSOC: 0x83,
  DTM_LOGUNITEINTRAGEN: 0x84,
  DTM_SGEINTRAGEN: 0x85,
  DTM_LOESCHEAUFTRAG: 0x86,
  DTM_VARIABLEEINTRAGEN: 0x87,
  DTM_VARIABLELOESCHEN: 0x88,
  DTM_LOESCHEALLEVARIABLEN: 0x89,
  DTM_SETUPVARIABLEEINTRAGEN: 0x8a,
  DTM_SETUPVARIABLELOESCHEN: 0x8b,

  // External (0x59-0x5D)
  WINHELP: 0x59,
  WINHELPKEY: 0x5a,
  CALLWIN: 0x5b,
  VIEWOPEN: 0x5c,
  VIEWCLOSE: 0x5d,

  // SPS (0x92-0x96)
  SPS_INIT: 0x92,
  SPS_END: 0x93,
  SPS_LESEVONSPS: 0x94,
  SPS_SENDEANSPS: 0x95,
  SPS_LESEVAKWERTE: 0x96,
} as const;

/** Set of async function IDs */
const ASYNC_FUNCTIONS = new Set<number>([
  // Input dialogs
  SysFuncId.INPUTTEXT,
  SysFuncId.INPUTNUM,
  SysFuncId.INPUTHEX,
  SysFuncId.INPUTDIGITAL,
  SysFuncId.INPUT2TEXT,
  SysFuncId.INPUT2HEXNUM,
  SysFuncId.INPUT2HEX,
  SysFuncId.INPUTINT,
  SysFuncId.INPUT2INT,
  // Message boxes
  SysFuncId.MESSAGEBOX,
  SysFuncId.INFOBOX,
  // Simulation
  SysFuncId.SIMNUM,
  SysFuncId.SIMDIGITAL,
  // EDIABAS
  SysFuncId.INPAAPI_INIT,
  SysFuncId.INPAAPI_END,
  SysFuncId.INPAAPI_JOB,
  SysFuncId.INPAAPI_FSLESEN,
  SysFuncId.INPAAPI_FSLESEN2,
  // INP1
  SysFuncId.INP1API_INIT,
]);

/** Internal functions handled by interpreter */
const INTERNAL_FUNCTIONS = new Set<number>([
  // State Machine (0x05-0x08)
  0x05, 0x06, 0x07, 0x08,
  // Timer (0x09-0x0A)
  0x09, 0x0a,
  // Job Control (0x0B-0x16)
  0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16,
  // Time (0x1B-0x1D)
  0x1b, 0x1c, 0x1d,
  // Conversions (0x1E-0x2A)
  0x1e, 0x1f, 0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2a,
  // Binary (0x78)
  0x78,
  // File I/O (0x79-0x7C)
  0x79, 0x7a, 0x7b, 0x7c,
  // String Arrays (0x8C-0x91)
  0x8c, 0x8d, 0x8e, 0x8f, 0x90, 0x91,
  // Structures (0x9A-0x9F)
  0x9a, 0x9b, 0x9c, 0x9d, 0x9e, 0x9f,
]);

export interface ISystemFunctionDispatcher {
  /**
   * Dispatch system function call to appropriate provider
   * @param funcId System function ID (0x00-0xA1)
   * @param args Arguments from VM stack
   * @returns Result value or Promise for async operations
   */
  dispatch(funcId: number, args: unknown[]): unknown | Promise<unknown>;

  /**
   * Check if function requires await
   */
  isAsync(funcId: number): boolean;

  /**
   * Check if function is handled internally by interpreter
   */
  isInternal(funcId: number): boolean;
}

export class SystemFunctionDispatcher implements ISystemFunctionDispatcher {
  constructor(private runtime: IInpaRuntime) {}

  isAsync(funcId: number): boolean {
    return ASYNC_FUNCTIONS.has(funcId);
  }

  isInternal(funcId: number): boolean {
    return INTERNAL_FUNCTIONS.has(funcId);
  }

  dispatch(funcId: number, args: unknown[]): unknown | Promise<unknown> {
    const { ui, simulation, ediabas, inp1, print, pem, dtm, external, sps } = this.runtime;

    switch (funcId) {
      // === UI: Menu ===
      case SysFuncId.SETMENUTITLE:
        return ui.setMenuTitle(args[0] as string);
      case SysFuncId.SETMENU:
        return ui.setMenu(args[0] as number);
      case SysFuncId.SETITEM:
        return ui.setItem(args[0] as number, args[1] as string, args[2] as boolean);
      case SysFuncId.SETITEMREPEAT:
        return ui.setItemRepeat(args[0] as number, args[1] as boolean);

      // === UI: Screen ===
      case SysFuncId.SETTITLE:
        return ui.setTitle(args[0] as string);
      case SysFuncId.SETSCREEN:
        return ui.setScreen(args[0] as number, args[1] as boolean);
      case SysFuncId.SETCOLOR:
        return ui.setColor(args[0] as number, args[1] as number);
      case SysFuncId.CLEARRECT:
        return ui.clearRect(
          args[0] as number, args[1] as number,
          args[2] as number, args[3] as number
        );
      case SysFuncId.BLANKSCREEN:
        return ui.blankScreen();

      // === UI: Text Output ===
      case SysFuncId.TEXT:
        return ui.text(args[0] as number, args[1] as number, args[2] as string);
      case SysFuncId.TEXTOUT:
        return ui.textOut(args[0] as string, args[1] as number, args[2] as number);
      case SysFuncId.FTEXTOUT:
        return ui.fTextOut(
          args[0] as string, args[1] as number, args[2] as number,
          args[3] as number, args[4] as number,
          args[5] as number, args[6] as number
        );
      case SysFuncId.FTEXTCLEAR:
        return ui.fTextClear(
          args[0] as string, args[1] as number, args[2] as number,
          args[3] as number, args[4] as number
        );
      case SysFuncId.HEXDUMP:
        return ui.hexDump(
          args[0] as number, args[1] as number,
          args[2] as Uint8Array, args[3] as number
        );

      // === UI: Data Output ===
      case SysFuncId.DIGITALOUT:
        return ui.digitalOut(
          args[0] as boolean, args[1] as number, args[2] as number,
          args[3] as string, args[4] as string
        );
      case SysFuncId.ANALOGOUT:
        return ui.analogOut(
          args[0] as number, args[1] as number, args[2] as number,
          args[3] as number, args[4] as number,
          args[5] as number, args[6] as number,
          args[7] as string
        );
      case SysFuncId.MULTIANALOGOUT:
        return ui.multiAnalogOut(args[0] as number, args[1] as number, ...args.slice(2));

      // === UI: Input ===
      case SysFuncId.GETINPUTSTATE:
        return ui.getInputState();
      case SysFuncId.INPUTTEXT:
        return ui.inputText(args[0] as string, args[1] as string);
      case SysFuncId.INPUTNUM:
        return ui.inputNum(
          args[0] as string, args[1] as string,
          args[2] as number, args[3] as number
        );
      case SysFuncId.INPUTHEX:
        return ui.inputHex(
          args[0] as string, args[1] as string,
          args[2] as string, args[3] as string
        );
      case SysFuncId.INPUTDIGITAL:
        return ui.inputDigital(
          args[0] as string, args[1] as string,
          args[2] as string, args[3] as string
        );
      case SysFuncId.INPUT2TEXT:
        return ui.input2Text(
          args[0] as string, args[1] as string,
          args[2] as string, args[3] as string
        );
      case SysFuncId.INPUT2HEXNUM:
        return ui.input2HexNum(
          args[0] as string, args[1] as string,
          args[2] as string, args[3] as string,
          args[4] as string, args[5] as string,
          args[6] as number, args[7] as number
        );
      case SysFuncId.INPUT2HEX:
        return ui.input2Hex(
          args[0] as string, args[1] as string,
          args[2] as string, args[3] as string,
          args[4] as string, args[5] as string,
          args[6] as string, args[7] as string
        );
      case SysFuncId.INPUTINT:
        return ui.inputInt(
          args[0] as string, args[1] as string,
          args[2] as number, args[3] as number
        );
      case SysFuncId.INPUT2INT:
        return ui.input2Int(
          args[0] as string, args[1] as string,
          args[2] as string, args[3] as string,
          args[4] as number, args[5] as number,
          args[6] as number, args[7] as number
        );

      // === UI: Message Boxes ===
      case SysFuncId.MESSAGEBOX:
        return ui.messageBox(args[0] as string, args[1] as string);
      case SysFuncId.INFOBOX:
        return ui.infoBox(args[0] as string, args[1] as string);
      case SysFuncId.USERBOXOPEN:
        return ui.userBoxOpen(
          args[0] as number, args[1] as number, args[2] as number,
          args[3] as number, args[4] as number,
          args[5] as string, args[6] as string
        );
      case SysFuncId.USERBOXCLOSE:
        return ui.userBoxClose(args[0] as number);
      case SysFuncId.USERBOXFTEXTOUT:
        return ui.userBoxFTextOut(
          args[0] as number, args[1] as string,
          args[2] as number, args[3] as number,
          args[4] as number, args[5] as number
        );
      case SysFuncId.USERBOXCLEAR:
        return ui.userBoxClear(args[0] as number);
      case SysFuncId.USERBOXSETCOLOR:
        return ui.userBoxSetColor(
          args[0] as number, args[1] as number, args[2] as number
        );

      // === Simulation ===
      case SysFuncId.SIMNUM:
        return simulation.simNum(
          args[0] as string, args[1] as string,
          args[2] as number, args[3] as number
        );
      case SysFuncId.SIMDIGITAL:
        return simulation.simDigital(
          args[0] as string, args[1] as string,
          args[2] as string, args[3] as string
        );

      // === EDIABAS ===
      case SysFuncId.INPAAPI_INIT:
        return ediabas.init();
      case SysFuncId.INPAAPI_END:
        return ediabas.end();
      case SysFuncId.INPAAPI_JOB:
        return ediabas.job(
          args[0] as string, args[1] as string,
          args[2] as string, args[3] as string
        );
      case SysFuncId.INPAAPI_RESULTTEXT:
        return ediabas.resultText(
          args[0] as string, args[1] as number, args[2] as string
        );
      case SysFuncId.INPAAPI_RESULTINT:
        return ediabas.resultInt(args[0] as string, args[1] as number);
      case SysFuncId.INPAAPI_RESULTSETS:
        return ediabas.resultSets();
      case SysFuncId.INPAAPI_RESULTDIGITAL:
        return ediabas.resultDigital(args[0] as string, args[1] as number);
      case SysFuncId.INPAAPI_RESULTANALOG:
        return ediabas.resultAnalog(args[0] as string, args[1] as number);
      case SysFuncId.INPAAPI_RESULTBINARY:
        return ediabas.resultBinary(args[0] as string, args[1] as number);
      case SysFuncId.INPAAPI_CHECKJOBSTATUS:
        return ediabas.checkJobStatus(args[0] as string);
      case SysFuncId.INPAAPI_FSLESEN:
        return ediabas.fsLesen(args[0] as string, args[1] as string);
      case SysFuncId.INPAAPI_FSLESEN2:
        return ediabas.fsLesen2(args[0] as string, args[1] as string);
      case SysFuncId.INPAAPI_FSMODE:
        return ediabas.fsMode(
          args[0] as number, args[1] as string,
          args[2] as string, args[3] as string, args[4] as string
        );

      // === INP1 ===
      case SysFuncId.INP1API_INIT:
        if (!inp1) throw new Error('INP1 provider not available');
        return inp1.init();
      case SysFuncId.INP1API_END:
        if (!inp1) throw new Error('INP1 provider not available');
        return inp1.end();
      case SysFuncId.INP1API_JOB:
        if (!inp1) throw new Error('INP1 provider not available');
        return inp1.job(
          args[0] as string, args[1] as string,
          args[2] as string, args[3] as string
        );
      case SysFuncId.INP1API_STATE:
        if (!inp1) throw new Error('INP1 provider not available');
        return inp1.state();
      case SysFuncId.INP1API_RESULTTEXT:
        if (!inp1) throw new Error('INP1 provider not available');
        return inp1.resultText(args[0] as string, args[1] as number, args[2] as string);
      case SysFuncId.INP1API_RESULTINT:
        if (!inp1) throw new Error('INP1 provider not available');
        return inp1.resultInt(args[0] as string, args[1] as number);
      case SysFuncId.INP1API_RESULTSETS:
        if (!inp1) throw new Error('INP1 provider not available');
        return inp1.resultSets();
      case SysFuncId.INP1API_RESULTREAL:
        if (!inp1) throw new Error('INP1 provider not available');
        return inp1.resultReal(args[0] as string, args[1] as number);
      case SysFuncId.INP1API_RESULTBINARY:
        if (!inp1) throw new Error('INP1 provider not available');
        return inp1.resultBinary(args[0] as string, args[1] as number);
      case SysFuncId.INP1API_ERRORCODE:
        if (!inp1) throw new Error('INP1 provider not available');
        return inp1.errorCode();
      case SysFuncId.INP1API_ERRORTEXT:
        if (!inp1) throw new Error('INP1 provider not available');
        return inp1.errorText();

      // === Print ===
      case SysFuncId.PRINTSCREEN:
        return print.printScreen();
      case SysFuncId.PRINTFILE:
        return print.printFile(
          args[0] as string, args[1] as string,
          args[2] as string, args[3] as boolean
        );

      // === PEM ===
      case SysFuncId.PEM_INITIALISIERE:
        return pem.initialisiere();
      case SysFuncId.PEM_PROTOKOLLKOPF:
        return pem.protokollKopf();
      case SysFuncId.PEM_PROTOKOLLZEILE:
        return pem.protokollZeile();
      case SysFuncId.PEM_SGZKOPFZEILE:
        return pem.sgzKopfzeile();
      case SysFuncId.PEM_TRENNLINIE:
        return pem.trennLinie();
      case SysFuncId.PEM_ENDLINIE:
        return pem.endLinie();
      case SysFuncId.PEM_LOESCHETABZEILENPUFFER:
        return pem.loescheTabZeilenPuffer();
      case SysFuncId.PEM_UEBERTRAGETABZEILENPUFFER:
        return pem.uebertrageTabZeilenPuffer();
      case SysFuncId.PEM_PROTOKOLLAUSGABE:
        return pem.protokollAusgabe();
      case SysFuncId.PEM_DRUCKEETIKETT:
        return pem.druckeEtikett();
      case SysFuncId.PEM_PRINTFORMULAR:
        return pem.printFormular();
      case SysFuncId.PEM_PRINTERFF:
        return pem.printerFf();
      case SysFuncId.PEM_FREEMEM:
        return pem.freeMem();
      case SysFuncId.PEM_LOADFORMULAR:
        return pem.loadFormular();
      case SysFuncId.PEM_DEFAULTDRUCKFELD:
        return pem.defaultDruckfeld();
      case SysFuncId.PEM_DEFAULTBESETZEN:
        return pem.defaultBesetzen();
      case SysFuncId.PEM_FORGETFORMULAR:
        return pem.forgetFormular();
      case SysFuncId.PEM_WRITEDRUCKFELD:
        return pem.writeDruckfeld();

      // === DTM ===
      case SysFuncId.DTM_FINDLOGUNIT:
        return dtm.findLogUnit(args[0] as string);
      case SysFuncId.DTM_GETSGVAR:
        return dtm.getSGVar(args[0] as string);
      case SysFuncId.DTM_GETSGART:
        return dtm.getSGArt(args[0] as string);
      case SysFuncId.DTM_GETVARWERT:
        return dtm.getVarWert(args[0] as string);
      case SysFuncId.DTM_SETUPGETVARWERT:
        return dtm.setupGetVarWert(args[0] as string);
      case SysFuncId.DTM_SETUPGETSTARTPOSITION:
        return dtm.setupGetStartPosition();
      case SysFuncId.DTM_SETUPGETNEXTASSOC:
        return dtm.setupGetNextAssoc();
      case SysFuncId.DTM_LOGUNITEINTRAGEN:
        return dtm.logUnitEintragen(args[0] as string);
      case SysFuncId.DTM_SGEINTRAGEN:
        return dtm.sgEintragen(args[0] as string, args[1] as string);
      case SysFuncId.DTM_LOESCHEAUFTRAG:
        return dtm.loescheAuftrag();
      case SysFuncId.DTM_VARIABLEEINTRAGEN:
        return dtm.variableEintragen(args[0] as string, args[1] as string);
      case SysFuncId.DTM_VARIABLELOESCHEN:
        return dtm.variableLoeschen(args[0] as string);
      case SysFuncId.DTM_LOESCHEALLEVARIABLEN:
        return dtm.loescheAlleVariablen();
      case SysFuncId.DTM_SETUPVARIABLEEINTRAGEN:
        return dtm.setupVariableEintragen(args[0] as string, args[1] as string);
      case SysFuncId.DTM_SETUPVARIABLELOESCHEN:
        return dtm.setupVariableLoeschen(args[0] as string);

      // === External ===
      case SysFuncId.WINHELP:
        return external.winHelp(args[0] as string);
      case SysFuncId.WINHELPKEY:
        return external.winHelpKey(args[0] as string, args[1] as string);
      case SysFuncId.CALLWIN:
        return external.callWin(args[0] as string);
      case SysFuncId.VIEWOPEN:
        return external.viewOpen(args[0] as string, args[1] as string);
      case SysFuncId.VIEWCLOSE:
        return external.viewClose();

      // === SPS ===
      case SysFuncId.SPS_INIT:
        if (!sps) throw new Error('SPS provider not available');
        return sps.init();
      case SysFuncId.SPS_END:
        if (!sps) throw new Error('SPS provider not available');
        return sps.end();
      case SysFuncId.SPS_LESEVONSPS:
        if (!sps) throw new Error('SPS provider not available');
        return sps.leseVonSPS(...args);
      case SysFuncId.SPS_SENDEANSPS:
        if (!sps) throw new Error('SPS provider not available');
        return sps.sendeAnSPS(...args);
      case SysFuncId.SPS_LESEVAKWERTE:
        if (!sps) throw new Error('SPS provider not available');
        return sps.leseVakWerte(...args);

      default:
        if (this.isInternal(funcId)) {
          throw new Error(
            `Internal function 0x${funcId.toString(16)} should be handled by interpreter`
          );
        }
        throw new Error(`Unknown system function: 0x${funcId.toString(16)}`);
    }
  }
}
