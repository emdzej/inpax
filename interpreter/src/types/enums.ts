/**
 * IPO Value Types
 */
export enum ValueType {
  Void = 0,
  Bool = 1,
  Byte = 2,
  Int = 3, // s16
  Long = 4, // s32
  Real = 5, // f64
  String = 6,
  Handle1 = 7,
  Handle2 = 8,
  Handle3 = 9,
}

/**
 * IPO Block Types
 */
export enum BlockType {
  Screen = 0x01,
  Menu = 0x02,
  StateMachine = 0x03,
  LogicTable = 0x04,
  Function = 0x05,
  GlobalData = 0x11,
  ConstantData = 0x12,
  ScreenFunc = 0x21,
  LineFunc = 0x22,
  ControlFunc = 0x23,
  MenuItemFunc = 0x24,
  StateFunc = 0x25,
}

/**
 * VM Opcodes
 */
export enum Opcode {
  LOAD = 0x01,
  PUSHREF = 0x02,
  LOADINOUTREF = 0x03,
  CAST = 0x04,
  MOVE = 0x05,
  PUSHR = 0x06,
  PUSHREFSTORE = 0x07,
  JMP = 0x08,
  JMPZ = 0x09,
  JMPNZ = 0x0a,
  ALU = 0x0b,
  CALL = 0x0c,
  IMPORT32 = 0x0d,
  RET = 0x0e,
  FRAME = 0x0f,
  POP = 0x10,
  PUSHCONST = 0x11,
}

/**
 * ALU Operations
 */
export enum AluOp {
  ADD = 0x60,
  SUB = 0x61,
  MUL = 0x62,
  DIV = 0x63,
  LT = 0x64,
  LE = 0x65,
  GT = 0x66,
  GE = 0x67,
  EQ = 0x68,
  NE = 0x69,
  AND = 0x6a,
  OR = 0x6b,
  MOD = 0x6c,
  NEG = 0x6d,
  NOT = 0x6e,
  BAND = 0x6f,
  BOR = 0x70,
  BXOR = 0x71,
}

/**
 * Variable Scope
 */
export enum Scope {
  Global = 0x00,
  Const = 0x01,
  Local = 0x02,
  // 0x40+ = UI handles
}

/**
 * Call Target Type
 */
export enum CallTarget {
  UserFunction = 0x80,
  SystemFunction = 0x81,
}

/**
 * Type markers in bytecode (for CAST)
 */
export enum TypeMarker {
  Bool = 0x50,
  Int = 0x51,
  Byte = 0x52,
  Long = 0x53,
  Real = 0x54,
  String = 0x55,
  Handle1 = 0x56,
  Handle2 = 0x57,
}
