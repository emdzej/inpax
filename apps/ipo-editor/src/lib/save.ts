import { copyFileSync, writeFileSync } from 'node:fs';
import type { ConstValue, WalkResult } from './walker.js';
import { encodeConstantPayload } from './encode.js';

export interface SaveOptions {
  filePath: string;
  codepage: string;
  edits: ReadonlyMap<number, ConstValue>;
  /** Create `<filePath>.bak` before writing. */
  backup: boolean;
}

export interface SaveResult {
  /** Total bytes written. */
  bytesWritten: number;
  /** Byte delta vs the source file (positive when strings grew). */
  delta: number;
  /** Absolute path of the `.bak`, if one was written. */
  backupPath?: string;
}

/**
 * Byte-preserving save:
 *   * keeps every byte before the Constant Data block's payload
 *     (header, all function/screen/menu/state/logic-table blocks,
 *     globals) exactly as the source file held them;
 *   * re-emits only the payload of the Constant Data block, with edits
 *     applied;
 *   * preserves whatever follows the Constant Data block (in every
 *     real `.ipo` we've inspected nothing does, but we don't assume).
 *
 * The block HEADER is kept verbatim because edits never change the
 * count or type of any constant — only string lengths flex.
 */
export function saveEdited(walk: WalkResult, options: SaveOptions): SaveResult {
  if (!walk.constantsBlock) {
    throw new Error('no Constant Data block in this file — nothing to save');
  }

  const { payloadStart, end } = walk.constantsBlock;
  const prefix = walk.bytes.subarray(0, payloadStart);
  const suffix = walk.bytes.subarray(end);

  const newPayload = encodeConstantPayload(walk.constants, {
    codepage: options.codepage,
    edits: options.edits,
  });

  const combined = new Uint8Array(prefix.byteLength + newPayload.byteLength + suffix.byteLength);
  combined.set(prefix, 0);
  combined.set(newPayload, prefix.byteLength);
  combined.set(suffix, prefix.byteLength + newPayload.byteLength);

  let backupPath: string | undefined;
  if (options.backup) {
    backupPath = options.filePath + '.bak';
    copyFileSync(options.filePath, backupPath);
  }

  // The file `bytes` slice references the original buffer; once we
  // overwrite the file the next walker pass should re-read from disk.
  writeFileSync(options.filePath, combined);

  return {
    bytesWritten: combined.byteLength,
    delta: combined.byteLength - walk.bytes.byteLength,
    backupPath,
  };
}
