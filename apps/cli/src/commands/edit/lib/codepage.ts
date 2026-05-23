import iconv from 'iconv-lite';

/**
 * Canonicalise common codepage spellings to the names iconv-lite
 * understands. Accepts `cp1252`, `cp-1252`, `windows-1252`, `1252`,
 * `latin1`, etc.
 */
export function canonicalCodepage(raw: string): string {
  const s = raw.trim().toLowerCase().replace(/[\s_]/g, '-');
  if (/^(cp-?|windows-?|win-?|)?(\d{3,4})$/.test(s)) {
    const m = s.match(/(\d{3,4})$/)!;
    return `cp${m[1]}`;
  }
  if (s === 'latin1' || s === 'latin-1') return 'iso-8859-1';
  if (s === 'latin2' || s === 'latin-2') return 'iso-8859-2';
  return s;
}

export function isCodepageSupported(name: string): boolean {
  return iconv.encodingExists(canonicalCodepage(name));
}

export function decode(buf: Uint8Array, codepage: string): string {
  return iconv.decode(Buffer.from(buf), canonicalCodepage(codepage));
}

export function encode(value: string, codepage: string): Uint8Array {
  return new Uint8Array(iconv.encode(value, canonicalCodepage(codepage)));
}

/**
 * Returns the first character (and its index) that would be lost when
 * encoding `value` to `codepage`. Used by the string editor to flag
 * out-of-range characters before save.
 */
export function findUnmappable(
  value: string,
  codepage: string,
): { index: number; char: string } | undefined {
  const cp = canonicalCodepage(codepage);
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    const encoded = iconv.encode(ch, cp);
    const back = iconv.decode(encoded, cp);
    if (back !== ch) {
      return { index: i, char: ch };
    }
  }
  return undefined;
}
