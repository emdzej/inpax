import { parseConstantData } from "./constant-data.js";
import { parseFunction } from "./function.js";
import { parseGlobalData } from "./global-data.js";
import { parseLogicTable } from "./logic-table.js";
import { parseMenu } from "./menu.js";
import { parseScreen } from "./screen.js";
import { parseStateMachine } from "./state-machine.js";
import { type ParseFunction, SectionHeader, type SectionTypeMarker,
  SectionTypeMarkers } from "./types.js";

const textDecoder = new TextDecoder("ascii");

const parsers: Record<SectionTypeMarker, ParseFunction<any>> = {
  [SectionTypeMarkers.SCREEN]: parseScreen,
  [SectionTypeMarkers.MENU]: parseMenu,
  [SectionTypeMarkers.STATE_MACHINE]: parseStateMachine,
  [SectionTypeMarkers.LOGIC_TABLE]: parseLogicTable,
  [SectionTypeMarkers.FUNCTION]: parseFunction,
  [SectionTypeMarkers.GLOBAL_VARIABLES]: parseGlobalData,
  [SectionTypeMarkers.CONSTANTS]: parseConstantData,
}

export function parseSections(buffer: Uint8Array, startOffset: number): SectionHeader[] {
  var offset = startOffset;
  const result: SectionHeader[] = [];
  while (offset < buffer.length) {
    const sectionTypeByte = buffer[offset];
    const parser = parsers[sectionTypeByte as SectionTypeMarker];
    if (!parser) {
      throw new Error(`Unable to parse section of type: 0x${sectionTypeByte.toString(16)} at offset 0x${offset.toString(16)}`);
    }
    const parseResult = parser(buffer, offset);
    result.push(parseResult.result);
    offset = parseResult.offset;
  }
  return result;
}
