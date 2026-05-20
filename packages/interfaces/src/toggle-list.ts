/**
 * Shared serialisation helpers for the `togglelist` system function.
 *
 * INPA's wire convention (verified against KOMBI.IPO's STEUERN_LEUCHTE
 * call chain): when the user picks N items from the toggle dialog,
 * the result is either
 *   (a) the **bitwise OR of the picked items' 9-byte masks**,
 *       re-formatted as a `"0xNN;0xNN;…"` semicolon-hex string —
 *       used when `ArgNumFlag` is `false`. The combined string feeds
 *       straight into `INPAapiJob "STEUERN_LEUCHTE", <mask>, ""` and
 *       drives every selected lamp in a single ECU command.
 *   (b) **space-separated 1-based indices** like `"3 7"` — used when
 *       `ArgNumFlag` is `true`, for scripts that read the user's
 *       choice as numeric indices instead of the encoded mask.
 *
 * Both helpers live here (not in `@emdzej/inpax-ui-provider-core`)
 * so the CLI, web, mock, and any future provider all encode the
 * same way without depending on the core UI package.
 */

import type { ToggleItem } from './ui.js';

/**
 * OR a list of INPA toggle-item masks byte-by-byte and format the
 * result back in the input shape (`0xNN;0xNN;…`, with `0x` lowercase
 * and 2 uppercase hex digits, matching INPA's wire output).
 *
 * Empty input → empty string (the dialog's "user picked nothing OR
 * pressed cancel" signal — paired with `getInputState() != 0` the
 * script takes the cancel branch).
 *
 * Items with mismatched byte counts are padded to the longest mask:
 * shorter masks contribute their bytes from the left and zeros for
 * the remainder. In practice every KOMBI item has a 9-byte mask, so
 * this padding is defensive against malformed inputs only.
 */
export function orToggleMasks(masks: string[]): string {
  if (masks.length === 0) return '';
  const parsed = masks.map(parseMaskBytes);
  const len = Math.max(...parsed.map((b) => b.length));
  const out = new Array<number>(len).fill(0);
  for (const bytes of parsed) {
    for (let i = 0; i < bytes.length; i++) {
      out[i] = (out[i] | bytes[i]) & 0xff;
    }
  }
  return out
    .map((b) => `0x${b.toString(16).toUpperCase().padStart(2, '0')}`)
    .join(';');
}

/**
 * Format space-separated 1-based indices for the `ArgNumFlag=true`
 * path. Indices are sorted ascending so the wire output is stable
 * regardless of the order the user clicked rows in.
 */
export function formatToggleIndices(indices: number[]): string {
  if (indices.length === 0) return '';
  return [...indices]
    .sort((a, b) => a - b)
    .map((i) => String(i + 1))
    .join(' ');
}

/**
 * Encode the user's picks into the wire string the script consumes.
 * Branches on `argNum`:
 *   - true  → space-separated 1-based indices.
 *   - false → bitwise-OR of the picked items' masks (default).
 *
 * `pickedIndices` are 0-based indices into `items`. Out-of-range
 * indices are silently ignored so the caller doesn't have to
 * validate selection state.
 */
export function encodeTogglelistResult(
  items: ToggleItem[],
  pickedIndices: number[],
  argNum: boolean,
): string {
  const valid = pickedIndices.filter((i) => i >= 0 && i < items.length);
  if (argNum) return formatToggleIndices(valid);
  return orToggleMasks(valid.map((i) => items[i].mask));
}

function parseMaskBytes(mask: string): number[] {
  if (mask === '') return [];
  return mask
    .split(';')
    .map((tok) => tok.trim())
    .filter((tok) => tok.length > 0)
    .map((tok) => {
      // Accept "0xNN", "0xnn", or bare hex digits — INPA normally
      // writes the "0x" prefix but tolerate the bare form so
      // dialog-typed values from the "Set:" field don't fail.
      const hex = tok.startsWith('0x') || tok.startsWith('0X') ? tok.slice(2) : tok;
      const n = Number.parseInt(hex, 16);
      return Number.isFinite(n) ? n & 0xff : 0;
    });
}
