/**
 * `initPatch` tests against a synthetic WalkResult. We bypass the
 * real walker because the unit-under-test only depends on the
 * `constants` array and the `bytes` (for checksum); fabricating both
 * keeps the test fast and independent of any IPO fixture.
 */
import { describe, it, expect } from 'vitest';
import { ValueType } from '@emdzej/inpax-core';
import { initPatch } from '../init.js';
import type { ConstantRecord, WalkResult } from '../../lib/walker.js';

function makeWalk(bytes: Uint8Array, constants: ConstantRecord[]): WalkResult {
  return {
    bytes,
    blocks: [],
    constantsBlock: null,
    constants,
    codepage: 'cp1252',
  };
}

const constants: ConstantRecord[] = [
  { index: 0, type: ValueType.String, offset: 0, byteLength: 7, value: 'hello' },
  { index: 1, type: ValueType.Int, offset: 7, byteLength: 3, value: 42 },
  { index: 2, type: ValueType.Bool, offset: 10, byteLength: 2, value: true },
  { index: 3, type: ValueType.String, offset: 12, byteLength: 8, value: 'world!' },
];

describe('initPatch', () => {
  it('emits strings only by default', () => {
    const doc = initPatch(makeWalk(new Uint8Array([1, 2, 3]), constants), {
      name: 'demo.ipo',
      location: 'inpa',
      targetEncoding: 'cp1252',
    });
    expect(doc.patches.map((p) => p.index)).toEqual([0, 3]);
    expect(doc.patches.every((p) => p.type === 'string')).toBe(true);
  });

  it('honours the `types` filter', () => {
    const doc = initPatch(makeWalk(new Uint8Array(), constants), {
      name: 'demo.ipo',
      location: 'inpa',
      targetEncoding: 'cp1252',
      types: ['int', 'bool'],
    });
    expect(doc.patches.map((p) => p.index)).toEqual([1, 2]);
  });

  it('stamps the IPO bytes\' SHA-256 into `original.checksum`', () => {
    const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const doc = initPatch(makeWalk(bytes, constants), {
      name: 'demo.ipo',
      location: 'inpa',
      targetEncoding: 'cp1252',
    });
    expect(doc.original.checksum.algorithm).toBe('sha256');
    expect(doc.original.checksum.value).toMatch(/^[0-9a-f]{64}$/);
  });

  it('adds notes when `withNotes: true`', () => {
    const doc = initPatch(makeWalk(new Uint8Array(), constants), {
      name: 'demo.ipo',
      location: 'inpa',
      targetEncoding: 'cp1252',
      withNotes: true,
    });
    expect(doc.patches[0].notes).toBeDefined();
    expect(doc.patches[0].notes).toMatch(/offset/);
  });

  it('omits notes by default', () => {
    const doc = initPatch(makeWalk(new Uint8Array(), constants), {
      name: 'demo.ipo',
      location: 'inpa',
      targetEncoding: 'cp1252',
    });
    expect(doc.patches.every((p) => p.notes === undefined)).toBe(true);
  });

  it('preserves the original constant values in patch entries', () => {
    const doc = initPatch(makeWalk(new Uint8Array(), constants), {
      name: 'demo.ipo',
      location: 'inpa',
      targetEncoding: 'cp1252',
      types: ['string', 'int', 'bool'],
    });
    const byIndex = new Map(doc.patches.map((p) => [p.index, p.value]));
    expect(byIndex.get(0)).toBe('hello');
    expect(byIndex.get(1)).toBe(42);
    expect(byIndex.get(2)).toBe(true);
    expect(byIndex.get(3)).toBe('world!');
  });
});
