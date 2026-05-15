/**
 * Build a `PatchDocument` from the editor's `walk + edits` state.
 *
 * Different from `initPatch`: that one dumps every constant of a chosen
 * type. This one emits **only entries that differ from the originally
 * loaded values** — the natural "save as patch" semantics, where the
 * patch describes a delta rather than a snapshot.
 */

import type { ConstValue, WalkResult } from '../lib/walker.js';
import { computeChecksum } from './checksum.js';
import { constantTypeFor } from './value-type.js';
import type { PatchDocument, PatchEntry, PatchValue } from './types.js';

export interface FromEditsOptions {
  /** IPO basename — stored on the patch as `original.name`. */
  name: string;
  /** Categorical install-tree tag (`inpa`, `nfs`, …). */
  location: string;
  /** Codepage strings will be encoded into when this patch is applied.
   *  Should match the editor's loaded codepage so the patch is a faithful
   *  representation of what the user typed. */
  targetEncoding: string;
  /** Optional free-form description. */
  description?: string;
}

/**
 * `walk` carries the IPO as originally loaded (incl. raw bytes for the
 * checksum); `edits` is the editor's per-index override map. We emit
 * one patch entry per edit, preserving the constant's declared type.
 */
export function patchFromEdits(
  walk: WalkResult,
  edits: ReadonlyMap<number, ConstValue>,
  options: FromEditsOptions,
): PatchDocument {
  const patches: PatchEntry[] = [];

  // Iterate the walk's constants rather than `edits` directly so the
  // output is deterministically index-ordered, not insertion-ordered.
  for (const c of walk.constants) {
    if (!edits.has(c.index)) continue;
    const ct = constantTypeFor(c.type);
    if (!ct) continue; // Skip handle / void types — those can't be patched.
    patches.push({
      index: c.index,
      type: ct,
      value: edits.get(c.index) as PatchValue,
    });
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
