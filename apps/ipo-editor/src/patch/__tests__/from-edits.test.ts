import { describe, it, expect } from 'vitest';
import { ValueType } from '@emdzej/inpax-core';
import { patchFromEdits } from '../from-edits.js';
import type { ConstantRecord, ConstValue, WalkResult } from '../../lib/walker.js';

function makeWalk(bytes: Uint8Array, constants: ConstantRecord[]): WalkResult {
  return { bytes, blocks: [], constantsBlock: null, constants, codepage: 'cp1252' };
}

const constants: ConstantRecord[] = [
  { index: 0, type: ValueType.String, offset: 0, byteLength: 7, value: 'hello' },
  { index: 1, type: ValueType.Int, offset: 7, byteLength: 3, value: 42 },
  { index: 2, type: ValueType.String, offset: 10, byteLength: 8, value: 'world' },
];

describe('patchFromEdits', () => {
  it('emits only edited entries (not the whole constant table)', () => {
    const walk = makeWalk(new Uint8Array([1, 2, 3]), constants);
    const edits = new Map<number, ConstValue>([[0, 'CIAO']]);
    const doc = patchFromEdits(walk, edits, {
      name: 'demo.ipo',
      location: 'inpa',
      targetEncoding: 'cp1252',
    });
    expect(doc.patches.map((p) => p.index)).toEqual([0]);
    expect(doc.patches[0].value).toBe('CIAO');
  });

  it('preserves the constant type from the source IPO', () => {
    const walk = makeWalk(new Uint8Array(), constants);
    const edits = new Map<number, ConstValue>([
      [0, 'CIAO'],
      [1, 99],
    ]);
    const doc = patchFromEdits(walk, edits, {
      name: 'demo.ipo',
      location: 'inpa',
      targetEncoding: 'cp1252',
    });
    expect(doc.patches.find((p) => p.index === 0)?.type).toBe('string');
    expect(doc.patches.find((p) => p.index === 1)?.type).toBe('int');
  });

  it('emits index-ordered output regardless of insertion order', () => {
    const walk = makeWalk(new Uint8Array(), constants);
    const edits = new Map<number, ConstValue>([
      [2, 'world!'],
      [0, 'CIAO'],
    ]);
    const doc = patchFromEdits(walk, edits, {
      name: 'demo.ipo',
      location: 'inpa',
      targetEncoding: 'cp1252',
    });
    expect(doc.patches.map((p) => p.index)).toEqual([0, 2]);
  });

  it('stamps the IPO bytes\' checksum into original.checksum', () => {
    const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const walk = makeWalk(bytes, constants);
    const doc = patchFromEdits(walk, new Map([[0, 'x']]), {
      name: 'demo.ipo',
      location: 'inpa',
      targetEncoding: 'cp1252',
    });
    expect(doc.original.checksum.value).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns an empty patches array when there are no edits', () => {
    const walk = makeWalk(new Uint8Array(), constants);
    const doc = patchFromEdits(walk, new Map(), {
      name: 'demo.ipo',
      location: 'inpa',
      targetEncoding: 'cp1252',
    });
    expect(doc.patches).toEqual([]);
  });
});
