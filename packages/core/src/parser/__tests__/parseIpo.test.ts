import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { parseInpaFile } from "../index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "fixtures");

const loadFixture = (name: string): Buffer =>
  readFileSync(path.join(fixturesDir, name));


describe("parseIpo", () => {
  it("parses", () => {
    const data = loadFixture("startus.ipo");
    const result = parseInpaFile(data);
    expect(result).toBeDefined();
    console.log(JSON.stringify(result, null, 2));
  });
});
