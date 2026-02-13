import { ParseResult } from "./types.js";

export function findSequence(buffer: Uint8Array, sequence: Uint8Array): number {
    const lastStart = buffer.length - sequence.length;
    for (let offset = 0; offset <= lastStart; offset += 1) {
        let matches = true;
        for (let index = 0; index < sequence.length; index += 1) {
            if (buffer[offset + index] !== sequence[index]) {
                matches = false;
                break;
            }
        }

        if (matches) {
            return offset;
        }
    }

    return -1;
};

export function matchesSequence(
    buffer: Uint8Array,
    offset: number,
    sequence: Uint8Array
): boolean {
    if (offset + sequence.length > buffer.length) {
        return false;
    }

    for (let index = 0; index < sequence.length; index += 1) {
        if (buffer[offset + index] !== sequence[index]) {
            return false;
        }
    }

    return true;
};

export function containsValue<T extends Record<any, any>>(obj: T, value: any): boolean {
    return Object.values(obj).includes(value);
}

export function getKeyByValue<T extends Record<any, any>>(obj: T, value: any): keyof T | undefined {
    return (Object.keys(obj) as Array<keyof T>).find((key) => obj[key] === value);
};

export function findByte(
    buffer: Uint8Array,
    value: number,
    start: number,
    end: number
): number {
    for (let index = start; index < end; index += 1) {
        if (buffer[index] === value) {
            return index;
        }
    }
    return -1;
};


export function numberToHex(value: number, padding = 2): string {
    return "0x" + value.toString(16).toUpperCase().padStart(padding, "0");
}

export function messageWithOffset(message: string, offset: number): string {
    return `${message} at offset ${numberToHex(offset)}`;
}

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