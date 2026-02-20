/**
 * INPAX Constants
 * Magic numbers, limits, and configuration
 */

/** IPO file magic bytes */
export const IPO_MAGIC_BYTES = new Uint8Array([0x49, 0x50, 0x4F, 0x00]); // "IPO\0"

/** Maximum values */
export const MAX = {
  STRING_LENGTH: 65535,
  ARRAY_SIZE: 65535,
  STACK_SIZE: 1024,
  CALL_DEPTH: 256,
  LOCALS: 256,
  GLOBALS: 1024,
  FUNCTIONS: 4096,
  STRINGS: 65535,
} as const;

/** EOJ sentinel value (two consecutive EOJ opcodes) */
export const EOJ_SENTINEL = 0x1D001D;

/** Default file extensions */
export const EXTENSIONS = {
  SOURCE: '.ips',
  COMPILED: '.ipo',
  INCLUDE: '.iph',
} as const;

/** Special function IDs */
export const SPECIAL_FUNCTIONS = {
  STARTUP: 0,
  SHUTDOWN: 1,
  INPAINIT: 2,
  INPAEXIT: 3,
} as const;

/** Version info */
export const VERSION = {
  INPAX: '0.1.0',
  IPO_FORMAT: 1,
} as const;
