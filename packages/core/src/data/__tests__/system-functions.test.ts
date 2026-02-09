import { describe, expect, it } from "vitest";
import { getSystemFunction, systemFunctions, systemFunctionById } from "../system-functions.js";

describe("system functions", () => {
  it("should expose all 159 functions", () => {
    expect(systemFunctions).toHaveLength(159);
    expect(systemFunctionById.size).toBe(159);
  });

  it("should resolve known IDs", () => {
    expect(getSystemFunction(0x48)).toMatchObject({
      id: 0x48,
      name: "text",
      signature: "(in: int row, in: int col, in: string text)"
    });

    expect(getSystemFunction(0x04)).toMatchObject({
      id: 0x04,
      name: "setscreen",
      signature: "(in: SCREEN handle, in: bool cyclic)"
    });
  });

  it("should return undefined for unknown IDs", () => {
    expect(getSystemFunction(0x19)).toBeUndefined();
  });
});
