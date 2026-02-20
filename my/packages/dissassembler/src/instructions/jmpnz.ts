import { AluOpCode, getAluOpCodeName, getKeyByValue, getOpCodeName, getVariableScopeName, InpaFile, numberToHex, OpCodes, VariableScope, VariableScopes } from "@inpax/core";

export function formatJmpNzInstruction(opcode: number, rawBytes: Buffer, context: InpaFile): string {
    if (opcode != OpCodes.JMPNZ) {
        throw new Error(`Invalid opcode for JMPNZ instruction: ${opcode}`);
    }

    const offset = rawBytes.readUInt16LE(2);
    var line = `${getOpCodeName(opcode)} +${numberToHex(offset)} `;

    return line;
};
