/**
 * INPAX Core Types
 * Basic type definitions shared across all modules
 */

/** Variable scope encoding */
export enum Scope {
  Global = 0x00,
  Const = 0x01,
  Local = 0x02,
  // 0x40+ = UI handles
}

/** Data types */
export enum DataType {
  Void = 0x00,
  Int = 0x01,
  Long = 0x02,
  Float = 0x03,
  Double = 0x04,
  String = 0x05,
  // Arrays
  IntArray = 0x81,
  LongArray = 0x82,
  FloatArray = 0x83,
  DoubleArray = 0x84,
  StringArray = 0x85,
}

/** Value that can be on the stack */
export type Value = number | string | null;

/** Variable definition */
export interface Variable {
  name: string;
  type: DataType;
  scope: Scope;
  index: number;
  isArray: boolean;
  arraySize?: number;
}

/** Function definition */
export interface FunctionDef {
  id: number;
  name: string;
  offset: number;
  size: number;
  returnType: DataType;
  params: Variable[];
  locals: Variable[];
}

/** String table entry */
export interface StringEntry {
  index: number;
  value: string;
  offset: number;
}

/** IPO file info */
export interface IPOInfo {
  magic: number;
  version: number;
  headerSize: number;
  stringTableOffset: number;
  functionTableOffset: number;
  globalTableOffset: number;
  codeOffset: number;
  functions: FunctionDef[];
  strings: StringEntry[];
  globals: Variable[];
}

/** Instruction with decoded operands */
export interface Instruction {
  offset: number;
  opcode: number;
  mnemonic: string;
  operands: Value[];
  size: number;
  raw: Uint8Array;
}

/** Disassembly output for a function */
export interface DisassembledFunction {
  def: FunctionDef;
  instructions: Instruction[];
}
