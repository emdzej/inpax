import type { Instruction, Opcode, VariableScope } from "./types.js";

const Opcodes = {
  PUSH_VAR_ADDR: "PUSH_VAR_ADDR",
  PUSH_VAR_VAL: "PUSH_VAR_VAL",
  PUSH_CONST: "PUSH_CONST",
  STORE: "STORE",
  ALU_OP: "ALU_OP",
  JMP_FALSE: "JMP_FALSE",
  JMP: "JMP",
  CALL_USER: "CALL_USER",
  CALL_API: "CALL_API",
  PUSH_UI_HANDLE: "PUSH_UI_HANDLE",
  SCREEN_START: "SCREEN_START",
  LINE: "LINE",
  CONTROL: "CONTROL", // Confirmed: 0x23 - CONTROL block marker
  ITEM: "ITEM",
  STATE: "STATE",
  FUNC_PROLOGUE: "FUNC_PROLOGUE", // 08 51 00 00 - function entry marker
  UNKNOWN: "UNKNOWN"
} as const;

const Scopes = {
  GLOBAL: "global",
  LOCAL: "local",
  PARAM: "param"
} as const;

const scopeFromByte = (byte: number): VariableScope | undefined => {
  switch (byte) {
    case 0x00:
      return Scopes.GLOBAL;
    case 0x01:
      return Scopes.LOCAL;
    case 0x02:
      return Scopes.PARAM;
    default:
      return undefined;
  }
};

type OpcodeName = (typeof Opcodes)[keyof typeof Opcodes];

const createInstruction = (
  opcode: OpcodeName,
  offset: number,
  size: number,
  operands: readonly number[],
  buffer: Uint8Array,
  scope?: VariableScope
): Instruction => ({
  offset,
  opcode: opcode as Opcode,
  operands,
  raw: buffer.slice(offset, offset + size),
  size,
  ...(scope !== undefined && { scope })
});

const decodeUnknown = (offset: number, buffer: Uint8Array): Instruction =>
  createInstruction(Opcodes.UNKNOWN, offset, 1, [], buffer);

const decodeUint16 = (view: DataView, offset: number): number =>
  view.getUint16(offset, true);

const decodeInt16 = (view: DataView, offset: number): number =>
  view.getInt16(offset, true);

