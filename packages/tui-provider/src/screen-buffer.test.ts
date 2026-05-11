import { describe, it, expect } from 'vitest';
import { ScreenBuffer } from './screen-buffer.js';

describe('ScreenBuffer.renderSpans', () => {
  it('emits one row per buffer row', () => {
    const buf = new ScreenBuffer(5, 3);
    const rows = buf.renderSpans();
    expect(rows).toHaveLength(3);
  });

  it('coalesces consecutive cells with identical fg/bg into one span', () => {
    const buf = new ScreenBuffer(10, 1);
    const row = buf.renderSpans()[0];

    // Empty buffer = all default cells = single span covering the row.
    expect(row).toHaveLength(1);
    expect(row[0]).toEqual({ text: '          ', fg: 7, bg: 0 });
  });

  it('splits into multiple spans when fg or bg changes mid-row', () => {
    const buf = new ScreenBuffer(10, 1);
    buf.write(0, 2, 'XYZ', 1, 0);
    const row = buf.renderSpans()[0];

    // Expect: 2 leading default cells, 3 styled cells, 5 trailing default cells
    expect(row).toEqual([
      { text: '  ', fg: 7, bg: 0 },
      { text: 'XYZ', fg: 1, bg: 0 },
      { text: '     ', fg: 7, bg: 0 },
    ]);
  });

  it('does not include any raw ANSI/SGR escape characters', () => {
    const buf = new ScreenBuffer(20, 5);
    buf.write(1, 3, 'Battery', 1, 0);
    buf.write(1, 12, 'Ignition', 2, 0);

    const rows = buf.renderSpans();
    for (const row of rows) {
      for (const span of row) {
        // Guard against any future regression where SGR leaks back in.
        // ink's width measurement is what broke last time — escape bytes
        // counted as visible chars, causing rows to wrap and zebra-stripe.
        expect(span.text).not.toMatch(/\x1b\[/);
      }
    }
  });

  it('coalesces matched styles across an INPA-typical write pattern', () => {
    // Mimic INPA's behaviour: two labels written at distinct columns on
    // the same row, both red on default bg. Between, after, and around
    // them, default-styled spaces. We should see exactly 5 spans —
    // two non-default runs, three default runs.
    const buf = new ScreenBuffer(40, 1);
    buf.write(0, 2, 'Battery :', 1, 0);
    buf.write(0, 20, 'Ignition :', 1, 0);

    const row = buf.renderSpans()[0];
    expect(row).toHaveLength(5);
    expect(row[0].fg).toBe(7); // default
    expect(row[1].text).toBe('Battery :');
    expect(row[1].fg).toBe(1); // red
    expect(row[2].fg).toBe(7);
    expect(row[3].text).toBe('Ignition :');
    expect(row[3].fg).toBe(1);
    expect(row[4].fg).toBe(7);
  });

  it('total span lengths across a row sum to the buffer width', () => {
    const buf = new ScreenBuffer(80, 2);
    buf.write(0, 10, 'hello', 1, 0);
    buf.write(0, 30, 'world', 2, 0);

    for (const row of buf.renderSpans()) {
      const totalChars = row.reduce((n, span) => n + span.text.length, 0);
      expect(totalChars).toBe(80);
    }
  });
});
