/**
 * System Function Dispatcher
 * Maps system function IDs to provider method calls
 */

import { SystemFunction, SystemFunctionMap, type StackEntry, type Scope, ValueType } from '@emdzej/inpax-core';
import type { IInpaRuntime } from '@emdzej/inpax-interfaces';

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
    // UI - delegated to providers but some may require internal handling
    SystemFunction.setscreen,
    SystemFunction.setmenu,

]);

export interface ExecutionContext {
    popString(): string;
    popInt(): number;
    popReal(): number;
    popBool(): boolean;
    popRef(): StackEntry;
    setOutParam(ref: StackEntry, value: StackEntry): void;
    getVariable?(scope: Scope, index: number): StackEntry;
}

export type VM = unknown;

export type ParamDirection = 'in' | 'out' | 'inout';

export interface ParsedParam {
    direction: ParamDirection;
    type: string;
    name: string;
}

export interface ParsedSignature {
    params: ParsedParam[];
    isVariadic: boolean;
}

function parseSignature(signature: string): ParsedSignature {
    const params: ParsedParam[] = [];

    if (signature === '()') return { params, isVariadic: false };
    if (signature === '(...)') return { params, isVariadic: true };

    const inner = signature.slice(1, -1).trim();
    if (!inner) return { params, isVariadic: false };

    const isVariadic = inner.endsWith('...');
    const paramStr = isVariadic ? inner.replace(/,?\s*\.\.\.$/, '') : inner;

    const parts = paramStr.split(',').map(p => p.trim()).filter(p => p);

    for (const part of parts) {
        const match = part.match(/^(in|out|inout):\s*(\w+)\s+(\w+)$/i);
        if (match) {
            params.push({
                direction: match[1] as ParamDirection,
                type: match[2],
                name: match[3],
            });
        }
    }

    return { params, isVariadic };
}

function getSignature(funcId: number): ParsedSignature | null {
    const info = SystemFunctionMap.get(funcId);
    if (!info) return null;
    return parseSignature(info.signature);
}

function popByType(ctx: ExecutionContext, typeName: string): unknown {
    switch (typeName.toLowerCase()) {
        case 'string':
            return ctx.popString();
        case 'real':
            return ctx.popReal();
        case 'bool':
            return ctx.popBool();
        case 'byte':
        case 'int':
        case 'long':
        case 'menu':
        case 'screen':
        case 'statemachine':
        case 'state':
        default:
            return ctx.popInt();
    }
}

function inpaTypeToValueType(typeName: string): ValueType {
    switch (typeName.toLowerCase()) {
        case 'bool':
            return ValueType.Bool;
        case 'byte':
            return ValueType.Byte;
        case 'int':
            return ValueType.Int;
        case 'long':
            return ValueType.Long;
        case 'real':
            return ValueType.Real;
        case 'string':
            return ValueType.String;
        case 'menu':
        case 'screen':
        case 'statemachine':
        case 'state':
            return ValueType.Handle1;
        default:
            return ValueType.Int;
    }
}

interface CollectedArgs {
    inputs: unknown[];
    outRefs: StackEntry[];
    outParams: ParsedParam[];
}

function collectArguments(funcId: number, ctx: ExecutionContext): CollectedArgs {
    const sig = getSignature(funcId);
    if (!sig) {
        return { inputs: [], outRefs: [], outParams: [] };
    }

    const inputs: unknown[] = [];
    const outRefs: StackEntry[] = [];
    const outParams: ParsedParam[] = [];

    const popped: Array<{ entry: StackEntry | unknown; param: ParsedParam }> = [];

    for (let i = sig.params.length - 1; i >= 0; i--) {
        const param = sig.params[i];
        if (param.direction === 'in') {
            const value = popByType(ctx, param.type);
            popped.unshift({ entry: value, param });
        } else {
            const ref = ctx.popRef();
            popped.unshift({ entry: ref, param });
        }
    }

    for (const { entry, param } of popped) {
        if (param.direction === 'in') {
            inputs.push(entry);
        } else if (param.direction === 'out') {
            outRefs.push(entry as StackEntry);
            outParams.push(param);
        } else if (param.direction === 'inout') {
            const ref = entry as StackEntry;
            let value = ref.value;
            if (ref.refInfo && ctx.getVariable) {
                value = ctx.getVariable(ref.refInfo.scope as Scope, ref.refInfo.index).value;
            }
            inputs.push(value);
            outRefs.push(ref);
            outParams.push(param);
        }
    }

    return { inputs, outRefs, outParams };
}

