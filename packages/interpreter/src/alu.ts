import { Instruction, AluOpCode, numberToHex, AluOpCodes, OpCode, VariableScope, VariableScopes, containsValue, withOffsetSuffix, AllocType, AllocTypes, Variable, newVariable, DataTypeMarkers } from "@inpax/core";
import { State } from "./state.js";
import { V } from "vitest/dist/chunks/reporters.nr4dxCkA.js";

type AluHandler = (instruction: Instruction, state: State) => void;

type AluHandlers = {
    [opcode in AluOpCode]?: AluHandler;
}

/*
ADD: 0x60,
    SUB: 0x61,
    MUL: 0x62,
    DIV: 0x63,
    LT: 0x64,
    GT: 0x65,
    LE: 0x66,
    GE: 0x67,
    EQ: 0x68,
    NE: 0x69,
    AND: 0x6A,
    OR: 0x6B,
    NOT: 0x6E,
*/

function aluAdd(instruction: Instruction, state: State): void {

}

function aluSub(instruction: Instruction, state: State): void {

}

function aluMul(instruction: Instruction, state: State): void {

}

function aluDiv(instruction: Instruction, state: State): void {

}

function aluLt(instruction: Instruction, state: State): void {

}

function aluGt(instruction: Instruction, state: State): void {

}

function aluLe(instruction: Instruction, state: State): void {

}

function aluGe(instruction: Instruction, state: State): void {

}

function aluEq(instruction: Instruction, state: State): void {

}

function aluNe(instruction: Instruction, state: State): void {

}

function aluAnd(instruction: Instruction, state: State): void {

}

function aluOr(instruction: Instruction, state: State): void {

}

function aluNot(instruction: Instruction, state: State): void {

}

const aluHandlers: AluHandlers = {
    [AluOpCodes.ADD]: aluAdd,
    [AluOpCodes.SUB]: aluSub,
    [AluOpCodes.MUL]: aluMul,
    [AluOpCodes.DIV]: aluDiv,
    [AluOpCodes.LT]: aluLt,
    [AluOpCodes.GT]: aluGt,
    [AluOpCodes.LE]: aluLe,
    [AluOpCodes.GE]: aluGe,
    [AluOpCodes.EQ]: aluEq,
    [AluOpCodes.NE]: aluNe,
    [AluOpCodes.AND]: aluAnd,
    [AluOpCodes.OR]: aluOr,
    [AluOpCodes.NOT]: aluNot,
};

export function alu(instruction: Instruction, state: State): void {
    const op = instruction.raw[1] as AluOpCode;
    const handler = aluHandlers[op as AluOpCode];
    if (!handler) {
        throw new Error(`Unknown ALU operation: ${numberToHex(op)}`);
    }
    handler(instruction, state);
}

export function alloc(instruction: Instruction, state: State): void {
    const opcode = instruction.raw[0] as OpCode;
    const allocType = instruction.raw[1] as AllocType;

    switch (allocType) {
        case AllocTypes.BOOL:
            state.currentFrame.stack.push(newVariable(DataTypeMarkers.BOOL) as Variable);
            break;
        case AllocTypes.BYTE:
            state.currentFrame.stack.push(newVariable(DataTypeMarkers.BYTE) as Variable);
            break;
        case AllocTypes.INT:
            state.currentFrame.stack.push(newVariable(DataTypeMarkers.INT) as Variable);
            break;
        case AllocTypes.LONG:
            state.currentFrame.stack.push(newVariable(DataTypeMarkers.LONG) as Variable);
            break;
        case AllocTypes.REAL:
            state.currentFrame.stack.push(newVariable(DataTypeMarkers.REAL) as Variable);
            break;
        case AllocTypes.STRING:
            state.currentFrame.stack.push(newVariable(DataTypeMarkers.STRING) as Variable);
            break;
        default:
            throw new Error(withOffsetSuffix(`Unsupported alloc type: ${numberToHex(allocType)}`, instruction.offset));
    }

}

export function pushv(instruction: Instruction, state: State): void {
    const opcode = instruction.raw[0] as OpCode;
    const scope = instruction.raw[1] as VariableScope;

    switch (scope) {
        case VariableScopes.LOCAL:
        case VariableScopes.GLOBAL:
        case VariableScopes.CONST:
        case VariableScopes.MENU_HANDLE:
        case VariableScopes.SCREEN_HANDLE:
        case VariableScopes.STATE_MACHINE_HANDLE:
        default:
            throw new Error(withOffsetSuffix(`Unsupported variable scope: ${numberToHex(scope)}`, instruction.offset));
    };

    const index = instruction.raw.readUInt16LE(2);

}
