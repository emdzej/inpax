import { describe, it, expect } from "vitest";
import { Stack } from "../stack.js";

describe("Stack", () => {
    it("pointer should point at the last element", () => {
        const stack = new Stack([1, 2, 3]);
        expect(stack.pointer).toBe(2);
        expect(stack.peek()).toBe(3);
    });

    it("push should add an element to the stack and update the pointer", () => {
        const stack = new Stack<number>();
        stack.push(1);
        expect(stack.pointer).toBe(0);
        expect(stack.peek()).toBe(1);
    });

    it("pop should remove the last element from the stack and update the pointer", () => {
        const stack = new Stack([1, 2, 3]);
        const popped = stack.pop();
        expect(popped).toBe(3);
        expect(stack.pointer).toBe(1);
        expect(stack.peek()).toBe(2);
    });

    it("size should return the number of elements in the stack", () => {
        const stack = new Stack([1, 2, 3]);
        expect(stack.size()).toBe(3);
    });

    it("clear should remove all elements from the stack and reset the pointer", () => {
        const stack = new Stack([1, 2, 3]);
        stack.clear();
        expect(stack.empty).toBe(true);
        expect(stack.pointer).toBe(-1);
    });

});
