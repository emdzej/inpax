/**
 * `applyPatches` tests against a synthetic WalkResult. We bypass the
 * real walker — apply's logic depends on the `constants` array, the
 * `constantsBlock` byte ranges, and the source `bytes` for checksum
 * computation, but it doesn't care whether those bytes are valid IPO
 * elsewhere. Faking them keeps the test independent of any fixture
 * and exercises every code path (checksum verify / ignore, type
 * mismatch, conflict-refuse, conflict-last-wins, encoding error).
 */

import { describe, it, expect } from 'vitest';
import { ValueType } from '@emdzej/inpax-core';
import { applyPatches } from '../apply.js';
import { initPatch } from '../init.js';
import { computeChecksum } from '../checksum.js';
import type { ConstantRecord, WalkResult } from '../../lib/walker.js';
import type { BlockRecord } from '../../lib/walker.js';
import type { PatchDocument } from '../types.js';

// Bytes the walker would have read off disk. The content beyond what
// `constantsBlock` covers can be anything for our purposes — we only
// rebuild the constants section.
function makeBytes(): Uint8Array {
  return new Uint8Array([
    // header-ish prefix (10 bytes)
    0x49, 0x50, 0x4f, 0, 0, 0, 0, 0, 0, 0,
    // constants payload start (we set payloadStart = 10)
    // arbitrary placeholder bytes — overwritten by apply
    0xff, 0xff, 0xff, 0xff, 0xff,
    // constants payload end (end = 15)
    // suffix
    0xaa, 0xbb,
  ]);
}

function makeWalk(constants: ConstantRecord[]): WalkResult {
  const bytes = makeBytes();
  const constantsBlock: BlockRecord = {
    type: 0x12, // BlockType.ConstantData — unused by apply
    name: 'ConstantData',
    blockId: 0,
    flags: 0,
    args: 0,
    headerStart: 0,
    payloadStart: 10,
    end: 15,
  } as unknown as BlockRecord;
  return {
    bytes,
    blocks: [constantsBlock],
    constantsBlock,
    constants,
    codepage: 'cp1252',
  };
}

const baseConstants: ConstantRecord[] = [
  { index: 0, type: ValueType.String, offset: 0, byteLength: 7, value: 'hello' },
  { index: 1, type: ValueType.Int, offset: 7, byteLength: 3, value: 42 },
  { index: 2, type: ValueType.String, offset: 10, byteLength: 8, value: 'world!' },
];

function makePatch(walk: WalkResult, entries: PatchDocument['patches']): PatchDocument {
  return {
    inpax_patch_version: 1,
    original: {
      name: 'demo.ipo',
      location: 'inpa',
      checksum: computeChecksum(walk.bytes),
    },
    target_encoding: 'cp1252',
    patches: entries,
  };
}

describe('applyPatches — checksum verification', () => {
  it('accepts a patch whose checksum matches the IPO bytes', () => {
    const walk = makeWalk(baseConstants);
    const patch = makePatch(walk, [{ index: 0, type: 'string', value: 'CIAO' }]);
    const result = applyPatches(walk, { patches: [patch] });
    expect(result.warnings).toEqual([]);
    expect(result.effectiveEdits.get(0)).toBe('CIAO');
  });

  it('rejects a patch with a stale checksum', () => {
    const walk = makeWalk(baseConstants);
    const patch = makePatch(walk, [{ index: 0, type: 'string', value: 'CIAO' }]);
    patch.original.checksum = { algorithm: 'sha256', value: '0'.repeat(64) };
    expect(() => applyPatches(walk, { patches: [patch] })).toThrow(/checksum mismatch/);
  });

  it('allows --ignore-checksum override but reports a warning', () => {
    const walk = makeWalk(baseConstants);
    const patch = makePatch(walk, [{ index: 0, type: 'string', value: 'CIAO' }]);
    patch.original.checksum = { algorithm: 'sha256', value: '0'.repeat(64) };
    const result = applyPatches(walk, { patches: [patch], ignoreChecksum: true });
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toMatch(/checksum mismatch/);
  });
});

describe('applyPatches — type validation', () => {
  it('throws when patch type does not match IPO byte code', () => {
    const walk = makeWalk(baseConstants);
    // const[1] is Int in the IPO, but patch declares string
    const patch = makePatch(walk, [{ index: 1, type: 'string', value: 'not allowed' }]);
    expect(() => applyPatches(walk, { patches: [patch] })).toThrow(/type mismatch/);
  });

  it('throws when patch references out-of-range index', () => {
    const walk = makeWalk(baseConstants);
    const patch = makePatch(walk, [{ index: 999, type: 'string', value: 'oops' }]);
    expect(() => applyPatches(walk, { patches: [patch] })).toThrow(/out of range/);
  });

  it('throws when value shape disagrees with declared type', () => {
    const walk = makeWalk(baseConstants);
    const patch = makePatch(walk, [{ index: 1, type: 'int', value: 'not a number' as never }]);
    expect(() => applyPatches(walk, { patches: [patch] })).toThrow(/expected numeric/);
  });
});

