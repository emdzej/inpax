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

  it("parses CONTROL sections in CTRL02.ipo (single CONTROL block)", () => {
    const buffer = loadFixture("CTRL02.ipo");
    const result = parseIpo(buffer);

    expect(result.header.magic).toBe("TEST-Infotext\n");
    assertCoreSections(result.sections);

    // Should have screen section
    expect(result.sections.has("s_control")).toBe(true);
    expect(result.sections.get("s_control")?.type).toBe("screen");

    // Should have LINE body function
    expect(result.sections.has("!")).toBe(true);
    expect(result.sections.get("!")?.type).toBe("function");

    // Should have CONTROL section (named "#")
    expect(result.sections.has("#")).toBe(true);
    expect(result.sections.get("#")?.type).toBe("control");
  });

  it("parses multiple CONTROL sections in CTRL03.ipo", () => {
    const buffer = loadFixture("CTRL03.ipo");
    const result = parseIpo(buffer);

    expect(result.header.magic).toBe("TEST-Infotext\n");
    assertCoreSections(result.sections);

    // Should have screen section
    expect(result.sections.has("s_multi")).toBe(true);
    expect(result.sections.get("s_multi")?.type).toBe("screen");

    // Should have LINE body function
    expect(result.sections.has("!")).toBe(true);
    expect(result.sections.get("!")?.type).toBe("function");

    // Should have two CONTROL sections (named "#" and "#_2")
    expect(result.sections.has("#")).toBe(true);
    expect(result.sections.get("#")?.type).toBe("control");

    expect(result.sections.has("#_2")).toBe(true);
    expect(result.sections.get("#_2")?.type).toBe("control");

    // Count control sections
    const controlSections = Array.from(result.sections.values()).filter(
      (s) => s.type === "control"
    );
    expect(controlSections.length).toBe(2);
  });
});
