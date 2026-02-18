import { ParseResult, FileHeader, parseString, withOffsetSuffix } from "@inpax/core";

const MAGIC_STRING = "TEST-Infotext";
const MAGIC_OFFSET = 0x02;
const SUPPORTED_VERSIONS = new Set(["5:0", "1:2", "1:3"]);

export function parseFileHeader(buffer: Uint8Array, startOffset: number = 0x00): ParseResult<FileHeader> {
  if (buffer.length < startOffset + MAGIC_OFFSET + MAGIC_STRING.length) {
    throw new Error("Buffer too small to contain IPO header");
  }
  var offset = startOffset
  const version: [number, number] = [buffer[offset], buffer[offset + 1]];
  const versionKey = `${version[0]}:${version[1]}`;

  if (!SUPPORTED_VERSIONS.has(versionKey)) {
    throw new Error(`Unsupported IPO version bytes: ${version[0]} ${version[1]}`);
  }

  const magicResult = parseString(buffer, offset + MAGIC_OFFSET);
  const magic = magicResult.result;

  if (magic !== MAGIC_STRING) {
    throw new Error(
      withOffsetSuffix(`Invalid IPO magic string. Found "${magic}", expected "${MAGIC_STRING}"`, offset)
    );
  }

  offset = magicResult.offset;

  return {
    result: {
      offset,
      version,
      magic
    },
    offset
  };
}
