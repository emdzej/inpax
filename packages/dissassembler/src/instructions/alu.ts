import { AluOpCode, getAluOpCodeName, getKeyByValue, InpaFile, OpCodes } from "@inpax/core";

export function formatAluInstruction(opcode: number, rawBytes: Buffer, context: InpaFile): string {
    if (opcode != OpCodes.ALU) {
        throw new Error(`Invalid opcode for ALU instruction: ${opcode}`);
    }

    const aluOpcode = rawBytes[1] as AluOpCode;
    return getAluOpCodeName(aluOpcode);
};