function writeOutParams(
    outRefs: StackEntry[],
    outParams: ParsedParam[],
    returnValue: unknown,
    ctx: ExecutionContext
): void {
    if (outRefs.length === 0) return;

    let outValues: unknown[];

    if (returnValue === undefined || returnValue === null) {
        outValues = [];
    } else if (Array.isArray(returnValue)) {
        outValues = returnValue;
    } else {
        outValues = [returnValue];
    }

    for (let i = 0; i < outRefs.length && i < outValues.length; i++) {
        const ref = outRefs[i];
        const param = outParams[i];
        const value = outValues[i];
        const valueType = inpaTypeToValueType(param.type);

        ctx.setOutParam(ref, { type: valueType, flags: 1, value: value as StackEntry['value'] });
    }
}

export interface ISystemFunctionDispatcher {
    /**
     * Dispatch system function call to appropriate provider
     * @param funcId System function ID (0x00-0xA1)
     * @param ctx Execution context for stack operations
     * @param vm VM instance
     */
    dispatch(funcId: number, ctx: ExecutionContext, vm: VM): void | Promise<void>;

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
    constructor(private runtime: IInpaRuntime) { }

    isAsync(funcId: number): boolean {
        return ASYNC_FUNCTIONS.has(funcId);
    }

    isInternal(funcId: number): boolean {
        return INTERNAL_FUNCTIONS.has(funcId);
    }

