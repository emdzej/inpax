import { describe, it, expect } from 'vitest';
import { sha256Hex, computeChecksum, checksumEquals } from '../checksum.js';

describe('sha256Hex', () => {
  it('matches a known SHA-256 of empty input', () => {
    expect(sha256Hex(new Uint8Array())).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });
  it('matches a known SHA-256 of "abc"', () => {
    expect(sha256Hex(new TextEncoder().encode('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('checksumEquals', () => {
  it('returns true for identical algorithm + value', () => {
    expect(
      checksumEquals(
        { algorithm: 'sha256', value: 'a'.repeat(64) },
        { algorithm: 'sha256', value: 'a'.repeat(64) },
      ),
    ).toBe(true);
  });
  it('returns false for different values', () => {
    expect(
      checksumEquals(
        { algorithm: 'sha256', value: 'a'.repeat(64) },
        { algorithm: 'sha256', value: 'b'.repeat(64) },
      ),
    ).toBe(false);
  });
});

describe('computeChecksum', () => {
  it('produces sha256 by default', () => {
    const c = computeChecksum(new Uint8Array([1, 2, 3]));
    expect(c.algorithm).toBe('sha256');
    expect(c.value).toMatch(/^[0-9a-f]{64}$/);
  });
});
