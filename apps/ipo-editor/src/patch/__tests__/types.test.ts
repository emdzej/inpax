/**
 * Schema-level tests — make sure the Zod validators reject malformed
 * patch documents (wrong types, missing fields, bad hex) and accept
 * minimum-viable ones.
 */

import { describe, it, expect } from 'vitest';
import { PatchDocumentSchema, ChecksumSchema } from '../types.js';

describe('ChecksumSchema', () => {
  it('accepts lowercase hex sha256', () => {
    const r = ChecksumSchema.safeParse({
      algorithm: 'sha256',
      value: 'a'.repeat(64),
    });
    expect(r.success).toBe(true);
  });
  it('rejects uppercase hex', () => {
    const r = ChecksumSchema.safeParse({
      algorithm: 'sha256',
      value: 'A'.repeat(64),
    });
    expect(r.success).toBe(false);
  });
  it('rejects unknown algorithm', () => {
    const r = ChecksumSchema.safeParse({ algorithm: 'md5', value: 'a'.repeat(32) });
    expect(r.success).toBe(false);
  });
  it('rejects a digest with the wrong length', () => {
    const r = ChecksumSchema.safeParse({
      algorithm: 'sha256',
      value: 'a'.repeat(63),
    });
    expect(r.success).toBe(false);
  });
  it('coerces all-digit numeric values back to string (YAML round-trip safety)', () => {
    // SHA-256 hashes that happen to be all digits are astronomically rare
    // but theoretically possible — yaml parses such a value as a number,
    // so we coerce before regex matching.
    const r = ChecksumSchema.safeParse({
      algorithm: 'sha256',
      value: 1234567890 as unknown as string,
    });
    // Will fail length check, but should fail there — not on type — so
    // the failure message points at the real problem.
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues[0];
      expect(issue.message).toMatch(/must be 64 hex chars/);
    }
  });
});

describe('PatchDocumentSchema', () => {
  const validDoc = {
    inpax_patch_version: 1 as const,
    original: {
      name: 'ms43.ipo',
      location: 'inpa',
      checksum: { algorithm: 'sha256' as const, value: 'f'.repeat(64) },
    },
    target_encoding: 'cp1252',
    patches: [
      { index: 0, type: 'string' as const, value: 'hello' },
      { index: 1, type: 'int' as const, value: 42 },
      { index: 2, type: 'bool' as const, value: true },
    ],
  };

  it('accepts a complete minimal document', () => {
    const r = PatchDocumentSchema.safeParse(validDoc);
    expect(r.success).toBe(true);
  });

  it('defaults target_encoding to cp1252 when omitted', () => {
    const { target_encoding, ...withoutEnc } = validDoc;
    void target_encoding;
    const r = PatchDocumentSchema.safeParse(withoutEnc);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.target_encoding).toBe('cp1252');
  });

  it('rejects negative index', () => {
    const r = PatchDocumentSchema.safeParse({
      ...validDoc,
      patches: [{ index: -1, type: 'string', value: 'x' }],
    });
    expect(r.success).toBe(false);
  });

  it('rejects unsupported value type string', () => {
    const r = PatchDocumentSchema.safeParse({
      ...validDoc,
      patches: [{ index: 0, type: 'handle1', value: 1 }],
    });
    expect(r.success).toBe(false);
  });

  it('rejects unknown version', () => {
    const r = PatchDocumentSchema.safeParse({ ...validDoc, inpax_patch_version: 2 });
    expect(r.success).toBe(false);
  });

  it('rejects missing original', () => {
    const { original, ...rest } = validDoc;
    void original;
    const r = PatchDocumentSchema.safeParse(rest);
    expect(r.success).toBe(false);
  });
});
