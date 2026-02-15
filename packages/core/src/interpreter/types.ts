import { DataTypeMarker, InpaFile, Instruction, OpCode } from "../parser/types.js";

export type InstructionHandler = (instruction: Instruction, state: State) => void;
export type InstructionDisassembler = (instruction: Instruction, state: State) => string;

export type InstructionHandlers = {
    [opcode in OpCode]?: InstructionHandler;
}

export type Frame = {

};

export const varSymbol = Symbol("variable");

export type Variable =
    { [varSymbol]: true, readonly type: 0x01; value: boolean}
    | { [varSymbol]: true, readonly type: 0x02; value: number }
    | { [varSymbol]: true, readonly type: 0x03; value: number }
    | { [varSymbol]: true, readonly type: 0x04; value: number }
    | { [varSymbol]: true, readonly type: 0x05; value: number }
    | { [varSymbol]: true, readonly type: 0x06; value: string }

export function isVariable(obj: unknown): obj is Variable {
  return typeof obj === "object" && obj !== null && varSymbol in obj;
}

export function isVariableOfType<T extends Variable>(obj: Variable, type: DataTypeMarker) {
    return obj.type === type;
}

export type StackObject = Variable;

export type State = {
    program: InpaFile;
    stack: StackObject[];
    stackPointer: number;
    instructionPointer: number;
}

