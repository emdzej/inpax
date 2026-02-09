import type { IpoFile } from "./types.js";
import { parseConstantData } from "./constant-data.js";
import { parseGlobalData } from "./global-data.js";
import { parseHeader } from "./header.js";
import { parseSections } from "./sections.js";

export type {
  Constant,
  ConstantData,
  GlobalData,
  IpoFile,
  IpoHeader,
  Section,
  SectionType,
  VariableType
} from "./types.js";
export { parseConstantData } from "./constant-data.js";
export { parseGlobalData } from "./global-data.js";

export const parseIpo = (buffer: Buffer): IpoFile => {
  const header = parseHeader(buffer);
  const sections = parseSections(buffer);
  const globalData = parseGlobalData(buffer);
  const constantData = parseConstantData(buffer);

  return {
    header,
    sections,
    globalData,
    constantData
  };
};
