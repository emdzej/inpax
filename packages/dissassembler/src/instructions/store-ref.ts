import { AluOpCode, getAluOpCodeName, getKeyByValue, getOpCodeName, getVariableScopeName, InpaFile, OpCodes, VariableScope, VariableScopes } from "@inpax/core";

export function formatStoreRefInstruction(opcode: number, rawBytes: Buffer, context: InpaFile): string {
    if (opcode != OpCodes.STOREREF) {
        throw new Error(`Invalid opcode for STOREREF instruction: ${opcode}`);
    }
    const scope = rawBytes[1] as VariableScope;
    const index = rawBytes.readUInt16LE(2);
    var line = `${getOpCodeName(opcode)} ${getVariableScopeName(scope)} #[${index}]`;

    switch (scope) {
        case VariableScopes.SCREEN_HANDLE:
            const screen = context.screens?.[index];
            if (screen !== undefined) {
                line += ` ; ${screen.name}`;
            }
            break;
        case VariableScopes.MENU_HANDLE:
            const menu = context.menus?.[index];
            if (menu !== undefined) {
                line += ` ; ${menu.name}`;
            }
            break;
        case VariableScopes.STATE_MACHINE_HANDLE:
            const stateMachine = context.stateMachines?.[index];
            if (stateMachine !== undefined) {
                line += ` ; ${stateMachine.name}`;
            }
            break;
        case VariableScopes.CONST:
            const constant = context.constants.constants[index];
            if (constant !== undefined) {
                line += ` ; ${constant.value}`;
            }
            break;

    }

    return line;
};
