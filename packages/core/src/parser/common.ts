import { ParseResult, SectionHeader, SectionTypeMarker, SectionTypeMarkers } from "./types.js";
import { containsValue, findByte, withOffsetSuffix, parseString, textDecoder } from "./utils.js";

export function parseSectionHeader(buffer: Uint8Array,
    startOffset: number, expectedType: SectionTypeMarker): ParseResult<SectionHeader> {
        var offset = startOffset;
        const candidateType = buffer[offset];
        if (!containsValue(SectionTypeMarkers, candidateType)) {
            throw new Error(`Invalid section type marker at offset ${offset}. Found ${candidateType}, expected one of ${Object.values(SectionTypeMarkers)}`);
        }
        if (candidateType !== expectedType) {
            throw new Error(`Unexpected section type marker at offset ${offset}. Found ${candidateType}, expected ${expectedType}`);
        }
        const type = candidateType as SectionTypeMarker;
        var name: string | undefined = undefined;
        var id: number;
        var flags: number;
        var size: number;
        var arg1: string | undefined = undefined;
        var arg2: string | undefined = undefined;

        offset += 1;

        const sectionNameResult = parseString(buffer, offset);
        name = sectionNameResult.result;
        offset = sectionNameResult.offset;

        const idAndFlags = new DataView(buffer.buffer, buffer.byteOffset + offset, 4);
        id = idAndFlags.getUint16(0, true);
        flags = idAndFlags.getUint16(2, true);
        offset += 4;

        const arg1Result = parseString(buffer, offset);
        arg1 = arg1Result.result;
        offset = arg1Result.offset;

        const arg2Result = parseString(buffer, offset);
        arg2 = arg2Result.result;
        offset = arg2Result.offset;

        if (buffer[offset] !== 0x00) {
            throw new Error(withOffsetSuffix(`Expected section size marker 0x00, found 0x${buffer[offset].toString(16)}`, offset));
        }
        offset += 1;

        const lengthView = new DataView(buffer.buffer, buffer.byteOffset + offset, 2);
        size = lengthView.getUint16(0, true);
        offset += 2; // 2 bytes for size

        return {
            result:{
                offset: startOffset,
                dataOffset: offset,
                type,
                name,
                id,
                flags,
                size,
                arg1,
                arg2
            },
            offset
        }
    }
