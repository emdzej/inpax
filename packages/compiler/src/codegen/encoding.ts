import { AluOp, CallTarget, Opcode, Scope, TypeMarker, ValueType } from '@emdzej/inpax-core';

/**
 * A single 4-byte VM instruction in unpacked form. The writer encodes
 * it as `opcode | (op1 << 8) | (op2 << 16)`.
 */
export interface Instruction {
  readonly opcode: Opcode;
  readonly op1: number;
  readonly op2: number;
}

export function instr(opcode: Opcode, op1 = 0, op2 = 0): Instruction {
  return { opcode, op1: op1 & 0xff, op2: op2 & 0xffff };
}

export function load(scope: Scope, index: number): Instruction {
  return instr(Opcode.LOAD, scope, index);
}

export function pushRefStore(scope: Scope, index: number): Instruction {
  // 0x02 — emitted by the caller before CALL_USER to mark an `out:`
  // argument slot (the actual write target is the caller's local).
  return instr(Opcode.PUSHREF, scope, index);
}

export function loadInOutRef(scope: Scope, index: number): Instruction {
  return instr(Opcode.LOADINOUTREF, scope, index);
}

export function move(): Instruction {
  // The MOV operand pair `00 01` is observed everywhere in disasms; the
  // second byte's exact meaning is unconfirmed but consistent.
  return instr(Opcode.MOVE, 0, 1);
}

export function pushR(scope: Scope, index: number): Instruction {
  // 0x06 — push a write-target reference (LHS of `x = ...`).
  return instr(Opcode.PUSHR, scope, index);
}

export function pushRefOut(scope: Scope, index: number): Instruction {
  return instr(Opcode.PUSHREFSTORE, scope, index);
}

export function alloc(marker: TypeMarker): Instruction {
  return instr(Opcode.ALLOC, marker, 0);
}

export function alu(op: AluOp): Instruction {
  return instr(Opcode.ALU, op, 0);
}

export function jmp(offset = 0): Instruction {
  return instr(Opcode.JMP, 0, offset);
}

export function jmpnz(offset = 0): Instruction {
  return instr(Opcode.JMPNZ, 0, offset);
}

export function callUser(funcId: number): Instruction {
  return instr(Opcode.CALL, CallTarget.UserFunction, funcId);
}

export function callSystem(funcId: number): Instruction {
  return instr(Opcode.CALL, CallTarget.SystemFunction, funcId);
}

export function callExternal(constIndex: number): Instruction {
  // CALLE: `0D 01 <const-index>` — the constant carries the full
  // DLL::Function:signature string.
  return instr(Opcode.CALLE, 0x01, constIndex);
}

/**
 * Push an immediate integer value. PUSHIMM (0x11) is used inside the
 * synthetic `lt_<name>` lookup function generated for LOGTABLE — see
 * `disasm` of EHC_2.IPO around the `handst` block where the input /
 * output bit widths are pushed before the LOGTABLE opcode.
 */
export function pushImmInt(value: number): Instruction {
  return instr(Opcode.PUSHIMM, TypeMarker.Int, value);
}

/**
 * LOGTABLE lookup opcode (0x10). `op1` is a constant `0x44` in every
 * real .ipo sample inspected so far — meaning unconfirmed (possibly a
 * flag byte or magic). `op2` is the data-block index pushed as the
 * lookup table reference (0 in EHC_2.IPO's `handst` table, suggesting
 * one logic table per file is normal).
 */
export function logtable(dataBlockRef = 0): Instruction {
  return instr(Opcode.LOGTABLE, 0x44, dataBlockRef);
}

export function frame(): Instruction {
  return instr(Opcode.FRAME);
}

export function ret(): Instruction {
  return instr(Opcode.RET);
}

export function typeMarkerFor(type: ValueType): TypeMarker {
  switch (type) {
    case ValueType.Bool: return TypeMarker.Bool;
    case ValueType.Byte: return TypeMarker.Byte;
    case ValueType.Int: return TypeMarker.Int;
    case ValueType.Long: return TypeMarker.Long;
    case ValueType.Real: return TypeMarker.Real;
    case ValueType.String: return TypeMarker.String;
    default:
      throw new Error(`no ALLOC marker for type ${type}`);
  }
}

export function packInstruction(i: Instruction): number {
  return (
    (i.opcode & 0xff) |
    ((i.op1 & 0xff) << 8) |
    ((i.op2 & 0xffff) << 16)
  ) >>> 0;
}
