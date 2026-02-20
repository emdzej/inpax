import { describe, it, expect } from "vitest";
import { parseSectionHeader } from "../common.js";

describe("parseSectionHeader", () => {
  it("should correctly parse section with name, id and length", () => {
    const data = new Uint8Array([
      0x05, 0x69, 0x6E, 0x70, 0x61, 0x69, 0x6E, 0x69,
      0x74, 0x0A, 0x02, 0x00, 0x00, 0x00, 0x0A, 0x0A,
      0x00, 0x0C, 0x00,
    ]);

    const result = parseSectionHeader(data, 0, 0x05);
    expect(result.result.type).toBe(0x05);
    expect(result.result.name).toBe("inpainit");
    expect(result.result.id).toBe(2);
    expect(result.result.flags).toBe(0);
    expect(result.result.arg1).toBeUndefined();
    expect(result.result.arg2).toBeUndefined();
    expect(result.result.size).toBe(12);
    expect(result.offset).toBe(19);
  });

  it("should correctly parse section with no name", () => {
    const data = new Uint8Array([
      0x21, 0x0A, 0x00, 0x00, 0x00, 0x00, 0x0A, 0x0A, 0x00, 0x02, 0x00,
    ]);

    const result = parseSectionHeader(data, 0, 0x21);
    expect(result.result.type).toBe(0x21);
    expect(result.result.name).toBeUndefined();
    expect(result.result.id).toBe(0);
    expect(result.result.flags).toBe(0);
    expect(result.result.arg1).toBeUndefined();
    expect(result.result.arg2).toBeUndefined();
    expect(result.result.size).toBe(2);
    expect(result.offset).toBe(11);
  });

  it("should correctly parse section with flags and arg1", () => {
    const data = new Uint8Array([
      0x24, 0x0A, 0x00, 0x00, 0x01, 0x00, 0x46, 0x31, 0x20, 0x4C, 0x61, 0x62, 0x65, 0x6C, 0x0A, 0x0A,
      0x00, 0x02, 0x00,
    ]);

    const result = parseSectionHeader(data, 0, 0x24);
    expect(result.result.type).toBe(0x24);
    expect(result.result.name).toBeUndefined();
    expect(result.result.id).toBe(0);
    expect(result.result.flags).toBe(1);
    expect(result.result.arg1).toBe("F1 Label");
    expect(result.result.arg2).toBeUndefined();
    expect(result.result.size).toBe(2);
    expect(result.offset).toBe(19);
  });
});
