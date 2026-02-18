import { State } from "./state.js";
import { StackObject } from "./stack.js";
import { Program } from "./program.js";

export type InterpreterEvents<T extends StackObject = StackObject> = {
    programLoaded: [Interpreter<T>, Program];
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
    }
}
