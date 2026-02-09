import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { parseGlobalData } from "../global-data.js";
import type { VariableType } from "../types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "fixtures");

const loadFixture = (name: string): Buffer =>
  readFileSync(path.join(fixturesDir, name));

const countTypes = (types: readonly VariableType[]): Record<VariableType, number> =>
  types.reduce(
    (acc, type) => ({
      ...acc,
      [type]: (acc[type] ?? 0) + 1
    }),
    {
      bool: 0,
      byte: 0,
      int: 0,
      real: 0,
      string: 0
    }
  );

describe("parseGlobalData", () => {
  it("parses global data for S_FUNK_I.IPO", () => {
    const buffer = loadFixture("S_FUNK_I.IPO");
    const result = parseGlobalData(buffer);

    expect(result.count).toBe(6);
    expect(result.variables).toHaveLength(6);
    expect(new Set(result.variables)).toEqual(new Set(["string"]));
  });

  it("parses global data for startus.ipo", () => {
    const buffer = loadFixture("startus.ipo");
    const result = parseGlobalData(buffer);

    expect(result.count).toBe(67);
    expect(result.variables).toHaveLength(67);
    expect(countTypes(result.variables)).toEqual({
      bool: 1,
      byte: 1,
      int: 1,
      real: 0,
      string: 64
    });
  });
});
