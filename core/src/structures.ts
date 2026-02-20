/**
 * INPAX IPO File Structures
 * Binary layout and parsing helpers
 */

/** IPO file magic number */
export const IPO_MAGIC = 0x49504F00; // "IPO\0"

/** IPO header offsets */
export const IPO_HEADER = {
  MAGIC: 0x00,
  VERSION: 0x04,
  FLAGS: 0x08,
  TABLES_OFFSET: 0x84,
  JOBS_OFFSET: 0x88,
  JOB_DESC_OFFSET: 0x90,
  INFO_BLOCK_OFFSET: 0x94,
  STRING_TABLE_OFFSET: 0x80,
} as const;

/** Block type identifiers */
export enum BlockType {
  Screen = 0x01,
  Menu = 0x02,
  StateMachine = 0x03,
  Function = 0x04,
}

/** Child block types */
export enum ChildBlockType {
  ScreenFunc = 0x10,
  LineFunc = 0x11,
  ControlFunc = 0x12,
  MenuItemFunc = 0x20,
  StateFunc = 0x30,
}

/** IPO header structure */
export interface IPOHeader {
  magic: number;
  version: number;
  flags: number;
  tablesOffset: number;
  jobsOffset: number;
  jobDescOffset: number;
  infoBlockOffset: number;
  stringTableOffset: number;
}

/** Job (function) entry in job table */
export interface JobEntry {
  id: number;
  name: string;
  offset: number;
  size: number;
}

/** Parse IPO header from buffer */
export function parseIPOHeader(buffer: Uint8Array): IPOHeader {
  const view = new DataView(buffer.buffer, buffer.byteOffset);
  
  return {
    magic: view.getUint32(IPO_HEADER.MAGIC, true),
    version: view.getUint16(IPO_HEADER.VERSION, true),
    flags: view.getUint32(IPO_HEADER.FLAGS, true),
    tablesOffset: view.getUint32(IPO_HEADER.TABLES_OFFSET, true),
    jobsOffset: view.getUint32(IPO_HEADER.JOBS_OFFSET, true),
    jobDescOffset: view.getUint32(IPO_HEADER.JOB_DESC_OFFSET, true),
    infoBlockOffset: view.getUint32(IPO_HEADER.INFO_BLOCK_OFFSET, true),
    stringTableOffset: view.getUint32(IPO_HEADER.STRING_TABLE_OFFSET, true),
  };
}

/** Read null-terminated string from buffer */
export function readCString(buffer: Uint8Array, offset: number, maxLen = 256): string {
  let end = offset;
  while (end < offset + maxLen && buffer[end] !== 0) {
    end++;
  }
  return new TextDecoder('latin1').decode(buffer.slice(offset, end));
}

/** Read length-prefixed string (u16 length) */
export function readPString(buffer: Uint8Array, offset: number): { value: string; bytesRead: number } {
  const view = new DataView(buffer.buffer, buffer.byteOffset);
  const len = view.getUint16(offset, true);
  const value = new TextDecoder('latin1').decode(buffer.slice(offset + 2, offset + 2 + len));
  return { value, bytesRead: 2 + len };
}

/** Known function IDs */
export const WELL_KNOWN_FUNCTIONS = {
  0: '__inpa_startup__',
  1: '__inpa_shutdown__',
  2: 'inpainit',
  3: 'inpaexit',
} as const;
