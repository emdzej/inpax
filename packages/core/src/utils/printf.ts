/**
 * C-style printf formatting helpers shared by both EDIABAS-side
 * (`INPAapiResultText`) and Win32-side (`wvsprintfA`) code paths.
 *
 * INPA scripts use a fairly conservative subset of conversion specs:
 *   %d %i  — signed int
 *   %u     — unsigned int
 *   %o     — octal
 *   %x %X  — hex (lower / upper)
 *   %f %F  — fixed-point real
 *   %e %E  — scientific real
 *   %g %G  — shortest real
 *   %s     — string
 *   %c     — single char
 *
 * Width / precision flags are honoured for the simple cases; rarely
 * used C-flags (`-`, `+`, `#`, space, `0`) are tolerated in the
 * grammar but not all of them produce padding the way Visual C does —
 * close enough for diagnostic UI strings.
 */

const SPEC_RE = /%(-?)([+#0 ]*)(\d*)(?:\.(\d+))?([dioxXuefgEFG sc])/;

function formatOne(value: unknown, spec: RegExpMatchArray): string {
  const leftAlign = spec[1] === '-';
  const width = spec[3] ? parseInt(spec[3], 10) : 0;
  const precision = spec[4] !== undefined ? parseInt(spec[4], 10) : undefined;
  const conv = spec[5];

  let body: string;
  switch (conv) {
    case 'd':
    case 'i':
      body = String(Math.trunc(Number(value)));
      break;
    case 'u':
      body = String(Math.trunc(Number(value)) >>> 0);
      break;
    case 'o':
      body = (Math.trunc(Number(value)) >>> 0).toString(8);
      break;
    case 'x':
      body = (Math.trunc(Number(value)) >>> 0).toString(16);
      break;
    case 'X':
      body = (Math.trunc(Number(value)) >>> 0).toString(16).toUpperCase();
      break;
    case 'f':
    case 'F': {
      const n = Number(value);
      body = precision !== undefined ? n.toFixed(precision) : n.toFixed(6);
      break;
    }
    case 'e':
      body =
        precision !== undefined
          ? Number(value).toExponential(precision)
          : Number(value).toExponential();
      break;
    case 'E':
      body = (
        precision !== undefined
          ? Number(value).toExponential(precision)
          : Number(value).toExponential()
      ).toUpperCase();
      break;
    case 'g':
    case 'G': {
      const p = precision ?? 6;
      const n = Number(value);
      const rendered = n.toPrecision(p);
      body = conv === 'G' ? rendered.toUpperCase() : rendered;
      break;
    }
    case 's':
      body = String(value ?? '');
      if (precision !== undefined) body = body.slice(0, precision);
      break;
    case 'c':
      body = String(value ?? '').charAt(0);
      break;
    default:
      body = String(value);
  }

  if (width > 0 && body.length < width) {
    body = leftAlign ? body.padEnd(width, ' ') : body.padStart(width, ' ');
  }
  return body;
}

/**
 * Format a single value through one printf-style spec inside `format`,
 * preserving the literal text around it. Matches what
 * `INPAapiResultText` expects — its caller hands us a format that
 * always contains exactly one conversion (e.g. `"%5.2f V"`).
 */
export function formatSingle(value: unknown, format: string): string {
  const match = format.match(SPEC_RE);
  if (!match) return String(value ?? '');
  return format.replace(match[0], formatOne(value, match));
}

/**
 * Format a format string with multiple positional args (sprintf-style).
 * Substitutes each `%…` conversion in `format` with the next value
 * from `args`. Unknown conversions are left as-is. Used by
 * `wvsprintfA` and any future variadic formatter.
 */
export function formatMany(format: string, args: unknown[]): string {
  let out = '';
  let cursor = 0;
  let argIdx = 0;
  // Walk specs left-to-right so positional order matches printf.
  while (cursor < format.length) {
    const slice = format.slice(cursor);
    const match = slice.match(SPEC_RE);
    if (!match) {
      out += slice;
      break;
    }
    const matchIndex = match.index ?? 0;
    out += slice.slice(0, matchIndex);
    if (match[0] === '%%') {
      out += '%';
    } else {
      out += formatOne(args[argIdx++], match);
    }
    cursor += matchIndex + match[0].length;
  }
  return out;
}
