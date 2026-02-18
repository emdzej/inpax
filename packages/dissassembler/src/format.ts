import { InpaFile, withOffsetPrefix, Instruction, numberToHex, OpCode, OpCodes, getOpCodeName } from "@inpax/core";
import { InstructionDisassemblyHandlers } from "./types.js";
import { formatAluInstruction, formatLoadInstruction } from "./instructions/index.js";
import { formatCallInstruction } from "./instructions/call.js";
import { formatAllocInstruction } from "./instructions/alloc.js";
import { formatLoadRefInstruction } from "./instructions/load-ref.js";
import { formatStoreRefInstruction } from "./instructions/store-ref.js";
import { formatCallExtInstruction } from "./instructions/callext.js";
import { formatJmpInstruction } from "./instructions/jmp.js";
import { formatJmpNzInstruction } from "./instructions/jmpnz.js";
import { formatLoadOutRefInstruction } from "./instructions/load-out-ref.js";

export type FormatOptions = {
    showRawBytes?: boolean;
    showOffset?: boolean;
    resolveNames?: boolean;
    input: InpaFile;
};

const DEFAULT_OPTIONS: Required<FormatOptions> = {
    showRawBytes: false,
    showOffset: true,
    resolveNames: true,
    input: {} as InpaFile
};

const OPCODE_COLUMN_WIDTH = 12;
const RAW_BYTES_COLUMN_WIDTH = 11;

const formatValue = (value: number): string => {
    if (value < 0) {
        return `-${numberToHex(Math.abs(value), "0x", 2)}`;
    }

    return `${numberToHex(value, "0x", 2)}`;
};

const formatRawBytes = (raw: Uint8Array): string =>
    Array.from(raw)
        .map((byte) => numberToHex(byte, "", 2))
        .join(" ");


const handlers: InstructionDisassemblyHandlers = {
    [OpCodes.ALU]: formatAluInstruction,
    [OpCodes.LOAD]: formatLoadInstruction,
    [OpCodes.STOREREF]: formatStoreRefInstruction,
    [OpCodes.LOADREF]: formatLoadRefInstruction,
    [OpCodes.LOADOUTREF]: formatLoadOutRefInstruction,
    [OpCodes.CALL]: formatCallInstruction,
    [OpCodes.JMP]: formatJmpInstruction,
    [OpCodes.JMPNZ]: formatJmpNzInstruction,
    [OpCodes.CALLEXT]: formatCallExtInstruction,
    [OpCodes.ALLOC]: formatAllocInstruction,
    [OpCodes.RET]: (opcode) => getOpCodeName(opcode),
    [OpCodes.STORE]: (opcode) => getOpCodeName(opcode),
    [OpCodes.FRAME]: (opcode) => getOpCodeName(opcode),
};


export const formatInstruction = (
    instruction: Instruction,
    context: InpaFile,
    options?: FormatOptions
): string => {


    let line = "";

    const rawBytes = formatRawBytes(instruction.raw).padEnd(
        RAW_BYTES_COLUMN_WIDTH,
        " "
    );
    line = withOffsetPrefix(rawBytes, instruction.offset);

    const opCode = instruction.raw[0] as OpCode;
    const handler = handlers[opCode];
    if (handler) {
        line +=` ; ${handler(opCode, instruction.raw, context)}`;
    } else {
        line += " ; <unknown instruction>";
    }

    return line.trimEnd();
};

export const formatDisassembly = (
    instructions: Instruction[],
    context: InpaFile,
    options?: FormatOptions
): string => instructions.map((instruction) => formatInstruction(instruction, context, options)).join("\n");
