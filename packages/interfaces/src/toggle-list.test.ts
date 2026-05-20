import { describe, it, expect } from 'vitest';
import { orToggleMasks, formatToggleIndices, encodeTogglelistResult } from './toggle-list.js';
import type { ToggleItem } from './ui.js';

describe('orToggleMasks', () => {
  // The wire format is 9 bytes per mask, semicolon-delimited, `0xNN`
  // prefixed with uppercase hex digits — verified against
  // KOMBI.IPO's STEUERN_LEUCHTE call chain.
  const tempomatMask = '0x00;0x00;0x00;0x08;0x00;0x00;0x00;0x00;0x00';
  const rdkGelbMask = '0x00;0x00;0x00;0x40;0x00;0x00;0x00;0x00;0x00';

  it('returns empty string for an empty selection', () => {
    expect(orToggleMasks([])).toBe('');
  });

  it('round-trips a single mask through the bit-OR + format path', () => {
    expect(orToggleMasks([tempomatMask])).toBe(tempomatMask);
  });

  it('OR-combines two masks byte-by-byte', () => {
    expect(orToggleMasks([tempomatMask, rdkGelbMask]))
      .toBe('0x00;0x00;0x00;0x48;0x00;0x00;0x00;0x00;0x00');
  });

  it('OR-combines three masks across different byte positions', () => {
    // Bremsbeläge gelb sets bits in two positions (per the real
    // KOMBI.IPO LineFunc arg2 we found during reverse engineering).
    const bremsbelagMask = '0x00;0x00;0x00;0x80;0x00;0x80;0x00;0x00;0x00';
    expect(orToggleMasks([tempomatMask, rdkGelbMask, bremsbelagMask]))
      .toBe('0x00;0x00;0x00;0xC8;0x00;0x80;0x00;0x00;0x00');
  });

  it('tolerates bare hex digits without the 0x prefix', () => {
    // Mimics dialog-typed values that lose the prefix when round-
    // tripped through a text input. Real INPA always writes the 0x
    // form, but being lenient on input avoids surprise failures.
    expect(orToggleMasks(['08;10;00', '02;00;FF']))
      .toBe('0x0A;0x10;0xFF');
  });

  it('pads shorter masks with zeros to the longest length', () => {
    expect(orToggleMasks(['0x01', '0x00;0x02;0x04']))
      .toBe('0x01;0x02;0x04');
  });
});

describe('formatToggleIndices', () => {
  it('returns empty string for no indices', () => {
    expect(formatToggleIndices([])).toBe('');
  });

  it('formats 1-based indices, ascending', () => {
    // Input is 0-based (matches the dialog's internal `Set<number>`
    // of array indices); output is 1-based per INPA convention.
    expect(formatToggleIndices([0, 2, 6])).toBe('1 3 7');
  });

  it('sorts indices regardless of input order', () => {
    expect(formatToggleIndices([6, 0, 2])).toBe('1 3 7');
  });
});

describe('encodeTogglelistResult', () => {
  const items: ToggleItem[] = [
    { name: 'Tempomat',  mask: '0x00;0x00;0x00;0x08;0x00;0x00;0x00;0x00;0x00' },
    { name: 'RDKS gelb', mask: '0x00;0x00;0x00;0x40;0x00;0x00;0x00;0x00;0x00' },
    { name: 'ASC',       mask: '0x00;0x00;0x00;0x01;0x00;0x00;0x00;0x00;0x00' },
  ];

  it('encodes picks as OR-combined masks when argNum=false', () => {
    // 0 + 1 → Tempomat + RDKS gelb. argNum=false → bitmask path.
    expect(encodeTogglelistResult(items, [0, 1], false))
      .toBe('0x00;0x00;0x00;0x48;0x00;0x00;0x00;0x00;0x00');
  });

  it('encodes picks as 1-based indices when argNum=true', () => {
    expect(encodeTogglelistResult(items, [0, 2], true)).toBe('1 3');
  });

  it('drops out-of-range indices silently', () => {
    // The dialog might pass an index that was valid at click time
    // but became stale (e.g. live screen swap). Don't blow up;
    // just ignore the bogus entry.
    expect(encodeTogglelistResult(items, [0, 99, -1], false))
      .toBe(items[0].mask);
  });

  it('returns empty string when nothing was picked', () => {
    expect(encodeTogglelistResult(items, [], false)).toBe('');
    expect(encodeTogglelistResult(items, [], true)).toBe('');
  });
});
