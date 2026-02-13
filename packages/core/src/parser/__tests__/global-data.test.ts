import { describe, it, expect } from "vitest";
import { parseGlobalData } from "../global-data.js";

describe("parseGlobalData", () => {
  it("should correctly parse section", () => {
    const data = new Uint8Array([
      0x11, 0x47, 0x6C, 0x6F, 0x62, 0x61, 0x6C, 0x20, 0x44, 0x61, 0x74, 0x61, 0x0A, 0x00, 0x00, 0x00,
      0x00, 0x0A, 0x0A, 0x00, 0x03, 0x00, 0x00, 0x02, 0x03,
    ]);

    const result = parseGlobalData(data, 0);
    expect(result.result.type).toBe(0x11);
    expect(result.result.name).toBe("Global Data");
    expect(result.result.id).toBe(0);
    expect(result.result.flags).toBe(0);
    expect(result.result.arg1).toBeUndefined();
    expect(result.result.arg2).toBeUndefined();
    expect(result.result.size).toBe(3);
    expect(result.result.variables).toEqual([0x00, 0x02, 0x03]);
  });
});
