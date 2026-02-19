import { Stack } from "./stack.js";

export class Frame {
    private readonly _stack: Stack;
    private readonly _parent?: Frame;

    get parent(): Frame | undefined {
        return this._parent;
    }

    get stack(): Stack {
        return this._stack;
    }

    constructor(parent?: Frame) {
        this._stack = new Stack();
        this._parent = parent;
    }
}
