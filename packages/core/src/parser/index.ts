import type { IpoFile } from "./types.js";
import { parseConstantData } from "./constant-data.js";
import { parseGlobalData } from "./global-data.js";
import { parseHeader } from "./header.js";
import { parseSections } from "./sections.js";
import { decodeInstructions } from "./opcode-decoder.js";
import { parseImport32 } from "./import32.js";
import { parseImport32 } from "./import32.js";

export type {
  Constant,
  ConstantData,
  GlobalData,
  IpoFile,
  IpoHeader,
  Instruction,
  Opcode,
  Section,
  SectionType,
  VariableType
} from "./types.js";
export type { Import32Call, Param, ParamDirection, ParamType } from "./import32.js";
export { parseConstantData } from "./constant-data.js";
export { parseGlobalData } from "./global-data.js";
export { decodeInstructions } from "./opcode-decoder.js";
export { parseImport32 } from "./import32.js";

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
