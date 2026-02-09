import { describe, it, expect } from "vitest";
import { parseImport32 } from "../import32.js";

describe("parseImport32", () => {
  it("parses kernel32 GetPrivateProfileStringA signature", () => {
    const result = parseImport32(
      "kernel32::GetPrivateProfileStringA:c.sssSis%I"
    );

    expect(result).toEqual({
      dll: "kernel32",
      function: "GetPrivateProfileStringA",
      convention: "c",
      params: [
        { type: "string", direction: "in", signature: "s" },
        { type: "string", direction: "in", signature: "s" },
        { type: "string", direction: "in", signature: "s" },
        { type: "string", direction: "out", signature: "S" },
        { type: "int", direction: "in", signature: "i" },
        { type: "string", direction: "in", signature: "s" }
      ],
      returnType: "int"
    });
  });

  it("parses api32.DLL __apiGetConfig signature", () => {
    const result = parseImport32("api32.DLL::__apiGetConfig:c.lsS%I");

    expect(result.dll).toBe("api32.DLL");
    expect(result.function).toBe("__apiGetConfig");
    expect(result.convention).toBe("c");
    expect(result.params).toEqual([
      { type: "long", direction: "in", signature: "l" },
      { type: "string", direction: "in", signature: "s" },
      { type: "string", direction: "out", signature: "S" }
    ]);
    expect(result.returnType).toBe("int");
  });

  it("marks unknown parameter types", () => {
    const result = parseImport32("kernel32::OpenFile:c.stLi%I");

    expect(result.params).toEqual([
      { type: "string", direction: "in", signature: "s" },
      { type: "unknown", direction: "unknown", signature: "t" },
      { type: "unknown", direction: "unknown", signature: "L" },
      { type: "int", direction: "in", signature: "i" }
    ]);
    expect(result.returnType).toBe("int");
  });
});
