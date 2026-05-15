/**
 * Apply one-or-more patch documents to an IPO and return the patched
 * bytes. I/O-free — callers (CLI, future TUI integration) decide what
 * to do with the result.
 *
 * Semantics, mirroring the spec we agreed:
 *   1. Compute SHA-256 of the input IPO once.
 *   2. Each patch's `original.checksum` must match (override via
 *      `ignoreChecksum`).
 *   3. Each entry's declared `type` must match the IPO's actual
 *      constant type at that index — *never* overridable.
 *   4. When several entries (across patches or within one) target the
 *      same index, the conflict policy decides:
 *        - 'refuse'    → throw, with both offending entries listed
 *        - 'last-wins' → silently keep the latest patch's value
 *   5. String values are encoded into the patch's `target_encoding`
 *      (default cp1252); characters not representable in that
 *      encoding cause a *fatal* error pointing at the offending
 *      entry — never silent corruption.
 */

import { canonicalCodepage, findUnmappable } from '../lib/codepage.js';
import { encodeConstantPayload } from '../lib/encode.js';
import type { ConstantRecord, ConstValue, WalkResult } from '../lib/walker.js';
import { computeChecksum } from './checksum.js';
import type {
  ConflictPolicy,
  PatchDocument,
  PatchEntry,
  PatchValue,
} from './types.js';
import { valueTypeFor } from './value-type.js';

export interface ApplyOptions {
  /** Patch documents to apply, in order. */
  patches: readonly PatchDocument[];
  /** Skip checksum verification (still computed + logged). */
  ignoreChecksum?: boolean;
  /** Conflict resolution; default `'refuse'`. */
  onConflict?: ConflictPolicy;
  /**
   * Override the patches' declared `target_encoding`. When unset,
   * each patch's own value is used. Useful for `--output-encoding`.
   */
  outputEncodingOverride?: string;
}

export interface ApplyResult {
  /** Patched IPO bytes. Caller writes or discards. */
  bytes: Uint8Array;
  /** SHA-256 of the input IPO (always computed). */
  inputChecksum: string;
  /** Per-index final value used (for logging / dry-run reporting). */
  effectiveEdits: ReadonlyMap<number, ConstValue>;
  /** Warnings — non-fatal issues such as ignored checksum mismatches. */
  warnings: readonly string[];
}

/** Convert a Zod-validated patch value into the parser's `ConstValue`
 *  shape, which is just `boolean | number | string`. They line up. */
function toConstValue(v: PatchValue): ConstValue {
  return v;
}

/**
 * Build a `Map<index, ConstantRecord>` so per-index lookups during
 * type checking are O(1) rather than O(N) scans.
 */
function indexConstants(constants: readonly ConstantRecord[]): Map<number, ConstantRecord> {
  const m = new Map<number, ConstantRecord>();
  for (const c of constants) m.set(c.index, c);
  return m;
}

/**
 * Verify a patch entry against the IPO and the active encoding.
 * Throws with a specific message on the first problem — never returns
 * a "soft" warning for things that would silently corrupt bytes.
 */
function validateEntry(
  entry: PatchEntry,
  constantsByIndex: Map<number, ConstantRecord>,
  encoding: string,
  patchOrigin: string,
): void {
  const record = constantsByIndex.get(entry.index);
  if (!record) {
    throw new Error(
      `${patchOrigin}: const[${entry.index}] not present in IPO (out of range)`,
    );
  }
  const expectedVt = valueTypeFor(entry.type);
  if (expectedVt === undefined) {
    throw new Error(
      `${patchOrigin}: const[${entry.index}] declares unsupported type '${entry.type}'`,
    );
  }
  if (record.type !== expectedVt) {
    throw new Error(
      `${patchOrigin}: type mismatch at const[${entry.index}] — patch says '${entry.type}', IPO has type byte 0x${record.type.toString(16).padStart(2, '0')}`,
    );
  }

  // Coarse value-shape check — Zod permits broad unions; we tighten
  // here so e.g. a number sneaking into a string slot fails loudly.
  if (entry.type === 'string' && typeof entry.value !== 'string') {
    throw new Error(`${patchOrigin}: const[${entry.index}] expected string value`);
  }
  if (entry.type === 'bool' && typeof entry.value !== 'boolean') {
    throw new Error(`${patchOrigin}: const[${entry.index}] expected boolean value`);
  }
  if (
    (entry.type === 'byte' || entry.type === 'int' || entry.type === 'long' || entry.type === 'real') &&
    typeof entry.value !== 'number'
  ) {
    throw new Error(`${patchOrigin}: const[${entry.index}] expected numeric value`);
  }

  // String-specific: verify every character can be encoded into the
  // target codepage. iconv-lite would otherwise silently substitute,
  // producing patched files whose translated strings render as `?`.
  if (entry.type === 'string') {
    const bad = findUnmappable(entry.value as string, encoding);
    if (bad) {
      throw new Error(
        `${patchOrigin}: const[${entry.index}] string contains character '${bad.char}' (index ${bad.index}) that cannot be encoded as ${encoding}`,
      );
    }
  }
}

