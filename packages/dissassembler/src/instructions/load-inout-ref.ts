import { AluOpCode, getAluOpCodeName, getKeyByValue, getOpCodeName, getVariableScopeName, InpaFile, OpCodes, VariableScope, VariableScopes } from "@inpax/core";

export function formatLoadInOutRefInstruction(opcode: number, rawBytes: Buffer, context: InpaFile): string {
    if (opcode != OpCodes.LOADINOUTREF) {
        throw new Error(`Invalid opcode for LOADINOUTREF instruction: ${opcode}`);
    }
    const scope = rawBytes[1] as VariableScope;
    const index = rawBytes.readUInt16LE(2);
    var line = `${getOpCodeName(opcode)} ${getVariableScopeName(scope)} #[${index}]`;

    return line;
};
