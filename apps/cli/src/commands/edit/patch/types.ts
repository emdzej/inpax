/**
 * Patch file schema — Zod validators + inferred TypeScript types.
 *
 * The on-disk format is YAML; Zod validates the parsed object so callers
 * never deal with `unknown`. Versioned via `inpax_patch_version` so we
 * can break the schema later without silently corrupting old patches.
 */

import { z } from 'zod';

/**
 * Supported value-types for patch entries. Mirrors the codes our parser
 * emits, stored as readable strings in the YAML rather than the binary
 * type bytes (`0x06` etc.) so a human can audit the patch without
 * cross-referencing the bytecode spec.
 */
export const ConstantTypeSchema = z.enum([
  'bool',
  'byte',
  'int',
  'long',
  'real',
  'string',
]);
export type ConstantType = z.infer<typeof ConstantTypeSchema>;

/**
 * Allowed checksum algorithms. Only sha256 today; the field exists so
 * we can rev to something else without renaming the YAML key.
 */
export const ChecksumAlgorithmSchema = z.enum(['sha256']);
export type ChecksumAlgorithm = z.infer<typeof ChecksumAlgorithmSchema>;

/** Expected hex digest length per algorithm — used to reject patches
 *  whose checksum field is the right shape (lowercase hex) but the
 *  wrong size. Catches truncation / wrong-algorithm pasting. */
const ALGORITHM_HEX_LENGTH: Record<ChecksumAlgorithm, number> = {
  sha256: 64,
};

export const ChecksumSchema = z
  .object({
    algorithm: ChecksumAlgorithmSchema,
    /** Lowercase hex digest of the original file bytes.
     *  Coerced to string so YAML's "all-digits → number" parsing
     *  (a real edge case for a SHA-256 that happens to be all digits)
     *  doesn't break validation. */
    value: z
      .coerce.string()
      .regex(/^[0-9a-f]+$/, 'checksum value must be lowercase hex'),
  })
  .refine(
    (c) => c.value.length === ALGORITHM_HEX_LENGTH[c.algorithm],
    (c) => ({
      message: `${c.algorithm} digest must be ${ALGORITHM_HEX_LENGTH[c.algorithm]} hex chars, got ${c.value.length}`,
    }),
  );
export type Checksum = z.infer<typeof ChecksumSchema>;

/**
 * Patch values are emitted as JS primitives:
 *   - bool  → boolean
 *   - byte / int / long → number (integer)
 *   - real  → number (may be float)
 *   - string → string (UTF-8 in the YAML; encoded to `target_encoding`
 *     at apply time)
 */
export const PatchValueSchema = z.union([z.boolean(), z.number(), z.string()]);
export type PatchValue = z.infer<typeof PatchValueSchema>;

export const PatchEntrySchema = z.object({
  /** Zero-based index into the IPO's constant table. */
  index: z.number().int().nonnegative(),
  type: ConstantTypeSchema,
  value: PatchValueSchema,
  /** Optional free-form annotation — usage info, disasm snippets, etc. */
  notes: z.string().optional(),
});
export type PatchEntry = z.infer<typeof PatchEntrySchema>;

/**
 * Source-file identification. `name` is the basename (e.g.
 * `ms43.ipo`), `location` is a categorical tag for the BMW subtree
 * (e.g. `inpa`, `nfs`, `ncsexpert`) — free-form on purpose so we
 * don't reject a patch the moment someone targets an unfamiliar tree.
 */
export const OriginalRefSchema = z.object({
  name: z.string().min(1),
  location: z.string().min(1),
  checksum: ChecksumSchema,
});
export type OriginalRef = z.infer<typeof OriginalRefSchema>;

/**
 * The full patch document. `inpax_patch_version` gates schema
 * compatibility; raise it when you make a breaking change.
 */
export const PatchDocumentSchema = z.object({
  inpax_patch_version: z.literal(1),
  original: OriginalRefSchema,
  /** Codepage strings are encoded into when applying. Defaults to cp1252. */
  target_encoding: z.string().min(1).default('cp1252'),
  /** Free-form human-readable summary. */
  description: z.string().optional(),
  /** Optional creation timestamp (ISO-8601). Informational only. */
  created_at: z.string().optional(),
  patches: z.array(PatchEntrySchema),
});
export type PatchDocument = z.infer<typeof PatchDocumentSchema>;

/**
 * Conflict-resolution policy when several patches in a single apply
 * call target the same constant index. `refuse` is the safer default;
 * `last-wins` lets callers stack overlays intentionally.
 */
export type ConflictPolicy = 'refuse' | 'last-wins';
