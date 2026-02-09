import type { GlobalData, VariableType } from "./types.js";

const textEncoder = new TextEncoder();

const GLOBAL_DATA_MARKER = textEncoder.encode("Global Data\n");
const GLOBAL_DATA_PREAMBLE = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x0a, 0x0a, 0x00]);
const GLOBAL_DATA_HEADER = new Uint8Array([0x01, 0x00, 0x04]);

const TypeMarkers = {
  BOOL: 0x01,
  INT: 0x03,
  BYTE: 0x04,
  REAL: 0x05,
  STRING: 0x06,
  STRING_ALT: 0x12
} as const;

type TypeMarker = (typeof TypeMarkers)[keyof typeof TypeMarkers];

const TYPE_MARKER_SET = new Set<number>(Object.values(TypeMarkers));

const findSequence = (buffer: Uint8Array, sequence: Uint8Array): number => {
  const lastStart = buffer.length - sequence.length;
  for (let offset = 0; offset <= lastStart; offset += 1) {
    let matches = true;
    for (let index = 0; index < sequence.length; index += 1) {
      if (buffer[offset + index] !== sequence[index]) {
        matches = false;
        break;
      }
    }

    if (matches) {
      return offset;
    }
  }

  return -1;
};

const matchesSequence = (
  buffer: Uint8Array,
  offset: number,
  sequence: Uint8Array
): boolean => {
  if (offset + sequence.length > buffer.length) {
    return false;
  }

  for (let index = 0; index < sequence.length; index += 1) {
    if (buffer[offset + index] !== sequence[index]) {
      return false;
    }
  }

  return true;
};

const isTypeMarker = (value: number): value is TypeMarker =>
  TYPE_MARKER_SET.has(value);

const toVariableType = (marker: number): VariableType => {
  switch (marker) {
    case TypeMarkers.BOOL:
      return "bool";
    case TypeMarkers.INT:
      return "int";
    case TypeMarkers.BYTE:
      return "byte";
    case TypeMarkers.REAL:
      return "real";
    case TypeMarkers.STRING:
    case TypeMarkers.STRING_ALT:
      return "string";
    default:
      throw new Error(`Unknown global variable type marker: 0x${marker.toString(16)}`);
  }
};

const resolveHeaderSize = (buffer: Uint8Array, offset: number): number => {
  if (matchesSequence(buffer, offset, GLOBAL_DATA_HEADER)) {
    return GLOBAL_DATA_HEADER.length;
  }

  if (buffer[offset] === 0x00 && isTypeMarker(buffer[offset + 1])) {
    return 1;
  }

  if (isTypeMarker(buffer[offset])) {
    return 0;
  }

  return -1;
};

export const parseGlobalData = (buffer: Uint8Array): GlobalData => {
  const markerOffset = findSequence(buffer, GLOBAL_DATA_MARKER);
  if (markerOffset === -1) {
    throw new Error("Global Data marker not found");
  }

  let offset = markerOffset + GLOBAL_DATA_MARKER.length;
  if (!matchesSequence(buffer, offset, GLOBAL_DATA_PREAMBLE)) {
    throw new Error("Global Data preamble not found");
  }

  offset += GLOBAL_DATA_PREAMBLE.length;
  if (offset + 2 > buffer.length) {
    throw new Error("Global Data section is truncated before variable count");
  }

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const count = view.getUint16(offset, true);
  offset += 2;

  const headerSize = resolveHeaderSize(buffer, offset);
  if (headerSize === -1) {
    throw new Error("Global Data header is not recognized");
  }

  offset += headerSize;
  if (offset + count > buffer.length) {
    throw new Error("Global Data section is truncated before variable types");
  }

  const variables: VariableType[] = [];
  for (let index = 0; index < count; index += 1) {
    const marker = buffer[offset + index];
    variables.push(toVariableType(marker));
  }

  return {
    count,
    variables
  };
};
