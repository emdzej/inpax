import { ParseResult, LogicTable, SectionTypeMarkers, LogicTableEntry } from "@inpax/core";
import { parseSectionHeader } from "./common.js";

const ENTRY_SIZE = 12; // Each entry consists of 3 uint32 values (input, mask, output)

export function parseLogicTable(buffer: Uint8Array, startOffset: number): ParseResult<LogicTable> {
    var offset = startOffset;
    const headerResult = parseSectionHeader(buffer, offset, SectionTypeMarkers.LOGIC_TABLE);
    offset = headerResult.offset;

    const view = new DataView(buffer.buffer,
        buffer.byteOffset + offset,
        ENTRY_SIZE * headerResult.result.size);

    const entries: LogicTableEntry[] = [];
    var entryOffset = 0;
    for (var index = 0; index < headerResult.result.size; index++) {
        const input = view.getUint32(entryOffset, true);
        const mask = view.getUint32(entryOffset + 4, true);
        const output = view.getUint32(entryOffset + 8, true);
        const entry: LogicTableEntry = {
            input,
            mask,
            output
        };
        entries.push(entry);
        entryOffset += ENTRY_SIZE;
    }

    offset += ENTRY_SIZE * headerResult.result.size;

    return {
        result: {
                ...headerResult.result,
            entries
        },
        offset
    }
}
