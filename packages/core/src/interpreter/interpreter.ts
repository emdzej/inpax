import { InpaFile, OpCodes } from "../parser/types.js";
import { alu } from "./alu.js";
import { InstructionHandlers, State } from "./types.js";


const instructionHandlers: InstructionHandlers = {
    [OpCodes.ALU]: alu
};


export function runProgram(program: InpaFile) {
    const state: State = {
        program,

        stack: [],
        stackPointer: 0,
        instructionPointer: 0
    };
};