    async dispatch(funcId: number, ctx: ExecutionContext, vm: VM): Promise<void> {
        const { ui, simulation, ediabas, inp1, print, pem, dtm, external, sps } = this.runtime;
        const collected = collectArguments(funcId, ctx);
        const { inputs } = collected;

        const finalize = async (value: unknown | Promise<unknown>): Promise<void> => {
            const resolved = value instanceof Promise ? await value : value;
            writeOutParams(collected.outRefs, collected.outParams, resolved, ctx);
        };

        switch (funcId) {
            // === UI: Menu ===
            case SystemFunction.setmenutitle:
                return finalize(ui.setMenuTitle(inputs[0] as string));
            case SystemFunction.setmenu:
                return finalize(ui.setMenu(inputs[0] as number));
            case SystemFunction.setitem:
                return finalize(ui.setItem(inputs[0] as number, inputs[1] as string, inputs[2] as boolean));
            case SystemFunction.setitemrepeat:
                return finalize(ui.setItemRepeat(inputs[0] as number, inputs[1] as boolean));

            // === UI: Screen ===
            case SystemFunction.settitle:
                return finalize(ui.setTitle(inputs[0] as string));
            case SystemFunction.setscreen:
                return finalize(ui.setScreen(inputs[0] as number, inputs[1] as boolean));
            case SystemFunction.setcolor:
                return finalize(ui.setColor(inputs[0] as number, inputs[1] as number));
            case SystemFunction.clearrect:
                return finalize(ui.clearRect(
                    inputs[0] as number, inputs[1] as number,
                    inputs[2] as number, inputs[3] as number
                ));
            case SystemFunction.blankscreen:
                return finalize(ui.blankScreen());

            // === UI: Text Output ===
            case SystemFunction.text:
                return finalize(ui.text(inputs[0] as number, inputs[1] as number, inputs[2] as string));
            case SystemFunction.textout:
                return finalize(ui.textOut(inputs[0] as string, inputs[1] as number, inputs[2] as number));
            case SystemFunction.ftextout: {
                // INPA signature: `(text, row, col, fontsize, fontattr)` —
                // 5 args, NO colors. Colors come from the current
                // `setcolor(fg, bg)` state. The previous dispatch read
                // inputs[3]/[4] as fg/bg, which silently consumed the
                // script's fontsize/fontattr and produced wrong tints
                // (e.g. `< F1 > Information` rendered as fg=0 bg=1
                // → "white on black" with the docs palette, when the
                // script actually wanted the current setcolor pair).
                const { fg, bg } = ui.getCurrentColors();
                return finalize(ui.fTextOut(
                    inputs[0] as string, inputs[1] as number, inputs[2] as number,
                    fg, bg,
                    inputs[3] as number, inputs[4] as number
                ));
            }
            case SystemFunction.ftextclear:
                // Same shape as ftextout: `(text, row, col, size, attr)`.
                // The 4th/5th args are font metrics, not colors.
                return finalize(ui.fTextClear(
                    inputs[0] as string, inputs[1] as number, inputs[2] as number,
                    inputs[3] as number, inputs[4] as number
                ));
            case SystemFunction.hexdump:
                return finalize(ui.hexDump(
                    inputs[0] as number, inputs[1] as number,
                    inputs[2] as Uint8Array, inputs[3] as number
                ));

            // === UI: Data Output ===
            case SystemFunction.digitalout:
                return finalize(ui.digitalOut(
                    inputs[0] as boolean, inputs[1] as number, inputs[2] as number,
                    inputs[3] as string, inputs[4] as string
                ));
            case SystemFunction.analogout:
                return finalize(ui.analogOut(
                    inputs[0] as number, inputs[1] as number, inputs[2] as number,
                    inputs[3] as number, inputs[4] as number,
                    inputs[5] as number, inputs[6] as number,
                    inputs[7] as string
                ));
            case SystemFunction.multianalogout:
                return finalize(ui.multiAnalogOut(inputs[0] as number, inputs[1] as number, ...inputs.slice(2)));

            // === UI: Input ===
            case SystemFunction.getinputstate:
                return finalize(ui.getInputState());
            case SystemFunction.inputtext:
                return finalize(ui.inputText(inputs[0] as string, inputs[1] as string));
            case SystemFunction.inputnum:
                return finalize(ui.inputNum(
                    inputs[0] as string, inputs[1] as string,
                    inputs[2] as number, inputs[3] as number
                ));
            case SystemFunction.inputhex:
                return finalize(ui.inputHex(
                    inputs[0] as string, inputs[1] as string,
                    inputs[2] as string, inputs[3] as string
                ));
            case SystemFunction.inputdigital:
                return finalize(ui.inputDigital(
                    inputs[0] as string, inputs[1] as string,
                    inputs[2] as string, inputs[3] as string
                ));
            case SystemFunction.input2text:
                return finalize(ui.input2Text(
                    inputs[0] as string, inputs[1] as string,
                    inputs[2] as string, inputs[3] as string
                ));
            case SystemFunction.input2hexnum:
                return finalize(ui.input2HexNum(
                    inputs[0] as string, inputs[1] as string,
                    inputs[2] as string, inputs[3] as string,
                    inputs[4] as string, inputs[5] as string,
                    inputs[6] as number, inputs[7] as number
                ));
            case SystemFunction.input2hex:
                return finalize(ui.input2Hex(
                    inputs[0] as string, inputs[1] as string,
                    inputs[2] as string, inputs[3] as string,
                    inputs[4] as string, inputs[5] as string,
                    inputs[6] as string, inputs[7] as string
                ));
            case SystemFunction.inputint:
                return finalize(ui.inputInt(
                    inputs[0] as string, inputs[1] as string,
                    inputs[2] as number, inputs[3] as number
                ));
            case SystemFunction.input2int:
                return finalize(ui.input2Int(
                    inputs[0] as string, inputs[1] as string,
                    inputs[2] as string, inputs[3] as string,
                    inputs[4] as number, inputs[5] as number,
                    inputs[6] as number, inputs[7] as number
                ));

            // === UI: Message Boxes ===
            case SystemFunction.messagebox:
                return finalize(ui.messageBox(inputs[0] as string, inputs[1] as string));
            case SystemFunction.infobox:
                return finalize(ui.infoBox(inputs[0] as string, inputs[1] as string));
            case SystemFunction.userboxopen:
                return finalize(ui.userBoxOpen(
                    inputs[0] as number, inputs[1] as number, inputs[2] as number,
                    inputs[3] as number, inputs[4] as number,
                    inputs[5] as string, inputs[6] as string
                ));
            case SystemFunction.userboxclose:
                return finalize(ui.userBoxClose(inputs[0] as number));
            case SystemFunction.userboxftextout:
                return finalize(ui.userBoxFTextOut(
                    inputs[0] as number, inputs[1] as string,
                    inputs[2] as number, inputs[3] as number,
                    inputs[4] as number, inputs[5] as number
                ));
            case SystemFunction.userboxclear:
                return finalize(ui.userBoxClear(inputs[0] as number));
            case SystemFunction.userboxsetcolor:
                return finalize(ui.userBoxSetColor(
                    inputs[0] as number, inputs[1] as number, inputs[2] as number
                ));

            // === Simulation ===
            case SystemFunction.simnum:
                return finalize(simulation.simNum(
                    inputs[0] as string, inputs[1] as string,
                    inputs[2] as number, inputs[3] as number
                ));
            case SystemFunction.simdigital:
                return finalize(simulation.simDigital(
                    inputs[0] as string, inputs[1] as string,
                    inputs[2] as string, inputs[3] as string
                ));

            // === EDIABAS ===
            case SystemFunction.INPAapiInit:
                // Drive the host's "ensure the cable is open" flow before
                // letting the provider init the comm session. The host
                // (web `ConfigPanel`, CLI prompt, …) is responsible for
                // showing whatever settings UI it has and resolving the
                // promise once the user is done; we then let
                // `ediabas.init()` either open the link (success) or fail
                // (which surfaces as a `job:error` for the script to
                // see). The split keeps the dispatcher generic — no
                // host-specific UI knowledge here.
                return finalize(
                    (async () => {
                        // Loop: ensure connection → try init. On failure
                        // ask the host what to do — retry pulls a fresh
                        // transport via `ensureConnected` and re-tries,
                        // continue lets the script proceed (later jobs
                        // will fail), stop throws so the VM halts.
                        // Subsequent iterations pass the previous error
                        // along so the dialog can show it.
                        while (true) {
                            await ui.ensureConnected();
                            try {
                                await ediabas.init();
                                return;
                            } catch (err) {
                                const message = err instanceof Error ? err.message : String(err);
                                const choice = await ui.confirmConnectError(message);
                                if (choice === "stop") throw err;
                                if (choice === "continue") return;
                                // "retry" — loop
                            }
                        }
                    })()
                );
            case SystemFunction.INPAapiEnd:
                return finalize(ediabas.end());
            case SystemFunction.INPAapiJob:
                return finalize(ediabas.job(
                    inputs[0] as string, inputs[1] as string,
                    inputs[2] as string, inputs[3] as string
                ));
            case SystemFunction.INPAapiResultText:
                return finalize(ediabas.resultText(
                    inputs[0] as string, inputs[1] as number, inputs[2] as string
                ));
            case SystemFunction.INPAapiResultInt:
                return finalize(ediabas.resultInt(inputs[0] as string, inputs[1] as number));
            case SystemFunction.INPAapiResultSets:
                return finalize(ediabas.resultSets());
            case SystemFunction.INPAapiResultDigital:
                return finalize(ediabas.resultDigital(inputs[0] as string, inputs[1] as number));
            case SystemFunction.INPAapiResultAnalog:
                return finalize(ediabas.resultAnalog(inputs[0] as string, inputs[1] as number));
            case SystemFunction.INPAapiResultBinary:
                return finalize(ediabas.resultBinary(inputs[0] as string, inputs[1] as number));
            case SystemFunction.INPAapiCheckJobStatus:
                return finalize(ediabas.checkJobStatus(inputs[0] as string));
            case SystemFunction.INPAapiFsLesen:
                return finalize(ediabas.fsLesen(inputs[0] as string, inputs[1] as string));
            case SystemFunction.INPAapiFsLesen2:
                return finalize(ediabas.fsLesen2(inputs[0] as string, inputs[1] as string));
            case SystemFunction.INPAapiFsMode:
                return finalize(ediabas.fsMode(
                    inputs[0] as number, inputs[1] as string,
                    inputs[2] as string, inputs[3] as string, inputs[4] as string
                ));

            // === INP1 ===
            case SystemFunction.INP1apiInit:
                if (!inp1) throw new Error('INP1 provider not available');
                return finalize(inp1.init());
            case SystemFunction.INP1apiEnd:
                if (!inp1) throw new Error('INP1 provider not available');
                return finalize(inp1.end());
            case SystemFunction.INP1apiJob:
                if (!inp1) throw new Error('INP1 provider not available');
                return finalize(inp1.job(
                    inputs[0] as string, inputs[1] as string,
                    inputs[2] as string, inputs[3] as string
                ));
            case SystemFunction.INP1apiState:
                if (!inp1) throw new Error('INP1 provider not available');
                return finalize(inp1.state());
            case SystemFunction.INP1apiResultText:
                if (!inp1) throw new Error('INP1 provider not available');
                return finalize(inp1.resultText(inputs[0] as string, inputs[1] as number, inputs[2] as string));
            case SystemFunction.INP1apiResultInt:
                if (!inp1) throw new Error('INP1 provider not available');
                return finalize(inp1.resultInt(inputs[0] as string, inputs[1] as number));
            case SystemFunction.INP1apiResultSets:
                if (!inp1) throw new Error('INP1 provider not available');
                return finalize(inp1.resultSets());
            case SystemFunction.INP1apiResultReal:
                if (!inp1) throw new Error('INP1 provider not available');
                return finalize(inp1.resultReal(inputs[0] as string, inputs[1] as number));
            case SystemFunction.INP1apiResultBinary:
                if (!inp1) throw new Error('INP1 provider not available');
                return finalize(inp1.resultBinary(inputs[0] as string, inputs[1] as number));
            case SystemFunction.INP1apiErrorCode:
                if (!inp1) throw new Error('INP1 provider not available');
                return finalize(inp1.errorCode());
            case SystemFunction.INP1apiErrorText:
                if (!inp1) throw new Error('INP1 provider not available');
                return finalize(inp1.errorText());

            // === Print ===
            case SystemFunction.printscreen:
                return finalize(print.printScreen());
            case SystemFunction.printfile:
                return finalize(print.printFile(
                    inputs[0] as string, inputs[1] as string,
                    inputs[2] as string, inputs[3] as boolean
                ));

            // === PEM ===
            case SystemFunction.PEMInitialisiere:
                return finalize(pem.initialisiere());
            case SystemFunction.PEMProtokollKopf:
                return finalize(pem.protokollKopf());
            case SystemFunction.PEMProtokollZeile:
                return finalize(pem.protokollZeile());
            case SystemFunction.PEMSGZ_Kopfzeile:
                return finalize(pem.sgzKopfzeile());
            case SystemFunction.PEMTrennLinie:
                return finalize(pem.trennLinie());
            case SystemFunction.PEMEndLinie:
                return finalize(pem.endLinie());
            case SystemFunction.PEMLoescheTabZeilenPuffer:
                return finalize(pem.loescheTabZeilenPuffer());
            case SystemFunction.PEMUebertrageTabZeilenPuffer:
                return finalize(pem.uebertrageTabZeilenPuffer());
            case SystemFunction.PEMProtokollAusgabe:
                return finalize(pem.protokollAusgabe());
            case SystemFunction.PEMDruckeEtikett:
                return finalize(pem.druckeEtikett());
            case SystemFunction.PEMPrintFormular:
                return finalize(pem.printFormular());
            case SystemFunction.PEMPrinter_ff:
                return finalize(pem.printerFf());
            case SystemFunction.PEMFree_mem:
                return finalize(pem.freeMem());
            case SystemFunction.PEMLoad_formular:
                return finalize(pem.loadFormular());
            case SystemFunction.PEMDefault_druckfeld:
                return finalize(pem.defaultDruckfeld());
            case SystemFunction.PEMDefault_besetzen:
                return finalize(pem.defaultBesetzen());
            case SystemFunction.PEMForget_formular:
                return finalize(pem.forgetFormular());
            case SystemFunction.PEMWrite_druckfeld:
                return finalize(pem.writeDruckfeld());

            // === DTM ===
            case SystemFunction.DTMFindLogUnit:
                return finalize(dtm.findLogUnit(inputs[0] as string));
            case SystemFunction.DTMGetSGVar:
                return finalize(dtm.getSGVar(inputs[0] as string));
            case SystemFunction.DTMGetSGArt:
                return finalize(dtm.getSGArt(inputs[0] as string));
            case SystemFunction.DTMGetVarWert:
                return finalize(dtm.getVarWert(inputs[0] as string));
            case SystemFunction.DTMSetupGetVarWert:
                return finalize(dtm.setupGetVarWert(inputs[0] as string));
            case SystemFunction.DTMSetupGetStartPosition:
                return finalize(dtm.setupGetStartPosition());
            case SystemFunction.DTMSetupGetNextAssoc:
                return finalize(dtm.setupGetNextAssoc());
            case SystemFunction.DTMLogUnitEintragen:
                return finalize(dtm.logUnitEintragen(inputs[0] as string));
            case SystemFunction.DTMSGEintragen:
                return finalize(dtm.sgEintragen(inputs[0] as string, inputs[1] as string));
            case SystemFunction.DTMLoescheAuftrag:
                return finalize(dtm.loescheAuftrag());
            case SystemFunction.DTMVariableEintragen:
                return finalize(dtm.variableEintragen(inputs[0] as string, inputs[1] as string));
            case SystemFunction.DTMVariableLoeschen:
                return finalize(dtm.variableLoeschen(inputs[0] as string));
            case SystemFunction.DTMLoescheAlleVariablen:
                return finalize(dtm.loescheAlleVariablen());
            case SystemFunction.DTMSetupVariableEintragen:
                return finalize(dtm.setupVariableEintragen(inputs[0] as string, inputs[1] as string));
            case SystemFunction.DTMSetupVariableLoeschen:
                return finalize(dtm.setupVariableLoeschen(inputs[0] as string));

            // === External ===
            case SystemFunction.winhelp:
                return finalize(external.winHelp(inputs[0] as string));
            case SystemFunction.winhelpkey:
                return finalize(external.winHelpKey(inputs[0] as string, inputs[1] as string));
            case SystemFunction.callwin:
                return finalize(external.callWin(inputs[0] as string));
            case SystemFunction.viewopen:
                return finalize(external.viewOpen(inputs[0] as string, inputs[1] as string));
            case SystemFunction.viewclose:
                return finalize(external.viewClose());

            // === SPS ===
            case SystemFunction.SPSInit:
                if (!sps) throw new Error('SPS provider not available');
                return finalize(sps.init());
            case SystemFunction.SPSEnd:
                if (!sps) throw new Error('SPS provider not available');
                return finalize(sps.end());
            case SystemFunction.SPSLeseVonSPS:
                if (!sps) throw new Error('SPS provider not available');
                return finalize(sps.leseVonSPS(...inputs));
            case SystemFunction.SPSSendeAnSPS:
                if (!sps) throw new Error('SPS provider not available');
                return finalize(sps.sendeAnSPS(...inputs));
            case SystemFunction.SPSLeseVakWerte:
                if (!sps) throw new Error('SPS provider not available');
                return finalize(sps.leseVakWerte(...inputs));

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