/**
 * Main entry point. Walks every patch, builds the effective edits
 * map according to the conflict policy, and produces patched IPO
 * bytes by splicing the new constant payload into the original.
 */
export function applyPatches(walk: WalkResult, options: ApplyOptions): ApplyResult {
  if (!walk.constantsBlock) {
    throw new Error('cannot apply: IPO has no Constant Data block');
  }

  const policy: ConflictPolicy = options.onConflict ?? 'refuse';
  const warnings: string[] = [];
  const inputChecksum = computeChecksum(walk.bytes);
  const constantsByIndex = indexConstants(walk.constants);

  // The IPO format has no embedded encoding marker. Real INPA.exe
  // always interprets string constants as cp1252. Writing a patched
  // IPO whose strings were encoded under a different codepage means
  // INPA will read those bytes as cp1252 and render the wrong glyphs
  // — `ł` (0xB3 in cp1250) becomes `³` (0xB3 in cp1252), `ó` becomes
  // `ó`, etc. Our own tooling can read non-cp1252 IPOs with the
  // `--input-encoding` flag, but stock INPA can't. So we warn loudly
  // here rather than silently produce a file that's incompatible with
  // the runtime the user is presumably targeting. See
  // `docs/research/ipo-encoding.md` for the full story.
  const effectiveOutputEncoding = canonicalCodepage(
    options.outputEncodingOverride ??
      options.patches[options.patches.length - 1]?.target_encoding ??
      'cp1252',
  );
  if (effectiveOutputEncoding !== 'cp1252') {
    warnings.push(
      `output encoding is '${effectiveOutputEncoding}', not cp1252 — stock INPA.exe will misrender these strings (it always reads .ipo as cp1252). See docs/research/ipo-encoding.md.`,
    );
  }

  // First pass: checksum verification, per the spec — compute once,
  // verify each patch independently against that one digest.
  for (const [i, patch] of options.patches.entries()) {
    const declared = patch.original.checksum;
    if (declared.algorithm !== inputChecksum.algorithm) {
      throw new Error(
        `patch[${i}] '${patch.original.name}': checksum algorithm mismatch (patch=${declared.algorithm}, computed=${inputChecksum.algorithm})`,
      );
    }
    if (declared.value !== inputChecksum.value) {
      const msg = `patch[${i}] '${patch.original.name}': checksum mismatch — patch expects ${declared.value}, IPO is ${inputChecksum.value}`;
      if (options.ignoreChecksum) {
        warnings.push(msg + ' (ignored)');
      } else {
        throw new Error(msg + ' (pass --ignore-checksum to override)');
      }
    }
  }

  // Second pass: collect entries with conflict tracking. We track
  // `(value, patchIndex, entryIndex)` per index so error messages can
  // point at the exact conflicting patches.
  type Slot = { value: ConstValue; from: string };
  const edits = new Map<number, Slot>();

  for (const [pi, patch] of options.patches.entries()) {
    const encoding = options.outputEncodingOverride ?? patch.target_encoding;
    const patchOrigin = `patch[${pi}] '${patch.original.name}'`;
    for (const [ei, entry] of patch.patches.entries()) {
      const entryOrigin = `${patchOrigin} entry[${ei}]`;
      validateEntry(entry, constantsByIndex, encoding, entryOrigin);
      const prior = edits.get(entry.index);
      if (prior && policy === 'refuse') {
        throw new Error(
          `conflict at const[${entry.index}]: ${prior.from} and ${entryOrigin} both target this index. Pass --on-conflict last-wins to allow the later patch to win.`,
        );
      }
      edits.set(entry.index, { value: toConstValue(entry.value), from: entryOrigin });
    }
  }

  // Materialise to a plain ConstValue map for the encoder.
  const effective = new Map<number, ConstValue>();
  for (const [idx, slot] of edits) effective.set(idx, slot.value);

  // Use the same effective encoding we warned about above. If
  // multiple patches declared different encodings, the LAST one wins
  // for the file-level codepage; the per-entry validator already
  // caught any unencodable characters against each entry's own
  // patch's `target_encoding`, so the resulting file is still
  // byte-safe.
  const newPayload = encodeConstantPayload(walk.constants, {
    codepage: effectiveOutputEncoding,
    edits: effective,
  });

  const { payloadStart, end } = walk.constantsBlock;
  const prefix = walk.bytes.subarray(0, payloadStart);
  const suffix = walk.bytes.subarray(end);

  const out = new Uint8Array(prefix.byteLength + newPayload.byteLength + suffix.byteLength);
  out.set(prefix, 0);
  out.set(newPayload, prefix.byteLength);
  out.set(suffix, prefix.byteLength + newPayload.byteLength);

  return {
    bytes: out,
    inputChecksum: inputChecksum.value,
    effectiveEdits: effective,
    warnings,
  };
}
