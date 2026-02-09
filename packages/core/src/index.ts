export {
  decodeInstructions,
  parseConstantData,
  parseGlobalData,
  parseIpo
} from "./parser/index.js";
export type {
  Constant,
  ConstantData,
  GlobalData,
  Instruction,
  IpoFile,
  IpoHeader,
  Opcode,
  Section,
  SectionType,
  VariableType
} from "./parser/index.js";
