

import { EventEmitter } from "events";
import { StackObject, Stack } from "./stack.js";

export class State<T extends StackObject = StackObject> extends EventEmitter {
    private readonly _stack: Stack<T>;
    private _programCounter: number = 0;

    constructor(stack?: Stack<T>) {
        super();
        this._stack = stack || new Stack<T>();
    }

    get stack(): Stack<T> {
        return this._stack;
    }

    get programCounter(): number {
        return this._programCounter;
    }

    public incrementProgramCounter(amount: number = 1): void {
        this._programCounter += amount;
    }
}
