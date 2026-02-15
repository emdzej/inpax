import { off } from "process";
import { parseSectionHeader } from "./common.js";
import { DataTypeMarker, DataTypeMarkers, SectionTypeMarkers, type Constant, type ConstantData, type ParseResult } from "./types.js";
import { containsValue, withOffsetSuffix, parseString } from "./utils.js";


export function parseConstant(buffer: Uint8Array, startOffset: number): ParseResult<Constant> {
  var offset = startOffset;
  const typeCandidate = buffer[offset];
  const type = typeCandidate as DataTypeMarker;
  offset += 1; // Move past type marker to the value
  switch (type) {
     case DataTypeMarkers.BOOL: {
      return {
        result: {
          type: 0x01,
          value: buffer[offset] === 0x01,
          offset: startOffset
        },
        offset: offset + 1
      }
    }
    case DataTypeMarkers.STRING: {
      const valueResult = parseString(buffer, offset);
      return {
        result: {
          type: 0x06,
          value: valueResult.result || "",
          offset: startOffset
        },
        offset: valueResult.offset
      }
    }
    case DataTypeMarkers.BYTE: {
      return {
        result: {
          type: 0x02,
          value: buffer[offset],
          offset: startOffset
        },
        offset: offset + 1
      }
    }
    case DataTypeMarkers.INT: {
      const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      return {
        result: {
          type: 0x03,
          value: view.getUint16(offset, true),
          offset: startOffset
        },
        offset: offset + 2
      }
    }
    case DataTypeMarkers.LONG: {
      const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      return {
        result: {
          type: 0x04,
          value: view.getUint32(offset, true),
          offset: startOffset
        },
        offset: offset + 4
      }
    }
    case DataTypeMarkers.REAL: {
      const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      return {
        result: {
          type: 0x05,
          value: view.getFloat64(offset, true),
          offset: startOffset
        },
        offset: offset + 8
      }
    }
    default: throw new Error(withOffsetSuffix(`Unsupported Constant Data type marker: 0x${type.toString(16)}`, offset));
  }
}

export const parseConstantData = (buffer: Uint8Array, startOffset: number): ParseResult<ConstantData> => {
  var offset = startOffset;
  const headerResult = parseSectionHeader(buffer, offset, SectionTypeMarkers.CONSTANTS);
  offset = headerResult.offset;
  const constants: Constant[] = [];
  for (var index = 0; index < headerResult.result.size; index += 1) {
    const constantResult = parseConstant(buffer, offset);
    constants.push(constantResult.result);
    offset = constantResult.offset;
  }

  return {
    result: {
      ...headerResult.result,
      constants
    },
    offset
  };
};
