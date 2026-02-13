import { describe, it, expect } from "vitest";

import { parseString } from "../utils.js";

describe("parseString", () => {
  it("should return the correct string and offset", () => {
    const data = new Uint8Array([
      0x69, 0x6E, 0x70, 0x61, 0x69, 0x6E, 0x69, 0x74, 0x0A, 
    ]);
    const result = parseString(data, 0);

    expect(result.result).toBe("inpainit");
    expect(result.offset).toBe(0x09);
  });

  it("should return undefined and the correct offset when no string is found", () => {
    const data = new Uint8Array([
      0x0A, 
    ]);
    const result = parseString(data, 0);

    expect(result.result).toBeUndefined();
    expect(result.offset).toBe(1);
  });
});
