import { AllocType, AluOpCode, getAllocTypeName, getAluOpCodeName, getKeyByValue, getOpCodeName, InpaFile, OpCodes } from "@inpax/core";

export function formatAllocInstruction(opcode: number, rawBytes: Buffer, context: InpaFile): string {
    if (opcode != OpCodes.ALLOC) {
        throw new Error(`Invalid opcode for ALLOC instruction: ${opcode}`);
    }

    const allocType = rawBytes[1] as AllocType;
    return `${getOpCodeName(opcode)} ${getAllocTypeName(allocType)}`;
};
