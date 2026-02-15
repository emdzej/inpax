import { parseSectionHeader } from "./common.js";
import { DataTypeMarker, DataTypeMarkers, GlobalData, ParseResult, SectionTypeMarkers } from "./types.js";
import { containsValue, withOffsetSuffix } from "./utils.js";


export const parseGlobalData = (buffer: Uint8Array, startOffset: number): ParseResult<GlobalData> => {
  var offset = startOffset;
  const headerResult = parseSectionHeader(buffer, offset, SectionTypeMarkers.GLOBAL_VARIABLES);
  offset = headerResult.offset;
  const variables: DataTypeMarker[] = [];
  for (var index = 0; index < headerResult.result.size; index += 1) {
      const typeCandidate = buffer[offset];
      if (!containsValue(DataTypeMarkers, typeCandidate)) {
        throw new Error(withOffsetSuffix(`Unknown Global Data type marker: 0x${typeCandidate.toString(16)}`, offset));
      }
      variables.push(typeCandidate as DataTypeMarker);
      offset += 1;
  }

  return {
    result: {
      ...headerResult.result,
      variables
    },
    offset
  };
};
