import type { ConstantData, InpaFile, Instruction } from "../parser/types.js";
import { getSystemFunction } from "../data/system-functions.js";
import { numberToHex, withOffsetPrefix } from "../index.js";

export type FormatOptions = {
  showRawBytes?: boolean;
  showOffset?: boolean;
  resolveNames?: boolean;
  input: InpaFile;
};

const DEFAULT_OPTIONS: Required<FormatOptions> = {
  showRawBytes: false,
  showOffset: true,
  resolveNames: true,
  input: {} as InpaFile
};

const OPCODE_COLUMN_WIDTH = 12;
const RAW_BYTES_COLUMN_WIDTH = 11;

const formatValue = (value: number): string => {
  if (value < 0) {
    return `-${numberToHex(Math.abs(value), "0x", 2)}`;
  }

  return `${numberToHex(value, "0x", 2)}`;
};

const formatRawBytes = (raw: Uint8Array): string =>
  Array.from(raw)
    .map((byte) => numberToHex(byte, "", 2))
    .join(" ");


export const formatInstruction = (
  instruction: Instruction,
  options?: FormatOptions
): string => {
  const resolvedOptions = { ...DEFAULT_OPTIONS, ...options };

  let line = "";

  const rawBytes = formatRawBytes(instruction.raw).padEnd(
      RAW_BYTES_COLUMN_WIDTH,
      " "
    );
    line = withOffsetPrefix(rawBytes, instruction.offset);



  return line.trimEnd();
};

export const formatDisassembly = (
  instructions: Instruction[],
  options?: FormatOptions
): string => instructions.map((instruction) => formatInstruction(instruction, options)).join("\n");