describe('applyPatches — conflict policy', () => {
  it('refuses overlapping entries by default', () => {
    const walk = makeWalk(baseConstants);
    const p1 = makePatch(walk, [{ index: 0, type: 'string', value: 'first' }]);
    const p2 = makePatch(walk, [{ index: 0, type: 'string', value: 'second' }]);
    expect(() => applyPatches(walk, { patches: [p1, p2] })).toThrow(/conflict/);
  });

  it('lets the later value win when --on-conflict last-wins', () => {
    const walk = makeWalk(baseConstants);
    const p1 = makePatch(walk, [{ index: 0, type: 'string', value: 'first' }]);
    const p2 = makePatch(walk, [{ index: 0, type: 'string', value: 'second' }]);
    const result = applyPatches(walk, {
      patches: [p1, p2],
      onConflict: 'last-wins',
    });
    expect(result.effectiveEdits.get(0)).toBe('second');
  });

  it('refuses conflicts inside a single patch as well', () => {
    const walk = makeWalk(baseConstants);
    const patch = makePatch(walk, [
      { index: 0, type: 'string', value: 'a' },
      { index: 0, type: 'string', value: 'b' },
    ]);
    expect(() => applyPatches(walk, { patches: [patch] })).toThrow(/conflict/);
  });
});

describe('applyPatches — encoding safety', () => {
  it('throws when a string character cannot be encoded into target_encoding', () => {
    const walk = makeWalk(baseConstants);
    // U+0142 (Polish ł) is not in cp1252 — only in cp1250
    const patch = makePatch(walk, [{ index: 0, type: 'string', value: 'kałuża' }]);
    expect(() => applyPatches(walk, { patches: [patch] })).toThrow(
      /cannot be encoded as cp1252/,
    );
  });

  it('accepts the same character when target_encoding is cp1250', () => {
    const walk = makeWalk(baseConstants);
    const patch = makePatch(walk, [{ index: 0, type: 'string', value: 'kałuża' }]);
    patch.target_encoding = 'cp1250';
    const result = applyPatches(walk, { patches: [patch] });
    expect(result.effectiveEdits.get(0)).toBe('kałuża');
  });

  it('warns when output encoding is not cp1252 (real-INPA compatibility hazard)', () => {
    const walk = makeWalk(baseConstants);
    const patch = makePatch(walk, [{ index: 0, type: 'string', value: 'kałuża' }]);
    patch.target_encoding = 'cp1250';
    const result = applyPatches(walk, { patches: [patch] });
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => /cp1250/.test(w) && /INPA/.test(w))).toBe(true);
  });

  it('does NOT warn when output encoding stays cp1252', () => {
    const walk = makeWalk(baseConstants);
    const patch = makePatch(walk, [{ index: 0, type: 'string', value: 'hello' }]);
    const result = applyPatches(walk, { patches: [patch] });
    expect(result.warnings).toEqual([]);
  });
});

describe('applyPatches — multi-patch flow', () => {
  it('applies non-conflicting entries from multiple patches', () => {
    const walk = makeWalk(baseConstants);
    const p1 = makePatch(walk, [{ index: 0, type: 'string', value: 'one' }]);
    const p2 = makePatch(walk, [{ index: 2, type: 'string', value: 'two' }]);
    const result = applyPatches(walk, { patches: [p1, p2] });
    expect(result.effectiveEdits.get(0)).toBe('one');
    expect(result.effectiveEdits.get(2)).toBe('two');
  });

  it('verifies every patch against the same input checksum', () => {
    const walk = makeWalk(baseConstants);
    const good = makePatch(walk, [{ index: 0, type: 'string', value: 'one' }]);
    const stale = makePatch(walk, [{ index: 2, type: 'string', value: 'two' }]);
    stale.original.checksum = { algorithm: 'sha256', value: '1'.repeat(64) };
    expect(() => applyPatches(walk, { patches: [good, stale] })).toThrow(/checksum mismatch/);
  });
});

describe('init → apply round-trip', () => {
  it('init emits the current values, apply with unchanged patch is a no-op', () => {
    const walk = makeWalk(baseConstants);
    const doc = initPatch(walk, { name: 'demo.ipo', location: 'inpa', targetEncoding: 'cp1252' });
    const result = applyPatches(walk, { patches: [doc] });
    expect(result.effectiveEdits.get(0)).toBe('hello');
    expect(result.effectiveEdits.get(2)).toBe('world!');
  });
});
