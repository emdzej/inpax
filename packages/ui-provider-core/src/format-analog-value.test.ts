import { describe, it, expect } from 'vitest';
import { formatAnalogValue } from './ui-provider.js';

describe('formatAnalogValue', () => {
  describe('BEST2 bare width.precision spec', () => {
    // The format spec MS43 passes to every analogout: `"4.2"` =
    // width 4, 2 decimals. This is the regression-test target —
    // we used to return the literal `"4.2"` here and every gauge
    // in the analog screen displayed that instead of the real
    // reading. See `formatAnalogValue` in `ui-provider.ts` for the
    // long-form explanation.
    it('"4.2" → 2 decimals, padded to width 4 (MS43 default)', () => {
      expect(formatAnalogValue(12.345, '4.2')).toBe('12.35');
      expect(formatAnalogValue(1.2, '4.2')).toBe('1.20');
      expect(formatAnalogValue(-5.5, '4.2')).toBe('-5.50');
    });

    it('".2" → 2 decimals, no padding', () => {
      expect(formatAnalogValue(7, '.2')).toBe('7.00');
      expect(formatAnalogValue(12.345, '.2')).toBe('12.35');
    });

    it('"5" → integer rounded, padded to width 5', () => {
      expect(formatAnalogValue(840.7, '5')).toBe('  841');
      expect(formatAnalogValue(12345.6, '5')).toBe('12346');
    });

    it('tolerates surrounding whitespace', () => {
      expect(formatAnalogValue(1.5, ' 4.2 ')).toBe('1.50');
    });

    it('falls back to value.toString when format is empty', () => {
      expect(formatAnalogValue(12.3, '')).toBe('12.3');
    });
  });

  describe('C printf-style spec', () => {
    it('"%.1f" → 1 decimal substituted in place', () => {
      expect(formatAnalogValue(12.34, '%.1f')).toBe('12.3');
    });

    it('"%5.2f V" → spec replaced, surrounding text kept', () => {
      expect(formatAnalogValue(13.5, '%5.2f V')).toBe('13.50 V');
    });

    it('"%d" → integer rounded, no decimals', () => {
      expect(formatAnalogValue(841.7, '%d')).toBe('842');
    });

    it('"%5d" → integer left-padded', () => {
      expect(formatAnalogValue(12, '%5d')).toBe('   12');
    });
  });

  describe('unparseable formats', () => {
    // Better to surface the spec than silently swallow it — at
    // least a developer can spot it in the UI and report.
    it('returns format unchanged when it parses as neither', () => {
      expect(formatAnalogValue(12.3, 'banana')).toBe('banana');
    });
  });
});
