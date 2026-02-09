import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { parseIpo } from "../index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "fixtures");

const loadFixture = (name: string): Buffer =>
  readFileSync(path.join(fixturesDir, name));

const assertCoreSections = (sections: Map<string, unknown>): void => {
  expect(sections.has("Global Data")).toBe(true);
  expect(sections.has("Constant Data")).toBe(true);
};

describe("parseIpo", () => {
  it("parses header and sections for S_FUNK_I.IPO", () => {
    const buffer = loadFixture("S_FUNK_I.IPO");
    const result = parseIpo(buffer);

    expect(result.header.magic).toBe("TEST-Infotext\n");
    expect(result.header.version.length).toBe(2);

    assertCoreSections(result.sections);

    expect(result.sections.has("inpainit")).toBe(true);
    expect(result.sections.has("inpaexit")).toBe(true);
    expect(result.sections.has("__inpa_startup__")).toBe(true);
    expect(result.sections.has("__inpa_shutdown__")).toBe(true);

    const globalSection = result.sections.get("Global Data");
    const constantSection = result.sections.get("Constant Data");

    expect(globalSection?.type).toBe("global");
    expect(constantSection?.type).toBe("constant");
    expect(globalSection?.size).toBeGreaterThan(0);
    expect(constantSection?.size).toBeGreaterThan(0);

    expect(result.globalData.count).toBeGreaterThan(0);
    expect(result.globalData.variables.length).toBe(result.globalData.count);
  });

  it("parses header and sections for startus.ipo", () => {
    const buffer = loadFixture("startus.ipo");
    const result = parseIpo(buffer);

    expect(result.header.magic).toBe("TEST-Infotext\n");
    assertCoreSections(result.sections);

    const globalSection = result.sections.get("Global Data");
    const constantSection = result.sections.get("Constant Data");

    expect(globalSection?.offset).toBeGreaterThan(0);
    expect(constantSection?.offset).toBeGreaterThan(0);

    expect(result.globalData.count).toBeGreaterThan(0);
    expect(result.globalData.variables.length).toBe(result.globalData.count);
  });
});
