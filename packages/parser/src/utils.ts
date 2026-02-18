import { findByte } from "@inpax/core";
import { ParseResult } from "./types.js";

export const textDecoder = new TextDecoder("ascii");

export function parseString(buffer: Uint8Array, offset: number): ParseResult<string | undefined> {
    const sectionNameMarkerIndex = findByte(buffer, 0x0A, offset, buffer.length);
    if (sectionNameMarkerIndex !== offset) {

        const magicBytes = buffer.slice(
            offset,
            sectionNameMarkerIndex
        );
        const value = textDecoder.decode(magicBytes);
        offset = sectionNameMarkerIndex + 1;
        return { result: value, offset };
    }
    return { result: undefined, offset: offset + 1 };
}
