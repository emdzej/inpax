import { InpaFile, OpCode } from "@inpax/core";

export type InstructionDisassemblyHandler = (opcode: OpCode, rawBytes: Buffer, context: InpaFile) => string;

export type InstructionDisassemblyHandlers = {
    [opcode in OpCode]?: InstructionDisassemblyHandler;
};
