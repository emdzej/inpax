import { describe, it, expect } from "vitest";
import { decodeInstructions } from "../opcode-decoder.js";

const bytes = (...values: number[]): Uint8Array => Uint8Array.from(values);

describe("decodeInstructions", () => {
  it("should decode known opcodes and preserve offsets", () => {
    const buffer = bytes(
      0x01, 0x2a, 0x00, // PUSH_VAR_ADDR 42
      0x00, 0x01, 0x01, 0x00, // PUSH_VAR_VAL 1
      0x00, 0x06, 0x02, 0x00, // PUSH_CONST 2
      0x00, 0x05, // STORE
      0x00, 0x09, 0x60, // ALU_OP +
      0x00, 0x0b, 0xfe, 0xff, // JMP_FALSE -2
      0x00, 0x0e, 0x04, 0x00, // JMP 4
      0x0c, 0x80, 0x10, 0x00, // CALL_USER 16
      0x0c, 0x81, 0x48, 0x00, // CALL_API 72
      0x02, 0x40, 0x00, 0x00, // PUSH_HANDLE 64
      0x21, // SCREEN_START
      0x22, // LINE
      0x24, // ITEM
      0x25, // STATE
      0xff // UNKNOWN
    );

    const instructions = decodeInstructions(buffer);

    expect(instructions).toHaveLength(15);
    expect(instructions[0]).toMatchObject({ opcode: "PUSH_VAR_ADDR", operands: [42], offset: 0, size: 3 });
    expect(instructions[1]).toMatchObject({ opcode: "PUSH_VAR_VAL", operands: [1], offset: 3, size: 4 });
    expect(instructions[2]).toMatchObject({ opcode: "PUSH_CONST", operands: [2], offset: 7, size: 4 });
    expect(instructions[3]).toMatchObject({ opcode: "STORE", operands: [], offset: 11, size: 2 });
    expect(instructions[4]).toMatchObject({ opcode: "ALU_OP", operands: [0x60], offset: 13, size: 3 });
    expect(instructions[5]).toMatchObject({ opcode: "JMP_FALSE", operands: [-2], offset: 16, size: 4 });
    expect(instructions[6]).toMatchObject({ opcode: "JMP", operands: [4], offset: 20, size: 4 });
    expect(instructions[7]).toMatchObject({ opcode: "CALL_USER", operands: [16], offset: 24, size: 4 });
    expect(instructions[8]).toMatchObject({ opcode: "CALL_API", operands: [72], offset: 28, size: 4 });
    expect(instructions[9]).toMatchObject({ opcode: "PUSH_HANDLE", operands: [64], offset: 32, size: 4 });
    expect(instructions[10]).toMatchObject({ opcode: "SCREEN_START", operands: [], offset: 36, size: 1 });
    expect(instructions[11]).toMatchObject({ opcode: "LINE", operands: [], offset: 37, size: 1 });
    expect(instructions[12]).toMatchObject({ opcode: "ITEM", operands: [], offset: 38, size: 1 });
    expect(instructions[13]).toMatchObject({ opcode: "STATE", operands: [], offset: 39, size: 1 });
    expect(instructions[14]).toMatchObject({ opcode: "UNKNOWN", operands: [], offset: 40, size: 1 });
  });
});
