import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseConstantData } from "../constant-data.js";

const FIXTURES_DIR = join(import.meta.dirname, "fixtures");

describe("parseConstantData", () => {
  it("should parse constant data from startus.ipo", () => {
    const buffer = readFileSync(join(FIXTURES_DIR, "startus.ipo"));
    const result = parseConstantData(new Uint8Array(buffer));

    expect(result.constants.length).toBeGreaterThan(0);
    expect(result.constants.length).toBe(724);

    // First constant should be 'inpa.h'
    expect(result.constants[0]).toEqual({ type: "string", value: "inpa.h" });
    
    // Second constant should be 'BMW_STD.H'
    expect(result.constants[1]).toEqual({ type: "string", value: "BMW_STD.H" });

    // Check various types exist
    const types = new Set(result.constants.map((c) => c.type));
    expect(types.has("string")).toBe(true);
    expect(types.has("int")).toBe(true);
    expect(types.has("bool")).toBe(true);
  });

  it("should parse constant data from S_FUNK_I.IPO", () => {
    const buffer = readFileSync(join(FIXTURES_DIR, "S_FUNK_I.IPO"));
    const result = parseConstantData(new Uint8Array(buffer));

    expect(result.constants.length).toBeGreaterThan(0);
    
    // All constants should have valid types
    for (const constant of result.constants) {
      expect(["string", "int", "real", "bool"]).toContain(constant.type);
    }
  });
});
