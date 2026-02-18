import EventEmitter from "events";

export type StackObject = any;

export type StackEvents<T extends StackObject = StackObject> = {
    cleared: [Stack<T>];
    poped: [Stack<T>];
    pushed: [Stack<T>];
    changed: [Stack<T>];
}

// Ascending stack, where the top of the stack is the last element in the array
export class Stack<T extends StackObject = StackObject> extends EventEmitter<StackEvents<T>> {
    private readonly _stack: T[];
    private _pointer: number = -1;

    constructor(readonly items: T[] = []) {
        super();
        this._stack = items;
        this._pointer = items.length - 1;
    }

    get pointer(): number {
        return this._pointer;
    }

    get empty(): boolean {
        return this._stack.length === 0;
    }

    public push(item: T): void {
        this._stack.push(item);
        this._pointer = this._stack.length - 1;
        this.emit("pushed", this);
        this.emit("changed", this);
    }

    public pop(): T | undefined {
        const item = this._stack.pop();
        this._pointer = this._stack.length - 1;
        this.emit("poped", this);
        this.emit("changed", this);
        return item;
    }

    public peek(): T | undefined {
        return this._stack[this._stack.length - 1];
    }

    public size(): number {
        return this._stack.length;
    }

    public clear(): void {
        this._stack.length = 0;
        this._pointer = -1;
        this.emit("cleared", this);
        this.emit("changed", this);
    }

}
