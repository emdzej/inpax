/**
 * YAML serialise/deserialise for patch documents.
 *
 * The `yaml` package preserves multi-line strings using block scalar
 * syntax (`|`) when the string contains newlines — which is exactly
 * what we want for `notes` and `description` fields that a translator
 * might fill with disasm snippets or several paragraphs of context.
 *
 * Validation is delegated to Zod (`PatchDocumentSchema`) so callers
 * never have to handle `unknown`; parse errors come back as
 * descriptive `ZodError` messages.
 */

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { PatchDocumentSchema, type PatchDocument } from './types.js';

/**
 * Serialise a patch document to YAML text. Output is deterministic
 * given the same input — fields are emitted in the order they appear
 * in the source object, which we control during construction (init.ts
 * and the editor's "save as patch" action).
 */
export function patchToYaml(patch: PatchDocument): string {
  // Validate before writing so we never persist a malformed doc.
  const validated = PatchDocumentSchema.parse(patch);
  return stringifyYaml(validated, {
    lineWidth: 0, // disable auto-wrapping — translators want long lines kept intact
    blockQuote: 'literal', // multi-line strings use `|` block style
    indent: 2,
  });
}

/**
 * Parse + validate a YAML patch document. Throws `ZodError` for
 * schema failures (missing fields, wrong types, malformed checksum
 * hex, …) and `YAMLParseError` for syntactically invalid YAML.
 */
export function patchFromYaml(text: string): PatchDocument {
  const raw = parseYaml(text);
  return PatchDocumentSchema.parse(raw);
}
