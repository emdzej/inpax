import { AluOpCode, getAluOpCodeName, getKeyByValue, getOpCodeName, getVariableScopeName, InpaFile, OpCodes, VariableScope, VariableScopes } from "@inpax/core";

export function formatLoadInstruction(opcode: number, rawBytes: Buffer, context: InpaFile): string {
    if (opcode != OpCodes.PUSHV) {
        throw new Error(`Invalid opcode for PUSHV instruction: ${opcode}`);
    }
    const scope = rawBytes[1] as VariableScope;
    const index = rawBytes.readUInt16LE(2);
    var line = `${getOpCodeName(opcode)} ${getVariableScopeName(scope)} #[${index}]`;
    if (scope === VariableScopes.CONST) {
        const constant = context.constants.constants[index];
        if (constant !== undefined) {
            if (constant.type === 0x06) {
                line += ` ; "${constant.value}"`;
            } else {
                line += ` ; ${constant.value}`;
            }
        }
    }
    return line;
};
