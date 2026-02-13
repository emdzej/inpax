import { describe, it, expect } from "vitest";
import { parseFileHeader } from "../file-header.js";

describe("parseFileHeader", () => {
  it("should parse file header from buffer", () => {
    const data = new Uint8Array([
      0x05, 0x00, 0x54, 0x45, 0x53, 0x54, 0x2D, 0x49, 0x6E, 0x66, 0x6F, 0x74, 0x65, 0x78, 0x74, 0x0A,
    ]);
    const result = parseFileHeader(data);

    expect(result.result.version).toEqual([5, 0]);
    expect(result.result.magic).toBe("TEST-Infotext");
    expect(result.offset).toBe(0x10);
  });

  it("should throw error if buffer is too small", () => {
    const data = new Uint8Array([
      0x05, 0x00
    ]);
    expect(() => parseFileHeader(data)).toThrow("Buffer too small to contain IPO header");
  })

  it("should throw error if version bytes are unsupported", () => {
    const data = new Uint8Array([
      0x05, 0x02, 0x54, 0x45, 0x53, 0x54, 0x2D, 0x49, 0x6E, 0x66, 0x6F, 0x74, 0x65, 0x78, 0x74, 0x0A,
    ]);
    expect(() => parseFileHeader(data)).toThrow("Unsupported IPO version bytes: 5 2");
  })

  it("should throw error if magic string is incorrect", () => {
    const data = new Uint8Array([
      0x05, 0x00, 0x54, 0x44, 0x53, 0x54, 0x2D, 0x49, 0x6E, 0x66, 0x6F, 0x74, 0x65, 0x78, 0x74, 0x0A,
    ]);
    expect(() => parseFileHeader(data)).toThrow("Invalid IPO magic string. Found \"TDST-Infotext\", expected \"TEST-Infotext\" at offset 0x00");
  })

});
