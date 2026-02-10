import { describe, it, expect } from "vitest";
import { decodeInstructions } from "../opcode-decoder.js";

const bytes = (...values: number[]): Uint8Array => Uint8Array.from(values);

describe("decodeInstructions", () => {
  it("should decode known opcodes and preserve offsets", () => {
    const buffer = bytes(
      0x01, 0x00, 0x2a, 0x00, // PUSH_VAR_ADDR global[42]
      0x07, 0x01, 0x01, 0x00, // PUSH_VAR_VAL local[1]
      0x00, 0x06, 0x02, 0x00, // PUSH_CONST 2
      0x00, 0x05, // STORE
      0x00, 0x09, 0x60, // ALU_OP +
      0x00, 0x0b, 0xfe, 0xff, // JMP_FALSE -2
      0x00, 0x0e, 0x04, 0x00, // JMP 4
      0x0c, 0x80, 0x10, 0x00, // CALL_USER 16
      0x0c, 0x81, 0x48, 0x00, // CALL_API 72
      0x02, 0x40, 0x00, 0x00, // PUSH_UI_HANDLE 64
      0x21, // SCREEN_START
      0x22, // LINE
      0x24, // ITEM
      0x25, // STATE
      0x08, 0x51, 0x00, 0x00, // FUNC_PROLOGUE
      0xff // UNKNOWN
    );

    const instructions = decodeInstructions(buffer);

    expect(instructions).toHaveLength(16);
    expect(instructions[0]).toMatchObject({ opcode: "PUSH_VAR_ADDR", operands: [42], offset: 0, size: 4, scope: "global" });
    expect(instructions[1]).toMatchObject({ opcode: "PUSH_VAR_VAL", operands: [1], offset: 4, size: 4, scope: "local" });
    expect(instructions[2]).toMatchObject({ opcode: "PUSH_CONST", operands: [2], offset: 8, size: 4 });
    expect(instructions[3]).toMatchObject({ opcode: "STORE", operands: [], offset: 12, size: 2 });
    expect(instructions[4]).toMatchObject({ opcode: "ALU_OP", operands: [0x60], offset: 14, size: 3 });
    expect(instructions[5]).toMatchObject({ opcode: "JMP_FALSE", operands: [-2], offset: 17, size: 4 });
    expect(instructions[6]).toMatchObject({ opcode: "JMP", operands: [4], offset: 21, size: 4 });
    expect(instructions[7]).toMatchObject({ opcode: "CALL_USER", operands: [16], offset: 25, size: 4 });
    expect(instructions[8]).toMatchObject({ opcode: "CALL_API", operands: [72], offset: 29, size: 4 });
    expect(instructions[9]).toMatchObject({ opcode: "PUSH_UI_HANDLE", operands: [64], offset: 33, size: 4 });
    expect(instructions[10]).toMatchObject({ opcode: "SCREEN_START", operands: [], offset: 37, size: 1 });
    expect(instructions[11]).toMatchObject({ opcode: "LINE", operands: [], offset: 38, size: 1 });
    expect(instructions[12]).toMatchObject({ opcode: "ITEM", operands: [], offset: 39, size: 1 });
    expect(instructions[13]).toMatchObject({ opcode: "STATE", operands: [], offset: 40, size: 1 });
    expect(instructions[14]).toMatchObject({ opcode: "FUNC_PROLOGUE", operands: [], offset: 41, size: 4 });
    expect(instructions[15]).toMatchObject({ opcode: "UNKNOWN", operands: [], offset: 45, size: 1 });
  });

  it("should decode scope-based variable addressing", () => {
    const buffer = bytes(
      0x01, 0x00, 0x05, 0x00, // PUSH_VAR_ADDR global[5]
      0x01, 0x01, 0x01, 0x00, // PUSH_VAR_ADDR local[1]
      0x01, 0x02, 0x00, 0x00, // PUSH_VAR_ADDR param[0]
      0x07, 0x00, 0x03, 0x00, // PUSH_VAR_VAL global[3]
      0x07, 0x01, 0x02, 0x00, // PUSH_VAR_VAL local[2]
      0x07, 0x02, 0x01, 0x00  // PUSH_VAR_VAL param[1]
    );

    const instructions = decodeInstructions(buffer);

    expect(instructions).toHaveLength(6);
    expect(instructions[0]).toMatchObject({ opcode: "PUSH_VAR_ADDR", operands: [5], scope: "global" });
    expect(instructions[1]).toMatchObject({ opcode: "PUSH_VAR_ADDR", operands: [1], scope: "local" });
    expect(instructions[2]).toMatchObject({ opcode: "PUSH_VAR_ADDR", operands: [0], scope: "param" });
    expect(instructions[3]).toMatchObject({ opcode: "PUSH_VAR_VAL", operands: [3], scope: "global" });
    expect(instructions[4]).toMatchObject({ opcode: "PUSH_VAR_VAL", operands: [2], scope: "local" });
    expect(instructions[5]).toMatchObject({ opcode: "PUSH_VAR_VAL", operands: [1], scope: "param" });
  });

  it("should decode FUNC_PROLOGUE marker", () => {
    const buffer = bytes(0x08, 0x51, 0x00, 0x00);
    const instructions = decodeInstructions(buffer);

    expect(instructions).toHaveLength(1);
    expect(instructions[0]).toMatchObject({ opcode: "FUNC_PROLOGUE", operands: [], size: 4 });
  });
});
