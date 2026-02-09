import type { Constant, ConstantData } from "./types.js";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("ascii");

const CONSTANT_DATA_MARKER = textEncoder.encode("Constant Data\n");
const CONSTANT_DATA_PREAMBLE = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x0a, 0x0a, 0x00]);

const TypeMarkers = {
  BOOL: 0x01,
  CHAR: 0x02,
  INT: 0x03,
  BYTE: 0x04,
  REAL: 0x05,
  STRING: 0x06
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

const isPrintableAscii = (byte: number): boolean => byte >= 0x20 && byte <= 0x7e;

const isSectionPreamble = (buffer: Uint8Array, offset: number): boolean => {
  if (offset + 7 > buffer.length) {
    return false;
  }

  return (
    buffer[offset + 1] === 0x00 &&
    buffer[offset + 2] === 0x00 &&
    buffer[offset + 3] === 0x00 &&
    buffer[offset + 4] === 0x0a &&
    buffer[offset + 5] === 0x0a &&
    buffer[offset + 6] === 0x00
  );
};

const findNextSectionOffset = (buffer: Uint8Array, startOffset: number): number => {
  let index = startOffset;
  while (index < buffer.length) {
    if (!isPrintableAscii(buffer[index])) {
      index += 1;
      continue;
    }

    let end = index;
    while (end < buffer.length && isPrintableAscii(buffer[end])) {
      end += 1;
    }

    if (end < buffer.length && buffer[end] === 0x0a) {
      if (isSectionPreamble(buffer, end + 1)) {
        return index;
      }
    }

    index = end + 1;
  }

  return buffer.length;
};

const findByte = (
  buffer: Uint8Array,
  value: number,
  start: number,
  end: number
): number => {
  for (let index = start; index < end; index += 1) {
    if (buffer[index] === value) {
      return index;
    }
  }

  return -1;
};

export const parseConstantData = (buffer: Uint8Array): ConstantData => {
  const markerOffset = findSequence(buffer, CONSTANT_DATA_MARKER);
  if (markerOffset === -1) {
    throw new Error("Constant Data marker not found");
  }

  let offset = markerOffset + CONSTANT_DATA_MARKER.length;
  if (!matchesSequence(buffer, offset, CONSTANT_DATA_PREAMBLE)) {
    throw new Error("Constant Data preamble not found");
  }

  offset += CONSTANT_DATA_PREAMBLE.length;
  const endOffset = findNextSectionOffset(buffer, offset);

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const constants: Constant[] = [];

  let expectedCount: number | null = null;
  if (!TYPE_MARKER_SET.has(buffer[offset])) {
    if (offset + 2 > endOffset) {
      throw new Error("Constant Data count value is truncated");
    }

    expectedCount = view.getUint16(offset, true);
    offset += 2;
  }

  const parseNext = (): void => {
    const marker = buffer[offset];

    if (marker === TypeMarkers.STRING) {
      const end = findByte(buffer, 0x0a, offset + 1, endOffset);
      if (end === -1) {
        throw new Error("Constant Data string is not terminated");
      }

      const valueBytes = buffer.slice(offset + 1, end);
      const value = textDecoder.decode(valueBytes);
      constants.push({
        type: "string",
        value
      });

      offset = end + 1;
      return;
    }

    if (marker === TypeMarkers.CHAR) {
      if (offset + 2 > endOffset) {
        throw new Error("Constant Data char value is truncated");
      }

      const value = view.getUint8(offset + 1);
      constants.push({
        type: "int",
        value
      });

      offset += 2;
      return;
    }

    if (marker === TypeMarkers.INT) {
      if (offset + 3 > endOffset) {
        throw new Error("Constant Data int value is truncated");
      }

      const value = view.getUint16(offset + 1, true);
      constants.push({
        type: "int",
        value
      });

      offset += 3;
      return;
    }

    if (marker === TypeMarkers.BYTE) {
      if (offset + 5 > endOffset) {
        throw new Error("Constant Data byte value is truncated");
      }

      const value = view.getUint32(offset + 1, true);
      constants.push({
        type: "int",
        value
      });

      offset += 5;
      return;
    }

    if (marker === TypeMarkers.REAL) {
      if (offset + 9 > endOffset) {
        throw new Error("Constant Data real value is truncated");
      }

      const value = view.getFloat64(offset + 1, true);
      constants.push({
        type: "real",
        value
      });

      offset += 9;
      return;
    }

    if (marker === TypeMarkers.BOOL) {
      if (offset + 2 > endOffset) {
        throw new Error("Constant Data bool value is truncated");
      }

      const byte = buffer[offset + 1];
      if (byte !== 0x00 && byte !== 0x01) {
        throw new Error(`Constant Data bool value is invalid: 0x${byte.toString(16)}`);
      }

      constants.push({
        type: "bool",
        value: byte === 0x01
      });

      offset += 2;
      return;
    }

    throw new Error(`Unknown Constant Data marker: 0x${marker.toString(16)}`);
  };

  if (expectedCount !== null) {
    for (let index = 0; index < expectedCount; index += 1) {
      if (offset >= endOffset) {
        throw new Error("Constant Data section ended before expected count");
      }

      parseNext();
    }
  } else {
    while (offset < endOffset) {
      if (!TYPE_MARKER_SET.has(buffer[offset])) {
        break;
      }

      parseNext();
    }
  }

  return {
    constants
  };
};