export const decodeInstructions = (
  buffer: Uint8Array,
  offset = 0,
  size = buffer.length - offset
): Instruction[] => {
  const instructions: Instruction[] = [];
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const end = Math.min(buffer.length, offset + size);

  let cursor = offset;
  while (cursor < end) {
    const remaining = end - cursor;
    const byte0 = buffer[cursor];

    if (byte0 === 0x01) {
      // PUSH_VAR_ADDR with scope-based addressing
      // Format: 01 [scope] [idx] 00
      if (remaining < 4) {
        instructions.push(decodeUnknown(cursor, buffer));
        cursor += 1;
        continue;
      }

      const scopeByte = buffer[cursor + 1];
      const scope = scopeFromByte(scopeByte);

      if (scope !== undefined && buffer[cursor + 3] === 0x00) {
        // Scope-based addressing: 01 [scope] [idx] 00
        const index = buffer[cursor + 2];
        instructions.push(
          createInstruction(Opcodes.PUSH_VAR_ADDR, cursor, 4, [index], buffer, scope)
        );
        cursor += 4;
        continue;
      }

      // Fallback for unknown format
      instructions.push(decodeUnknown(cursor, buffer));
      cursor += 1;
      continue;
    }

    if (byte0 === 0x02) {
      if (remaining < 4) {
        instructions.push(decodeUnknown(cursor, buffer));
        cursor += 1;
        continue;
      }

      if (buffer[cursor + 3] !== 0x00) {
        instructions.push(decodeUnknown(cursor, buffer));
        cursor += 1;
        continue;
      }

      const handle = decodeUint16(view, cursor + 1);
      instructions.push(
        createInstruction(Opcodes.PUSH_UI_HANDLE, cursor, 4, [handle], buffer)
      );
      cursor += 4;
      continue;
    }

    if (byte0 === 0x0c) {
      if (remaining < 4) {
        instructions.push(decodeUnknown(cursor, buffer));
        cursor += 1;
        continue;
      }

      const byte1 = buffer[cursor + 1];
      if (byte1 === 0x80 || byte1 === 0x81) {
        const funcId = decodeUint16(view, cursor + 2);
        const opcode = byte1 === 0x80 ? Opcodes.CALL_USER : Opcodes.CALL_API;
        instructions.push(createInstruction(opcode, cursor, 4, [funcId], buffer));
        cursor += 4;
        continue;
      }

      instructions.push(decodeUnknown(cursor, buffer));
      cursor += 1;
      continue;
    }

    if (byte0 === 0x21) {
      instructions.push(createInstruction(Opcodes.SCREEN_START, cursor, 1, [], buffer));
      cursor += 1;
      continue;
    }

    if (byte0 === 0x22) {
      instructions.push(createInstruction(Opcodes.LINE, cursor, 1, [], buffer));
      cursor += 1;
      continue;
    }

    // CONTROL opcode (0x23) - confirmed 2026-02-10 via INPACOMP.exe compilation test
    if (byte0 === 0x23) {
      instructions.push(createInstruction(Opcodes.CONTROL, cursor, 1, [], buffer));
      cursor += 1;
      continue;
    }

    if (byte0 === 0x24) {
      instructions.push(createInstruction(Opcodes.ITEM, cursor, 1, [], buffer));
      cursor += 1;
      continue;
    }

    if (byte0 === 0x25) {
      instructions.push(createInstruction(Opcodes.STATE, cursor, 1, [], buffer));
      cursor += 1;
      continue;
    }

    // FUNC_PROLOGUE opcode (0x08 0x51 0x00 0x00) - function entry marker
    if (byte0 === 0x08) {
      if (
        remaining >= 4 &&
        buffer[cursor + 1] === 0x51 &&
        buffer[cursor + 2] === 0x00 &&
        buffer[cursor + 3] === 0x00
      ) {
        instructions.push(
          createInstruction(Opcodes.FUNC_PROLOGUE, cursor, 4, [], buffer)
        );
        cursor += 4;
        continue;
      }

      instructions.push(decodeUnknown(cursor, buffer));
      cursor += 1;
      continue;
    }

    // PUSH_VAR_VAL with scope-based addressing (0x07)
    // Format: 07 [scope] [idx] 00
    if (byte0 === 0x07) {
      if (remaining < 4) {
        instructions.push(decodeUnknown(cursor, buffer));
        cursor += 1;
        continue;
      }

      const scopeByte = buffer[cursor + 1];
      const scope = scopeFromByte(scopeByte);

      if (scope !== undefined && buffer[cursor + 3] === 0x00) {
        const index = buffer[cursor + 2];
        instructions.push(
          createInstruction(Opcodes.PUSH_VAR_VAL, cursor, 4, [index], buffer, scope)
        );
        cursor += 4;
        continue;
      }

      instructions.push(decodeUnknown(cursor, buffer));
      cursor += 1;
      continue;
    }

    if (byte0 === 0x00) {
      if (remaining < 2) {
        instructions.push(decodeUnknown(cursor, buffer));
        cursor += 1;
        continue;
      }

      const byte1 = buffer[cursor + 1];
      if (byte1 === 0x01) {
        if (remaining < 4) {
          instructions.push(decodeUnknown(cursor, buffer));
          cursor += 1;
          continue;
        }

        const index = decodeUint16(view, cursor + 2);
        instructions.push(
          createInstruction(Opcodes.PUSH_VAR_VAL, cursor, 4, [index], buffer)
        );
        cursor += 4;
        continue;
      }

      if (byte1 === 0x06) {
        if (remaining < 4) {
          instructions.push(decodeUnknown(cursor, buffer));
          cursor += 1;
          continue;
        }

        const index = decodeUint16(view, cursor + 2);
        instructions.push(
          createInstruction(Opcodes.PUSH_CONST, cursor, 4, [index], buffer)
        );
        cursor += 4;
        continue;
      }

      if (byte1 === 0x05) {
        instructions.push(createInstruction(Opcodes.STORE, cursor, 2, [], buffer));
        cursor += 2;
        continue;
      }

      if (byte1 === 0x09) {
        if (remaining < 3) {
          instructions.push(decodeUnknown(cursor, buffer));
          cursor += 1;
          continue;
        }
        const operation = buffer[cursor + 2];

        instructions.push(
          createInstruction(Opcodes.ALU_OP, cursor, 3, [operation], buffer)
        );
        cursor += 3;
        continue;
      }

      if (byte1 === 0x0b) {
        if (remaining < 4) {
          instructions.push(decodeUnknown(cursor, buffer));
          cursor += 1;
          continue;
        }

        const offsetValue = decodeInt16(view, cursor + 2);
        instructions.push(
          createInstruction(Opcodes.JMP_FALSE, cursor, 4, [offsetValue], buffer)
        );
        cursor += 4;
        continue;
      }

      if (byte1 === 0x0e) {
        if (remaining < 4) {
          instructions.push(decodeUnknown(cursor, buffer));
          cursor += 1;
          continue;
        }

        const offsetValue = decodeInt16(view, cursor + 2);
        instructions.push(
          createInstruction(Opcodes.JMP, cursor, 4, [offsetValue], buffer)
        );
        cursor += 4;
        continue;
      }
    }

    instructions.push(decodeUnknown(cursor, buffer));
    cursor += 1;
  }

  return instructions;
};

export type { OpcodeName };
