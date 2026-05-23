/**
 * SHA-256 checksum of arbitrary IPO bytes — used to verify a patch
 * was generated against the same IPO it's being applied to.
 *
 * Node's `crypto` module covers this without any extra deps; we wrap
 * it in a thin helper so the patch code can think in terms of
 * `Checksum` documents rather than hash-API minutiae.
 */

import { createHash } from 'node:crypto';
import type { Checksum } from './types.js';

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function computeChecksum(bytes: Uint8Array): Checksum {
  return { algorithm: 'sha256', value: sha256Hex(bytes) };
}

export function checksumEquals(a: Checksum, b: Checksum): boolean {
  return a.algorithm === b.algorithm && a.value === b.value;
}
