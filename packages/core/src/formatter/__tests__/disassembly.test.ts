import { describe, it, expect } from "vitest";
import { decodeInstructions } from "../../parser/opcode-decoder.js";
import { formatDisassembly, formatInstruction } from "../disassembly.js";
import type { Instruction } from "../../parser/types.js";

const bytes = (...values: number[]): Uint8Array => Uint8Array.from(values);

describe("formatInstruction", () => {
  it("formats CALL_API with resolved system function name", () => {
    const instruction: Instruction = {
      offset: 0x42,
      opcode: "CALL_API",
      operands: [0x60],
      raw: bytes(0x0c, 0x81, 0x60, 0x00),
      size: 4
    };

    expect(formatInstruction(instruction)).toBe(
      "0x0042: CALL_API    INPAapiInit (0x60)"
    );
  });
});

describe("formatDisassembly", () => {
  it("formats multiple instructions with raw bytes", () => {
    const buffer = bytes(
      0x01, 0x2a, 0x00, // PUSH_VAR_ADDR 42
      0x00, 0x05, // STORE
      0x0c, 0x81, 0x60, 0x00 // CALL_API 96
    );

    const instructions = decodeInstructions(buffer);
    const output = formatDisassembly(instructions, {
      showOffset: false,
      showRawBytes: true,
      resolveNames: false
    });

    expect(output.split("\n")).toEqual([
      "01 2a 00    PUSH_VAR_ADDR 0x2a",
      "00 05       STORE",
      "0c 81 60 00 CALL_API    0x60"
    ]);
  });
});
