/**
 * Source-file encoding helpers.
 *
 * INPA scripts are usually written under cp1252 (German installations
 * — the BMW Rectification toolchain), but Polish / Czech / Russian
 * variants exist as cp1250 / cp1251 / cp1254. Reading with Node's
 * default UTF-8 silently corrupts every byte ≥ 0x80, so we route
 * source reads through iconv-lite with a user-chosen codepage.
 *
 * Output bytes (constants in the `.ipo`) are still encoded by the
 * writer via `String.charCodeAt(i) & 0xff`, which round-trips cleanly
 * for cp1252 / Latin-1 in the 0xA0–0xFF range (where Unicode and
 * cp1252 agree). Codepages that diverge in 0x80–0x9F or that map
 * Polish/Czech diacritics to bytes outside the Latin-1 envelope will
 * need iconv-encoded output too — out of scope for this helper.
 */
import iconv from 'iconv-lite';

/** Default if the caller didn't specify — matches every BMW German script we've seen. */
export const DEFAULT_SOURCE_ENCODING = 'cp1252';

/**
 * Canonicalise common encoding spellings to a name iconv-lite knows.
 * Accepts `cp1252`, `windows-1252`, `1252`, `latin1`, `iso-8859-1`, etc.
 */
export function canonicalEncoding(raw: string): string {
  const s = raw.trim().toLowerCase().replace(/[\s_]/g, '-');
  const cpMatch = s.match(/^(?:cp-?|windows-?|win-?)?(\d{3,4})$/);
  if (cpMatch) return `cp${cpMatch[1]}`;
  if (s === 'latin1' || s === 'latin-1') return 'iso-8859-1';
  if (s === 'latin2' || s === 'latin-2') return 'iso-8859-2';
  return s;
}

export function isEncodingSupported(name: string): boolean {
  return iconv.encodingExists(canonicalEncoding(name));
}

export function decodeBytes(buf: Uint8Array, encoding: string): string {
  return iconv.decode(Buffer.from(buf), canonicalEncoding(encoding));
}
