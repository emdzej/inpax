import type { IpoHeader } from "./types.js";

const MAGIC_STRING = "TEST-Infotext\n";
const MAGIC_OFFSET = 2;
const SUPPORTED_VERSIONS = new Set(["5:0", "1:2", "1:3"]);

const textDecoder = new TextDecoder("ascii");

export function parseHeader(buffer: Uint8Array): IpoHeader {
  if (buffer.length < MAGIC_OFFSET + MAGIC_STRING.length) {
    throw new Error("Buffer too small to contain IPO header");
  }

  const version: [number, number] = [buffer[0], buffer[1]];
  const versionKey = `${version[0]}:${version[1]}`;

  if (!SUPPORTED_VERSIONS.has(versionKey)) {
    throw new Error(`Unsupported IPO version bytes: ${version[0]} ${version[1]}`);
  }

  const magicBytes = buffer.slice(
    MAGIC_OFFSET,
    MAGIC_OFFSET + MAGIC_STRING.length
  );
  const magic = textDecoder.decode(magicBytes);

  if (magic !== MAGIC_STRING) {
    throw new Error("Invalid IPO magic string");
  }

  return {
    version,
    magic
  };
}
