/**
 * INPAX Opcodes
 * Complete opcode definitions for IPO bytecode
 */

export enum Opcode {
  // Stack operations
  NOP = 0x00,
  PUSH_INT = 0x01,
  PUSH_LONG = 0x02,
  PUSH_FLOAT = 0x03,
  PUSH_DOUBLE = 0x04,
  PUSH_STRING = 0x05,
  PUSH_VAR = 0x06,
  POP = 0x07,
  DUP = 0x08,

  // Arithmetic
  ADD = 0x10,
  SUB = 0x11,
  MUL = 0x12,
  DIV = 0x13,
  MOD = 0x14,
  NEG = 0x15,
  INC = 0x16,
  DEC = 0x17,

  // Comparison
  EQ = 0x20,
  NE = 0x21,
  LT = 0x22,
  LE = 0x23,
  GT = 0x24,
  GE = 0x25,

  // Logical
  AND = 0x30,
  OR = 0x31,
  NOT = 0x32,
  XOR = 0x33,

  // Bitwise
  BAND = 0x34,
  BOR = 0x35,
  BNOT = 0x36,
  BXOR = 0x37,
  SHL = 0x38,
  SHR = 0x39,

  // Control flow
  JMP = 0x40,
  JMPZ = 0x41,
  JMPNZ = 0x42,
  CALL = 0x43,
  RET = 0x44,
  SYSCALL = 0x45,

  // Variables
  STORE = 0x50,
  LOAD = 0x51,
  STORE_ARR = 0x52,
  LOAD_ARR = 0x53,

  // Type conversion
  I2L = 0x60,
  I2F = 0x61,
  I2D = 0x62,
  L2I = 0x63,
  L2F = 0x64,
  L2D = 0x65,
  F2I = 0x66,
  F2L = 0x67,
  F2D = 0x68,
  D2I = 0x69,
  D2L = 0x6A,
  D2F = 0x6B,

  // End markers
  EOJ = 0x1D,
  EOF = 0xFF,
}

/** Opcode metadata */
export interface OpcodeInfo {
  mnemonic: string;
  operandBytes: number;
  description: string;
  stackEffect: number; // positive = push, negative = pop
}

