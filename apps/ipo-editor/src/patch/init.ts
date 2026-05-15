/**
 * Generate a fresh patch document from an IPO file.
 *
 * Default behaviour: include every string constant (translators'
 * primary use case), no notes. Callers can broaden the type filter
 * or opt into notes via `InitOptions`.
 */

import type { WalkResult } from '../lib/walker.js';
import { computeChecksum } from './checksum.js';
import { constantTypeFor } from './value-type.js';
import type {
  ConstantType,
  PatchDocument,
  PatchEntry,
  PatchValue,
} from './types.js';

export interface InitOptions {
  /**
   * IPO basename — the file the patch targets. Stored as the patch's
   * `original.name`; consumers use it for display + sanity checks.
   */
  name: string;
  /**
   * Categorical tag for the BMW subtree the file belongs to
   * (`inpa`, `nfs`, `ncsexpert`, ...). Free-form on purpose.
   */
  location: string;
  /**
   * Codepage strings in the source IPO are decoded from. Becomes the
   * patch's `target_encoding` — apply uses it to encode UTF-8 patch
   * values back into the IPO's byte representation.
   */
  targetEncoding: string;
  /**
   * Which constant types to include. Default `['string']` — the
   * translator case. Pass an explicit list to include integers,
   * reals, etc.
   */
  types?: readonly ConstantType[];
  /**
   * Synthesise a `notes` field for each entry. Currently we just emit
   * a placeholder telling the user where to look; future work can
   * surface real usage info (e.g. cross-referenced from disassembly).
   */
  withNotes?: boolean;
  /** Optional free-form description carried in the patch document. */
  description?: string;
}

/**
 * Build a patch document from a walked IPO. The returned doc is
 * ready to serialise via `patchToYaml` — its `patches` array starts
 * with the IPO's current constant values so a translator's workflow
 * is *open patch → edit values → save → apply*.
 *
 * The original file's SHA-256 lives in `original.checksum`, computed
 * from `walk.bytes` — the bytes the walker read off disk. This is
 * what `apply` will verify against later.
 */
export function initPatch(walk: WalkResult, options: InitOptions): PatchDocument {
  const types = options.types ?? ['string'];
  const typeSet = new Set<ConstantType>(types);
  const patches: PatchEntry[] = [];

  for (const c of walk.constants) {
    const ct = constantTypeFor(c.type);
    if (!ct || !typeSet.has(ct)) continue;
    const entry: PatchEntry = {
      index: c.index,
      type: ct,
      value: c.value as PatchValue,
    };
    if (options.withNotes) {
      entry.notes = `const[${c.index}] at offset 0x${c.offset.toString(16)} (${c.byteLength} bytes)`;
    }
    patches.push(entry);
  }

  return {
    inpax_patch_version: 1,
    original: {
      name: options.name,
      location: options.location,
      checksum: computeChecksum(walk.bytes),
    },
    target_encoding: options.targetEncoding,
    description: options.description,
    created_at: new Date().toISOString(),
    patches,
  };
}
