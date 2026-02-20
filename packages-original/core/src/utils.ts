import { AllocType, AllocTypes, AluOpCode, AluOpCodes, CallScope, CallScopes, DataTypeMarker, DataTypeMarkers, MenuKey, MenuKeys, OpCode, OpCodes, ParseResult, SectionTypeMarker, SectionTypeMarkers, VariableScope, VariableScopes } from "./types.js";

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


export function numberToHex(value: number, prefix: string = "0x", padding = 4): string {
    return prefix + value.toString(16).toUpperCase().padStart(padding, "0");
}

export function withOffsetSuffix(message: string, offset: number, separator: string = "@"): string {
    return `${message} ${separator}${numberToHex(offset)}`;
}

export function withOffsetPrefix(message: string, offset: number, separator: string = ":"): string {
    return `${numberToHex(offset)}${separator} ${message}`;
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

export function getDataTypeName(marker: DataTypeMarker): string {
    return getKeyByValue(DataTypeMarkers, marker)?.toLowerCase()
        ?? `Unknown(0x${marker.toString(16)})`;
}


export function getSectionTypeName(marker: SectionTypeMarker): string {
    return getKeyByValue(SectionTypeMarkers, marker)?.toLowerCase()
        ?? `Unknown(0x${marker.toString(16)})`;
}


export function getMenuKeyName(key: MenuKey): string {
    return getKeyByValue(MenuKeys, key) ?? `Unknown(0x${key.toString(16)})`;
}

export function getOpCodeName(opcode: OpCode): string {
    return getKeyByValue(OpCodes, opcode) ?? `Unknown(0x${opcode.toString(16)})`;
}

export function getVariableScopeName(depth: VariableScope): string {
    return getKeyByValue(VariableScopes, depth)
        ?? `Unknown(0x${depth.toString(16)})`;
}

export function getAluOpCodeName(opcode: AluOpCode): string {
    return getKeyByValue(AluOpCodes, opcode)
        ?? `Unknown(0x${opcode.toString(16)})`;
}

export function getCallScopeName(scope: CallScope): string {
    return getKeyByValue(CallScopes, scope)
        ?? `Unknown(0x${scope.toString(16)})`;
}

export function getAllocTypeName(type: AllocType): string {
    return getKeyByValue(AllocTypes, type)
        ?? `Unknown(0x${type.toString(16)})`;
}

