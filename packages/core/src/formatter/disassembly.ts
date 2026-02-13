import type { ConstantData, InpaFile, Instruction } from "../parser/types.js";
import { getSystemFunction } from "../data/system-functions.js";

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

const formatHex = (value: number, width = 0): string =>
  value.toString(16).padStart(width, "0");

const formatOffset = (offset: number): string => `0x${formatHex(offset, 4)}`;

const formatValue = (value: number): string => {
  if (value < 0) {
    return `-0x${formatHex(Math.abs(value), 2)}`;
  }

  return `0x${formatHex(value, 2)}`;
};

const formatRawBytes = (raw: Uint8Array): string =>
  Array.from(raw)
    .map((byte) => formatHex(byte, 2))
    .join(" ");


export const formatInstruction = (
  instruction: Instruction,
  options?: FormatOptions
): string => {
  const resolvedOptions = { ...DEFAULT_OPTIONS, ...options };

  let line = "";

  if (resolvedOptions.showOffset) {
    line += `${formatOffset(instruction.offset)}: `;
  }

  if (resolvedOptions.showRawBytes) {
    const rawBytes = formatRawBytes(instruction.raw).padEnd(
      RAW_BYTES_COLUMN_WIDTH,
      " "
    );
    line += `${rawBytes} `;
  }



  return line.trimEnd();
};

export const formatDisassembly = (
  instructions: Instruction[],
  options?: FormatOptions
): string => instructions.map((instruction) => formatInstruction(instruction, options)).join("\n");
