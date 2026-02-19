import { State } from "./state.js";
import { StackObject } from "./stack.js";
import { Program } from "./program.js";
import { Instruction, OpCode, OpCodes, withOffsetSuffix } from "@inpax/core";
import { alloc, alu, InstructionHandlers, pushv } from "./index.js";

export type InterpreterEvents<T extends StackObject = StackObject> = {
    programLoaded: [Interpreter<T>, Program];
}




const handlers: InstructionHandlers = {
    [OpCodes.PUSHV]: pushv,
    [OpCodes.ALLOC]: alloc,
    [OpCodes.ALU]: alu
}


export class Interpreter<T extends StackObject = StackObject> {
    private readonly _state: State<T>;
    private _program?: Program;

    constructor(state?: State<T>) {
        this._state = state || new State<T>();
    }

    get state(): State<T> {
        return this._state;
    }

    public loadProgram(program: Program): void {
        this._program = program;
    }

    public run(): void {
        if (!this._program) {
            throw new Error("No program loaded");
        }
        const entryPoint = this._program.file.functions.find(f => f.id === 0);
        if (!entryPoint) {
            throw new Error("No entry point found");
        }
        try {
            this.execute(entryPoint.instructions);
        } catch (e) {
            console.error(e);
        }
    }

    execute(instructions: readonly Instruction[]) {
        for (const instruction of instructions) {
            const opcode = instruction.raw[0] as OpCode;
            const handler = handlers[opcode];
            if (!handler) {
                throw new Error(
                    withOffsetSuffix(
                    `No handler for opcode ${opcode}`, instruction.offset)
                );
            }
            handler(instruction, this._state);
        }
    }
}
