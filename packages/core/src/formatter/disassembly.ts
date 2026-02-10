import type { Instruction } from "../parser/types.js";
import { getSystemFunction } from "../data/system-functions.js";

export type FormatOptions = {
  showRawBytes?: boolean;
  showOffset?: boolean;
  resolveNames?: boolean;
};

const DEFAULT_OPTIONS: Required<FormatOptions> = {
  showRawBytes: false,
  showOffset: true,
  resolveNames: true
};

const OPCODE_COLUMN_WIDTH = 12;
const RAW_BYTES_COLUMN_WIDTH = 11;

const formatHex = (value: number, width = 0): string =>
  value.toString(16).padStart(width, "0");

const formatOffset = (offset: number): string => `0x${formatHex(offset, 4)}`;

const formatValue = (value: number): string => {
  if (value < 0) {
    return `-0x${formatHex(Math.abs(value))}`;
  }

  return `0x${formatHex(value)}`;
};

const formatRawBytes = (raw: Uint8Array): string =>
  Array.from(raw)
    .map((byte) => formatHex(byte, 2))
    .join(" ");

const formatOperands = (instruction: Instruction, options: Required<FormatOptions>): string => {
  if (instruction.operands.length === 0) {
    return "";
  }

  // Format variable access with scope (PUSH_VAR_ADDR, PUSH_VAR_VAL)
  if (
    (instruction.opcode === "PUSH_VAR_ADDR" || instruction.opcode === "PUSH_VAR_VAL") &&
    instruction.scope !== undefined
  ) {
    const index = instruction.operands[0];
    return `${instruction.scope}[${index}]`;
  }

  if (instruction.opcode === "CALL_API") {
    const funcId = instruction.operands[0];
    const resolved = options.resolveNames ? getSystemFunction(funcId) : undefined;

    if (resolved) {
      return `${resolved.name} (${formatValue(funcId)})`;
    }
  }

  return instruction.operands.map((operand) => formatValue(operand)).join(", ");
};

export const formatInstruction = (
  instruction: Instruction,
  options?: FormatOptions
): string => {
  const resolvedOptions = { ...DEFAULT_OPTIONS, ...options };
  const operands = formatOperands(instruction, resolvedOptions);
  const opcodeWidth = Math.max(OPCODE_COLUMN_WIDTH, instruction.opcode.length + 1);
  const opcode = instruction.opcode.padEnd(opcodeWidth, " ");

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

  line += opcode;

  if (operands) {
    line += operands;
    return line;
  }

  return line.trimEnd();
};

export const formatDisassembly = (
  instructions: Instruction[],
  options?: FormatOptions
): string => instructions.map((instruction) => formatInstruction(instruction, options)).join("\n");
