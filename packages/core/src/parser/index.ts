import type { IpoFile } from "./types.js";
import { parseHeader } from "./header.js";
import { parseSections } from "./sections.js";

export type { IpoFile, IpoHeader, Section, SectionType } from "./types.js";

export const parseIpo = (buffer: Buffer): IpoFile => {
  const header = parseHeader(buffer);
  const sections = parseSections(buffer);

  return {
    header,
    sections
  };
};
