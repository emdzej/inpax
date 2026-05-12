import { ValueType } from '@emdzej/inpax-core';

export interface ConstEntry {
  readonly type: ValueType;
  readonly value: boolean | number | string;
}

/**
 * INPACOMP does not deduplicate constants — each literal occurrence in
 * the source produces a fresh entry in the constant pool (see
 * disasm/mj-alu.txt and disasm/alu.txt where `1` and `true` repeat).
 * We match that behaviour.
 */
export class ConstantPool {
  private readonly entries: ConstEntry[] = [];

  add(type: ValueType, value: boolean | number | string): number {
    const idx = this.entries.length;
    this.entries.push({ type, value });
    return idx;
  }

  all(): ReadonlyArray<ConstEntry> {
    return this.entries;
  }

  get length(): number {
    return this.entries.length;
  }
}
