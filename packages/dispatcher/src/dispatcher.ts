/**
 * System Function Dispatcher
 * Maps system function IDs to provider method calls
 */

import { SystemFunction } from '@inpax/core';
import type { IInpaRuntime } from '@inpax/interfaces';

/** Set of async function IDs */
const ASYNC_FUNCTIONS = new Set<number>([
  // Input dialogs
  SystemFunction.inputtext,
  SystemFunction.inputnum,
  SystemFunction.inputhex,
  SystemFunction.inputdigital,
  SystemFunction.input2text,
  SystemFunction.input2hexnum,
  SystemFunction.input2hex,
  SystemFunction.inputint,
  SystemFunction.input2int,
  // Message boxes
  SystemFunction.messagebox,
  SystemFunction.infobox,
  // Simulation
  SystemFunction.simnum,
  SystemFunction.simdigital,
  // EDIABAS
  SystemFunction.INPAapiInit,
  SystemFunction.INPAapiEnd,
  SystemFunction.INPAapiJob,
  SystemFunction.INPAapiFsLesen,
  SystemFunction.INPAapiFsLesen2,
  // INP1
  SystemFunction.INP1apiInit,
]);

/** Internal functions handled by interpreter */
const INTERNAL_FUNCTIONS = new Set<number>([
  // State Machine
  SystemFunction.setstatemachine,
  SystemFunction.setstate,
  SystemFunction.callstatemachine,
  SystemFunction.returnstatemachine,
  // Timer
  SystemFunction.settimer,
  SystemFunction.testtimer,
  // Job Control
  SystemFunction.setjobstatus,
  SystemFunction.exit,
  SystemFunction.exitwindows,
  SystemFunction.scriptselect,
  SystemFunction.scriptchange,
  SystemFunction.select,
  SystemFunction.deselect,
  SystemFunction.control,
  SystemFunction.start,
  SystemFunction.stop,
  SystemFunction.getapistring,
  SystemFunction.togglelist,
  // Time
  SystemFunction.delay,
  SystemFunction.getdate,
  SystemFunction.gettime,
  // Conversions
  SystemFunction.realtostring,
  SystemFunction.stringtoreal,
  SystemFunction.inttostring,
  SystemFunction.stringtoint,
  SystemFunction.hexconvert,
  SystemFunction.strcat,
  SystemFunction.strlen,
  SystemFunction.midstr,
  SystemFunction.realtoint,
  SystemFunction.inttoreal,
  SystemFunction.bytetoint,
  SystemFunction.inttolong,
  SystemFunction.longtoreal,
  // Binary
  SystemFunction.GetBinaryDataString,
  // File I/O
  SystemFunction.fileopen,
  SystemFunction.fileclose,
  SystemFunction.filewrite,
  SystemFunction.fileread,
  // String Arrays
  SystemFunction.StrArrayCreate,
  SystemFunction.StrArrayDestroy,
  SystemFunction.StrArrayWrite,
  SystemFunction.StrArrayRead,
  SystemFunction.StrArrayGetElementCount,
  SystemFunction.StrArrayDelete,
  // Structures
  SystemFunction.CreateStructure,
  SystemFunction.SetStructureMode,
  SystemFunction.StructureByte,
  SystemFunction.StructureInt,
  SystemFunction.StructureLong,
  SystemFunction.StructureString,
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
      case SystemFunction.setmenutitle:
        return ui.setMenuTitle(args[0] as string);
      case SystemFunction.setmenu:
        return ui.setMenu(args[0] as number);
      case SystemFunction.setitem:
        return ui.setItem(args[0] as number, args[1] as string, args[2] as boolean);
      case SystemFunction.setitemrepeat:
        return ui.setItemRepeat(args[0] as number, args[1] as boolean);

      // === UI: Screen ===
      case SystemFunction.settitle:
        return ui.setTitle(args[0] as string);
      case SystemFunction.setscreen:
        return ui.setScreen(args[0] as number, args[1] as boolean);
      case SystemFunction.setcolor:
        return ui.setColor(args[0] as number, args[1] as number);
      case SystemFunction.clearrect:
        return ui.clearRect(
          args[0] as number, args[1] as number,
          args[2] as number, args[3] as number
        );
      case SystemFunction.blankscreen:
        return ui.blankScreen();

      // === UI: Text Output ===
      case SystemFunction.text:
        return ui.text(args[0] as number, args[1] as number, args[2] as string);
      case SystemFunction.textout:
        return ui.textOut(args[0] as string, args[1] as number, args[2] as number);
      case SystemFunction.ftextout:
        return ui.fTextOut(
          args[0] as string, args[1] as number, args[2] as number,
          args[3] as number, args[4] as number,
          args[5] as number, args[6] as number
        );
      case SystemFunction.ftextclear:
        return ui.fTextClear(
          args[0] as string, args[1] as number, args[2] as number,
          args[3] as number, args[4] as number
        );
      case SystemFunction.hexdump:
        return ui.hexDump(
          args[0] as number, args[1] as number,
          args[2] as Uint8Array, args[3] as number
        );

      // === UI: Data Output ===
      case SystemFunction.digitalout:
        return ui.digitalOut(
          args[0] as boolean, args[1] as number, args[2] as number,
          args[3] as string, args[4] as string
        );
      case SystemFunction.analogout:
        return ui.analogOut(
          args[0] as number, args[1] as number, args[2] as number,
          args[3] as number, args[4] as number,
          args[5] as number, args[6] as number,
          args[7] as string
        );
      case SystemFunction.multianalogout:
        return ui.multiAnalogOut(args[0] as number, args[1] as number, ...args.slice(2));

      // === UI: Input ===
      case SystemFunction.getinputstate:
        return ui.getInputState();
      case SystemFunction.inputtext:
        return ui.inputText(args[0] as string, args[1] as string);
      case SystemFunction.inputnum:
        return ui.inputNum(
          args[0] as string, args[1] as string,
          args[2] as number, args[3] as number
        );
      case SystemFunction.inputhex:
        return ui.inputHex(
          args[0] as string, args[1] as string,
          args[2] as string, args[3] as string
        );
      case SystemFunction.inputdigital:
        return ui.inputDigital(
          args[0] as string, args[1] as string,
          args[2] as string, args[3] as string
        );
      case SystemFunction.input2text:
        return ui.input2Text(
          args[0] as string, args[1] as string,
          args[2] as string, args[3] as string
        );
      case SystemFunction.input2hexnum:
        return ui.input2HexNum(
          args[0] as string, args[1] as string,
          args[2] as string, args[3] as string,
          args[4] as string, args[5] as string,
          args[6] as number, args[7] as number
        );
      case SystemFunction.input2hex:
        return ui.input2Hex(
          args[0] as string, args[1] as string,
          args[2] as string, args[3] as string,
          args[4] as string, args[5] as string,
          args[6] as string, args[7] as string
        );
      case SystemFunction.inputint:
        return ui.inputInt(
          args[0] as string, args[1] as string,
          args[2] as number, args[3] as number
        );
      case SystemFunction.input2int:
        return ui.input2Int(
          args[0] as string, args[1] as string,
          args[2] as string, args[3] as string,
          args[4] as number, args[5] as number,
          args[6] as number, args[7] as number
        );

      // === UI: Message Boxes ===
      case SystemFunction.messagebox:
        return ui.messageBox(args[0] as string, args[1] as string);
      case SystemFunction.infobox:
        return ui.infoBox(args[0] as string, args[1] as string);
      case SystemFunction.userboxopen:
        return ui.userBoxOpen(
          args[0] as number, args[1] as number, args[2] as number,
          args[3] as number, args[4] as number,
          args[5] as string, args[6] as string
        );
      case SystemFunction.userboxclose:
        return ui.userBoxClose(args[0] as number);
      case SystemFunction.userboxftextout:
        return ui.userBoxFTextOut(
          args[0] as number, args[1] as string,
          args[2] as number, args[3] as number,
          args[4] as number, args[5] as number
        );
      case SystemFunction.userboxclear:
        return ui.userBoxClear(args[0] as number);
      case SystemFunction.userboxsetcolor:
        return ui.userBoxSetColor(
          args[0] as number, args[1] as number, args[2] as number
        );

      // === Simulation ===
      case SystemFunction.simnum:
        return simulation.simNum(
          args[0] as string, args[1] as string,
          args[2] as number, args[3] as number
        );
      case SystemFunction.simdigital:
        return simulation.simDigital(
          args[0] as string, args[1] as string,
          args[2] as string, args[3] as string
        );

      // === EDIABAS ===
      case SystemFunction.INPAapiInit:
        return ediabas.init();
      case SystemFunction.INPAapiEnd:
        return ediabas.end();
      case SystemFunction.INPAapiJob:
        return ediabas.job(
          args[0] as string, args[1] as string,
          args[2] as string, args[3] as string
        );
      case SystemFunction.INPAapiResultText:
        return ediabas.resultText(
          args[0] as string, args[1] as number, args[2] as string
        );
      case SystemFunction.INPAapiResultInt:
        return ediabas.resultInt(args[0] as string, args[1] as number);
      case SystemFunction.INPAapiResultSets:
        return ediabas.resultSets();
      case SystemFunction.INPAapiResultDigital:
        return ediabas.resultDigital(args[0] as string, args[1] as number);
      case SystemFunction.INPAapiResultAnalog:
        return ediabas.resultAnalog(args[0] as string, args[1] as number);
      case SystemFunction.INPAapiResultBinary:
        return ediabas.resultBinary(args[0] as string, args[1] as number);
      case SystemFunction.INPAapiCheckJobStatus:
        return ediabas.checkJobStatus(args[0] as string);
      case SystemFunction.INPAapiFsLesen:
        return ediabas.fsLesen(args[0] as string, args[1] as string);
      case SystemFunction.INPAapiFsLesen2:
        return ediabas.fsLesen2(args[0] as string, args[1] as string);
      case SystemFunction.INPAapiFsMode:
        return ediabas.fsMode(
          args[0] as number, args[1] as string,
          args[2] as string, args[3] as string, args[4] as string
        );

      // === INP1 ===
      case SystemFunction.INP1apiInit:
        if (!inp1) throw new Error('INP1 provider not available');
        return inp1.init();
      case SystemFunction.INP1apiEnd:
        if (!inp1) throw new Error('INP1 provider not available');
        return inp1.end();
      case SystemFunction.INP1apiJob:
        if (!inp1) throw new Error('INP1 provider not available');
        return inp1.job(
          args[0] as string, args[1] as string,
          args[2] as string, args[3] as string
        );
      case SystemFunction.INP1apiState:
        if (!inp1) throw new Error('INP1 provider not available');
        return inp1.state();
      case SystemFunction.INP1apiResultText:
        if (!inp1) throw new Error('INP1 provider not available');
        return inp1.resultText(args[0] as string, args[1] as number, args[2] as string);
      case SystemFunction.INP1apiResultInt:
        if (!inp1) throw new Error('INP1 provider not available');
        return inp1.resultInt(args[0] as string, args[1] as number);
      case SystemFunction.INP1apiResultSets:
        if (!inp1) throw new Error('INP1 provider not available');
        return inp1.resultSets();
      case SystemFunction.INP1apiResultReal:
        if (!inp1) throw new Error('INP1 provider not available');
        return inp1.resultReal(args[0] as string, args[1] as number);
      case SystemFunction.INP1apiResultBinary:
        if (!inp1) throw new Error('INP1 provider not available');
        return inp1.resultBinary(args[0] as string, args[1] as number);
      case SystemFunction.INP1apiErrorCode:
        if (!inp1) throw new Error('INP1 provider not available');
        return inp1.errorCode();
      case SystemFunction.INP1apiErrorText:
        if (!inp1) throw new Error('INP1 provider not available');
        return inp1.errorText();

      // === Print ===
      case SystemFunction.printscreen:
        return print.printScreen();
      case SystemFunction.printfile:
        return print.printFile(
          args[0] as string, args[1] as string,
          args[2] as string, args[3] as boolean
        );

      // === PEM ===
      case SystemFunction.PEMInitialisiere:
        return pem.initialisiere();
      case SystemFunction.PEMProtokollKopf:
        return pem.protokollKopf();
      case SystemFunction.PEMProtokollZeile:
        return pem.protokollZeile();
      case SystemFunction.PEMSGZ_Kopfzeile:
        return pem.sgzKopfzeile();
      case SystemFunction.PEMTrennLinie:
        return pem.trennLinie();
      case SystemFunction.PEMEndLinie:
        return pem.endLinie();
      case SystemFunction.PEMLoescheTabZeilenPuffer:
        return pem.loescheTabZeilenPuffer();
      case SystemFunction.PEMUebertrageTabZeilenPuffer:
        return pem.uebertrageTabZeilenPuffer();
      case SystemFunction.PEMProtokollAusgabe:
        return pem.protokollAusgabe();
      case SystemFunction.PEMDruckeEtikett:
        return pem.druckeEtikett();
      case SystemFunction.PEMPrintFormular:
        return pem.printFormular();
      case SystemFunction.PEMPrinter_ff:
        return pem.printerFf();
      case SystemFunction.PEMFree_mem:
        return pem.freeMem();
      case SystemFunction.PEMLoad_formular:
        return pem.loadFormular();
      case SystemFunction.PEMDefault_druckfeld:
        return pem.defaultDruckfeld();
      case SystemFunction.PEMDefault_besetzen:
        return pem.defaultBesetzen();
      case SystemFunction.PEMForget_formular:
        return pem.forgetFormular();
      case SystemFunction.PEMWrite_druckfeld:
        return pem.writeDruckfeld();

      // === DTM ===
      case SystemFunction.DTMFindLogUnit:
        return dtm.findLogUnit(args[0] as string);
      case SystemFunction.DTMGetSGVar:
        return dtm.getSGVar(args[0] as string);
      case SystemFunction.DTMGetSGArt:
        return dtm.getSGArt(args[0] as string);
      case SystemFunction.DTMGetVarWert:
        return dtm.getVarWert(args[0] as string);
      case SystemFunction.DTMSetupGetVarWert:
        return dtm.setupGetVarWert(args[0] as string);
      case SystemFunction.DTMSetupGetStartPosition:
        return dtm.setupGetStartPosition();
      case SystemFunction.DTMSetupGetNextAssoc:
        return dtm.setupGetNextAssoc();
      case SystemFunction.DTMLogUnitEintragen:
        return dtm.logUnitEintragen(args[0] as string);
      case SystemFunction.DTMSGEintragen:
        return dtm.sgEintragen(args[0] as string, args[1] as string);
      case SystemFunction.DTMLoescheAuftrag:
        return dtm.loescheAuftrag();
      case SystemFunction.DTMVariableEintragen:
        return dtm.variableEintragen(args[0] as string, args[1] as string);
      case SystemFunction.DTMVariableLoeschen:
        return dtm.variableLoeschen(args[0] as string);
      case SystemFunction.DTMLoescheAlleVariablen:
        return dtm.loescheAlleVariablen();
      case SystemFunction.DTMSetupVariableEintragen:
        return dtm.setupVariableEintragen(args[0] as string, args[1] as string);
      case SystemFunction.DTMSetupVariableLoeschen:
        return dtm.setupVariableLoeschen(args[0] as string);

      // === External ===
      case SystemFunction.winhelp:
        return external.winHelp(args[0] as string);
      case SystemFunction.winhelpkey:
        return external.winHelpKey(args[0] as string, args[1] as string);
      case SystemFunction.callwin:
        return external.callWin(args[0] as string);
      case SystemFunction.viewopen:
        return external.viewOpen(args[0] as string, args[1] as string);
      case SystemFunction.viewclose:
        return external.viewClose();

      // === SPS ===
      case SystemFunction.SPSInit:
        if (!sps) throw new Error('SPS provider not available');
        return sps.init();
      case SystemFunction.SPSEnd:
        if (!sps) throw new Error('SPS provider not available');
        return sps.end();
      case SystemFunction.SPSLeseVonSPS:
        if (!sps) throw new Error('SPS provider not available');
        return sps.leseVonSPS(...args);
      case SystemFunction.SPSSendeAnSPS:
        if (!sps) throw new Error('SPS provider not available');
        return sps.sendeAnSPS(...args);
      case SystemFunction.SPSLeseVakWerte:
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
