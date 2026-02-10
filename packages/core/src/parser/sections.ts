import type { Section, SectionType } from "./types.js";

const PREAMBLE_TAIL = [0x0a, 0x0a, 0x00] as const;

const textDecoder = new TextDecoder("ascii");

const SECTION_TYPE_MARKERS: Record<number, SectionType> = {
  0x01: "screen",
  0x02: "menu",
  0x03: "statemachine",
  0x04: "logtable-data",
  0x05: "logtable-func"
};

const isPrintableAscii = (byte: number): boolean => byte >= 0x20 && byte <= 0x7e;

const isSectionPreamble = (buffer: Uint8Array, offset: number): boolean => {
  if (offset + 7 > buffer.length) {
    return false;
  }

  return (
    buffer[offset + 1] === 0x00 &&
    buffer[offset + 2] === 0x00 &&
    buffer[offset + 3] === 0x00 &&
    buffer[offset + 4] === PREAMBLE_TAIL[0] &&
    buffer[offset + 5] === PREAMBLE_TAIL[1] &&
    buffer[offset + 6] === PREAMBLE_TAIL[2]
  );
};

const inferSectionType = (name: string): SectionType => {
  if (name === "Global Data") {
    return "global";
  }

  if (name === "Constant Data") {
    return "constant";
  }

  // CONTROL block internal functions (named "#", "##", etc.)
  if (/^#+$/.test(name)) {
    return "control";
  }

  if (/^LT_/i.test(name)) {
    return "logtable-data";
  }

  if (/^lt_/i.test(name)) {
    return "logtable-func";
  }

  if (/^sm_/i.test(name)) {
    return "statemachine";
  }

  if (/^s_/i.test(name)) {
    return "screen";
  }

  if (/^m_/i.test(name)) {
    return "menu";
  }

  return "function";
};

type SectionCandidate = {
  name: string;
  nameOffset: number;
  startOffset: number;
  contentOffset: number;
  type: SectionType;
};

export function parseSections(buffer: Uint8Array): Map<string, Section> {
  const candidates: SectionCandidate[] = [];

  let index = 0;
  while (index < buffer.length) {
    if (!isPrintableAscii(buffer[index])) {
      index += 1;
      continue;
    }

    let end = index;
    while (end < buffer.length && isPrintableAscii(buffer[end])) {
      end += 1;
    }

    if (end < buffer.length && buffer[end] === 0x0a) {
      if (isSectionPreamble(buffer, end + 1)) {
        const nameBytes = buffer.slice(index, end);
        const rawName = textDecoder.decode(nameBytes);
        const markerOffset = index - 1;
        const marker = markerOffset >= 0 ? buffer[markerOffset] : undefined;
        const hasMarker =
          marker !== undefined &&
          Object.prototype.hasOwnProperty.call(SECTION_TYPE_MARKERS, marker);
        const type = hasMarker ? SECTION_TYPE_MARKERS[marker] : inferSectionType(rawName);
        const name =
          type === "logtable-data" && rawName.startsWith(" ")
            ? rawName.trimStart()
            : rawName;
        const contentOffset = end + 1 + 7;

        candidates.push({
          name,
          nameOffset: index,
          startOffset: hasMarker ? markerOffset : index,
          contentOffset,
          type
        });

        index = end + 1;
        continue;
      }
    }

    index = end + 1;
  }

  candidates.sort((a, b) => a.startOffset - b.startOffset);

  const sections = new Map<string, Section>();
  const nameCounts = new Map<string, number>();

  for (let i = 0; i < candidates.length; i += 1) {
    const current = candidates[i];
    const next = candidates[i + 1];
    const endOffset = next ? next.startOffset : buffer.length;
    const size = Math.max(0, endOffset - current.contentOffset);

    // Handle duplicate section names (e.g., multiple "#" CONTROL blocks)
    const count = nameCounts.get(current.name) ?? 0;
    nameCounts.set(current.name, count + 1);
    const uniqueName = count === 0 ? current.name : `${current.name}_${count + 1}`;

    sections.set(uniqueName, {
      name: uniqueName,
      offset: current.contentOffset,
      size,
      type: current.type
    });
  }

  return sections;
}
