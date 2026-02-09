import type { Section, SectionType } from "./types.js";

const PREAMBLE_TAIL = [0x0a, 0x0a, 0x00] as const;

const textDecoder = new TextDecoder("ascii");

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
  contentOffset: number;
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
        const name = textDecoder.decode(nameBytes);
        const contentOffset = end + 1 + 7;

        candidates.push({
          name,
          nameOffset: index,
          contentOffset
        });

        index = end + 1;
        continue;
      }
    }

    index = end + 1;
  }

  candidates.sort((a, b) => a.nameOffset - b.nameOffset);

  const sections = new Map<string, Section>();

  for (let i = 0; i < candidates.length; i += 1) {
    const current = candidates[i];
    const next = candidates[i + 1];
    const endOffset = next ? next.nameOffset : buffer.length;
    const size = Math.max(0, endOffset - current.contentOffset);

    sections.set(current.name, {
      name: current.name,
      offset: current.contentOffset,
      size,
      type: inferSectionType(current.name)
    });
  }

  return sections;
}
