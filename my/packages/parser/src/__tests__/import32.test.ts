import { describe, it, expect } from "vitest";
import { parseImport32 } from "../import32.js";

describe("parseImport32", () => {
  it("parses kernel32 GetPrivateProfileStringA signature", () => {
    const result = parseImport32(
      "kernel32::GetPrivateProfileStringA:c.sssSis%I"
    );

    expect(result).toEqual({
      dll: "kernel32",
      functionName: "GetPrivateProfileStringA",
      convention: "c",
      parameters: [
        { type: "string", direction: "in", raw: "s" },
        { type: "string", direction: "in", raw: "s" },
        { type: "string", direction: "in", raw: "s" },
        { type: "string", direction: "out", raw: "S" },
        { type: "int", direction: "in", raw: "i" },
        { type: "string", direction: "in", raw: "s" }
      ],
      returnType: "int",
      rawSignature: "kernel32::GetPrivateProfileStringA:c.sssSis%I"
    });
  });

  it("parses api32 config signature", () => {
    const result = parseImport32("api32.DLL::__apiGetConfig:c.lsS%I");

    expect(result.dll).toBe("api32.DLL");
    expect(result.functionName).toBe("__apiGetConfig");
    expect(result.convention).toBe("c");
    expect(result.returnType).toBe("int");
    expect(result.parameters).toEqual([
      { type: "long", direction: "in", raw: "l" },
      { type: "string", direction: "in", raw: "s" },
      { type: "string", direction: "out", raw: "S" }
    ]);
  });

  it("keeps unknown parameters as unknown", () => {
    const result = parseImport32("kernel32::OpenFile:c.stLi%I");

    expect(result.parameters).toEqual([
      { type: "string", direction: "in", raw: "s" },
      { type: "unknown", direction: "in", raw: "t" },
      { type: "unknown", direction: "in", raw: "L" },
      { type: "int", direction: "in", raw: "i" }
    ]);
  });

  it("defaults to void return type when %I is missing", () => {
    const result = parseImport32("XTRACT32.DLL::XTRACT:c.siSl");

    expect(result.returnType).toBe("void");
  });
});
