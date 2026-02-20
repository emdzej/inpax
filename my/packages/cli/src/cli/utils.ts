import { numberToHex } from "@inpax/core";
import { readFileSync } from "node:fs";

export const readFile = (filePath: string): Buffer => {
    try {
        return readFileSync(filePath);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to read file: ${filePath}\n${message}`);
    }
};

export const formatHexDump = (buffer: Uint8Array): string => {
    const lines: string[] = [];
    const bytesPerLine = 16;

    for (let offset = 0; offset < buffer.length; offset += bytesPerLine) {
        const chunk = buffer.slice(offset, offset + bytesPerLine);
        const hex = Array.from(chunk)
            .map((byte) => numberToHex(byte))
            .join(" ");
        const ascii = Array.from(chunk)
            .map((byte) => (byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : "."))
            .join("");
        lines.push(`${numberToHex(offset, 6)}  ${hex.padEnd(bytesPerLine * 3 - 1, " ")}  ${ascii}`);
    }

    return lines.join("\n");
};
