import { AluOpCode, CallScope, CallScopes, getAluOpCodeName, getCallScopeName, getKeyByValue, getOpCodeName, getVariableScopeName, InpaFile, OpCodes, systemFunctionById, VariableScope, VariableScopes } from "@inpax/core";

export function formatCallInstruction(opcode: number, rawBytes: Buffer, context: InpaFile): string {
    if (opcode != OpCodes.CALL) {
        throw new Error(`Invalid opcode for CALL instruction: ${opcode}`);
    }
    const scope = rawBytes[1] as CallScope;;
    const index = rawBytes.readUInt16LE(2);

    var line = `${getOpCodeName(opcode)} ${getCallScopeName(scope)} #[${index}]`;
    switch (scope) {
        case CallScopes.USER:
            const userFunction = context.functions.find(f => f.id === index);
            if (userFunction !== undefined) {
                line += ` ; ${userFunction.name}`;
            }
            break;
        case CallScopes.SYSTEM:
            const builtinFunction = systemFunctionById.get(index);
            if (builtinFunction !== undefined) {
                line += ` ; ${builtinFunction.name}`;
            }
            break;
    }

    return line;
};
