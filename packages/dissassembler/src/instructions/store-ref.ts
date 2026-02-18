import { AluOpCode, getAluOpCodeName, getKeyByValue, getOpCodeName, getVariableScopeName, InpaFile, OpCodes, VariableScope, VariableScopes } from "@inpax/core";

export function formatStoreRefInstruction(opcode: number, rawBytes: Buffer, context: InpaFile): string {
    if (opcode != OpCodes.STOREREF) {
        throw new Error(`Invalid opcode for STOREREF instruction: ${opcode}`);
    }
    const scope = rawBytes[1] as VariableScope;
    const index = rawBytes.readUInt16LE(2);
    var line = `${getOpCodeName(opcode)} ${getVariableScopeName(scope)} #[${index}]`;
    if (scope === VariableScopes.CONST) {
        const constant = context.constants.constants[index];
        if (constant !== undefined) {
            line += ` ; ${constant.value}`;
        }
    }
    return line;
};
