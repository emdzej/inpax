import { ParseResult, Instruction, SectionTypeMarker, SectionTypeMarkers, UserFunction } from "@inpax/core";
import { parseSectionHeader } from "./common.js";

export function parseInstruction(buffer: Uint8Array, startOffset: number): ParseResult<Instruction> {
    const result: Instruction = {
        raw: Buffer.from(buffer.slice(startOffset, startOffset + 4)),
        offset: startOffset,
    };
    return {
        result: result,
        offset: startOffset + 4,
    }
}

export function parseFunction(buffer: Uint8Array, startOffset: number, type: SectionTypeMarker = SectionTypeMarkers.FUNCTION): ParseResult<UserFunction> {
    var offset = startOffset;
    const headerResult = parseSectionHeader(buffer, offset, type);
    offset = headerResult.offset;
    const instructions: Instruction[] = [];
    for (var i = 0; i < headerResult.result.size; i++) {
        const instructionResult = parseInstruction(buffer, offset);
        offset = instructionResult.offset;
        instructions.push(instructionResult.result);
    }
    return {
        result: {
            ...headerResult.result,
            instructions,
        },
        offset,
    };
}
