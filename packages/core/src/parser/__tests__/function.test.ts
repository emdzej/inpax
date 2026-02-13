import { describe, it, expect } from "vitest";
import { parseFunction } from "../function.js";

describe("parseFunction", () => {
  it("should correctly parse section", () => {
    const data = new Uint8Array([
      0x05, 0x69, 0x6E, 0x70, 0x61, 0x65, 0x78, 0x69,
      0x74, 0x0A, 0x03, 0x00, 0x00, 0x00, 0x0A, 0x0A,
      0x00, 0x01, 0x00, 0x0E, 0x00, 0x00, 0x00,
    ]);

    const result = parseFunction(data, 0);
    expect(result.result.type).toBe(0x05);
    expect(result.result.name).toBe("inpaexit");
    expect(result.result.id).toBe(3);
    expect(result.result.flags).toBe(0);
    expect(result.result.arg1).toBeUndefined();
    expect(result.result.arg2).toBeUndefined();
    expect(result.result.size).toBe(1);
    expect(result.result.instructions).toEqual([
      {
        raw: new Uint8Array([0x0E, 0x00, 0x00, 0x00]),
        offset: 19,
      },
    ]);
  });
});
