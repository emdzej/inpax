import { AluOpCode, CallScope, CallScopes, getAluOpCodeName, getCallScopeName, getKeyByValue, getOpCodeName, getVariableScopeName, InpaFile, OpCodes, systemFunctionById, VariableScope, VariableScopes } from "@inpax/core";

export function formatCallExtInstruction(opcode: number, rawBytes: Buffer, context: InpaFile): string {
    if (opcode != OpCodes.CALLEXT) {
        throw new Error(`Invalid opcode for CALLEXT instruction: ${opcode}`);
    }
    ;
    const index = rawBytes.readUInt16LE(2);
    const signature = context.constants.constants[index].value;

    var line = `${getOpCodeName(opcode)} ${signature}`;

    return line;
};
