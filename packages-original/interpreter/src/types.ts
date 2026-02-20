import { Instruction, OpCode } from "@inpax/core";
import { State } from "./state.js";

export type InstructionHandler = (instruction: Instruction, state: State) => void;
export type InstructionDisassembler = (instruction: Instruction, state: State) => string;

export type InstructionHandlers = {
    [opcode in OpCode]?: InstructionHandler;
}