/** Opcode table with metadata */
export const OPCODE_INFO: Partial<Record<Opcode, OpcodeInfo>> = {
  [Opcode.NOP]: { mnemonic: 'NOP', operandBytes: 0, description: 'No operation', stackEffect: 0 },
  [Opcode.PUSH_INT]: { mnemonic: 'PUSH_INT', operandBytes: 4, description: 'Push 32-bit integer', stackEffect: 1 },
  [Opcode.PUSH_LONG]: { mnemonic: 'PUSH_LONG', operandBytes: 8, description: 'Push 64-bit integer', stackEffect: 1 },
  [Opcode.PUSH_FLOAT]: { mnemonic: 'PUSH_FLOAT', operandBytes: 4, description: 'Push 32-bit float', stackEffect: 1 },
  [Opcode.PUSH_DOUBLE]: { mnemonic: 'PUSH_DOUBLE', operandBytes: 8, description: 'Push 64-bit float', stackEffect: 1 },
  [Opcode.PUSH_STRING]: { mnemonic: 'PUSH_STRING', operandBytes: 2, description: 'Push string index', stackEffect: 1 },
  [Opcode.PUSH_VAR]: { mnemonic: 'PUSH_VAR', operandBytes: 2, description: 'Push variable', stackEffect: 1 },
  [Opcode.POP]: { mnemonic: 'POP', operandBytes: 0, description: 'Pop top of stack', stackEffect: -1 },
  [Opcode.DUP]: { mnemonic: 'DUP', operandBytes: 0, description: 'Duplicate top of stack', stackEffect: 1 },

  [Opcode.ADD]: { mnemonic: 'ADD', operandBytes: 0, description: 'Add', stackEffect: -1 },
  [Opcode.SUB]: { mnemonic: 'SUB', operandBytes: 0, description: 'Subtract', stackEffect: -1 },
  [Opcode.MUL]: { mnemonic: 'MUL', operandBytes: 0, description: 'Multiply', stackEffect: -1 },
  [Opcode.DIV]: { mnemonic: 'DIV', operandBytes: 0, description: 'Divide', stackEffect: -1 },
  [Opcode.MOD]: { mnemonic: 'MOD', operandBytes: 0, description: 'Modulo', stackEffect: -1 },
  [Opcode.NEG]: { mnemonic: 'NEG', operandBytes: 0, description: 'Negate', stackEffect: 0 },
  [Opcode.INC]: { mnemonic: 'INC', operandBytes: 0, description: 'Increment', stackEffect: 0 },
  [Opcode.DEC]: { mnemonic: 'DEC', operandBytes: 0, description: 'Decrement', stackEffect: 0 },

  [Opcode.EQ]: { mnemonic: 'EQ', operandBytes: 0, description: 'Equal', stackEffect: -1 },
  [Opcode.NE]: { mnemonic: 'NE', operandBytes: 0, description: 'Not equal', stackEffect: -1 },
  [Opcode.LT]: { mnemonic: 'LT', operandBytes: 0, description: 'Less than', stackEffect: -1 },
  [Opcode.LE]: { mnemonic: 'LE', operandBytes: 0, description: 'Less or equal', stackEffect: -1 },
  [Opcode.GT]: { mnemonic: 'GT', operandBytes: 0, description: 'Greater than', stackEffect: -1 },
  [Opcode.GE]: { mnemonic: 'GE', operandBytes: 0, description: 'Greater or equal', stackEffect: -1 },

  [Opcode.AND]: { mnemonic: 'AND', operandBytes: 0, description: 'Logical AND', stackEffect: -1 },
  [Opcode.OR]: { mnemonic: 'OR', operandBytes: 0, description: 'Logical OR', stackEffect: -1 },
  [Opcode.NOT]: { mnemonic: 'NOT', operandBytes: 0, description: 'Logical NOT', stackEffect: 0 },

  [Opcode.JMP]: { mnemonic: 'JMP', operandBytes: 2, description: 'Unconditional jump', stackEffect: 0 },
  [Opcode.JMPZ]: { mnemonic: 'JMPZ', operandBytes: 2, description: 'Jump if zero', stackEffect: -1 },
  [Opcode.JMPNZ]: { mnemonic: 'JMPNZ', operandBytes: 2, description: 'Jump if not zero', stackEffect: -1 },
  [Opcode.CALL]: { mnemonic: 'CALL', operandBytes: 2, description: 'Call function', stackEffect: 0 },
  [Opcode.RET]: { mnemonic: 'RET', operandBytes: 0, description: 'Return', stackEffect: 0 },
  [Opcode.SYSCALL]: { mnemonic: 'SYSCALL', operandBytes: 2, description: 'System function call', stackEffect: 0 },

  [Opcode.STORE]: { mnemonic: 'STORE', operandBytes: 2, description: 'Store to variable', stackEffect: -1 },
  [Opcode.LOAD]: { mnemonic: 'LOAD', operandBytes: 2, description: 'Load from variable', stackEffect: 1 },
  [Opcode.STORE_ARR]: { mnemonic: 'STORE_ARR', operandBytes: 2, description: 'Store to array', stackEffect: -2 },
  [Opcode.LOAD_ARR]: { mnemonic: 'LOAD_ARR', operandBytes: 2, description: 'Load from array', stackEffect: 0 },

  [Opcode.EOJ]: { mnemonic: 'EOJ', operandBytes: 0, description: 'End of job', stackEffect: 0 },
  [Opcode.EOF]: { mnemonic: 'EOF', operandBytes: 0, description: 'End of file', stackEffect: 0 },
};

/** Get opcode info with fallback */
export function getOpcodeInfo(opcode: number): OpcodeInfo {
  return OPCODE_INFO[opcode as Opcode] ?? {
    mnemonic: `UNK_${opcode.toString(16).padStart(2, '0').toUpperCase()}`,
    operandBytes: 0,
    description: 'Unknown opcode',
    stackEffect: 0,
  };
}
