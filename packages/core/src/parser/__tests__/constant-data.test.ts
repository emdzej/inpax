import { describe, it, expect } from "vitest";
import { parseConstantData } from "../constant-data.js";

describe("parseConstantData", () => {
  it("should correctly parse section", () => {
    const data = new Uint8Array([
      0x12, 0x43, 0x6F, 0x6E, 0x73, 0x74, 0x61, 0x6E,
      0x74, 0x20, 0x44, 0x61, 0x74, 0x61, 0x0A, 0x00,
      0x00, 0x00, 0x00, 0x0A, 0x0A, 0x00, 0x06, 0x00,
      0x01, 0x01, 0x02, 0x01, 0x03, 0x02, 0x00,
      0x04, 0x03, 0x00, 0x00, 0x00, 0x05, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10, 0x40, 0x06, 0x66,
      0x0A,
    ]);

    const result = parseConstantData(data, 0);
    expect(result.result.type).toBe(0x12);
    expect(result.result.name).toBe("Constant Data");
    expect(result.result.id).toBe(0);
    expect(result.result.flags).toBe(0);
    expect(result.result.arg1).toBeUndefined();
    expect(result.result.arg2).toBeUndefined();
    expect(result.result.size).toBe(6);
    expect(result.result.constants.length).toBe(6);    
    expect(result.result.constants[0]).toEqual({ type: 0x01, value: true, offset: 24 });
    expect(result.result.constants[1]).toEqual({ type: 0x02, value: 1, offset: 26 });
    expect(result.result.constants[2]).toEqual({ type: 0x03, value: 2, offset: 28 });
    expect(result.result.constants[3]).toEqual({ type: 0x04, value: 3, offset: 31 });
    expect(result.result.constants[4]).toEqual({ type: 0x05, value: 4, offset: 36 });
    expect(result.result.constants[5]).toEqual({ type: 0x06, value: "f", offset: 45 });
    expect(result.offset).toBe(48);
  });
});
