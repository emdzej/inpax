import type { LogtableData, LogtableEntry } from "./types.js";

const ENTRY_SIZE = 12;

export const decodeLogtable = (
  buffer: Uint8Array,
  offset: number,
  size: number
): LogtableData => {
  if (size < 4) {
    throw new Error("Logtable section is too small to contain entry count");
  }

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const entryCount = view.getUint32(offset, true);
  const expectedSize = 4 + entryCount * ENTRY_SIZE;

  if (size < expectedSize) {
    throw new Error(
      `Logtable section is truncated (expected ${expectedSize} bytes, got ${size})`
    );
  }

  const entries: LogtableEntry[] = [];
  let entryOffset = offset + 4;
  for (let index = 0; index < entryCount; index += 1) {
    const input = view.getUint32(entryOffset, true);
    const mask = view.getUint32(entryOffset + 4, true);
    const output = view.getUint32(entryOffset + 8, true);

    entries.push({
      input,
      mask,
      output
    });

    entryOffset += ENTRY_SIZE;
  }

  return {
    entries
  };
};
