import type { IpoFile } from "./types.js";
import { parseGlobalData } from "./global-data.js";
import { parseHeader } from "./header.js";
import { parseSections } from "./sections.js";

export type {
  GlobalData,
  IpoFile,
  IpoHeader,
  Section,
  SectionType,
  VariableType
} from "./types.js";
export { parseGlobalData } from "./global-data.js";

export const parseIpo = (buffer: Buffer): IpoFile => {
  const header = parseHeader(buffer);
  const sections = parseSections(buffer);
  const globalData = parseGlobalData(buffer);

  return {
    header,
    sections,
    globalData
  };
};
