import React from 'react';
import { Box, Text } from 'ink';
import { ValueType } from '@emdzej/inpax-core';
import type { ConstantRecord } from '../lib/walker.js';
import { formatValue, looksLikeFfiDescriptor, truncate, typeLabel } from '../lib/format.js';

const COL_INDEX = 6;
const COL_MOD = 2;
const COL_TYPE = 8;

export interface ConstantsListProps {
  /** Display rows in current order (filter-aware). */
  rows: ConstantRecord[];
  /** Cursor position within `rows`. */
  cursor: number;
  /** Visible window height — caller-controlled so the parent decides layout. */
  viewportRows: number;
  /** Terminal columns — used to truncate the value column. */
  width: number;
  /** Indexes (into the unfiltered constant pool) that have been edited. */
  modified: Set<number>;
}

export function ConstantsList(props: ConstantsListProps): React.ReactElement {
  const { rows, cursor, viewportRows, width, modified } = props;

  // Pick a window so the cursor stays visible and centred when possible.
  const offset = clamp(cursor - Math.floor(viewportRows / 2), 0, Math.max(0, rows.length - viewportRows));
  const visible = rows.slice(offset, offset + viewportRows);

  const valueWidth = Math.max(20, width - (COL_INDEX + COL_MOD + COL_TYPE + 4 /* spaces */));

  return (
    <Box flexDirection="column">
      <Box>
        <Text dimColor>{padRight('  #', COL_INDEX)}</Text>
        <Text dimColor>{padRight('', COL_MOD)}</Text>
        <Text dimColor>{padRight('type', COL_TYPE)}</Text>
        <Text dimColor>value</Text>
      </Box>
      {visible.map((row, i) => {
        const realIdx = offset + i;
        const isCursor = realIdx === cursor;
        const isModified = modified.has(row.index);
        const isFfi = looksLikeFfiDescriptor(row.value);
        const valueColor = colorForType(row.type, isFfi);
        const valueText = truncate(formatValue(row.type, row.value), valueWidth) + (isFfi ? ' ⚠' : '');
        return (
          <Box key={realIdx}>
            <Text
              inverse={isCursor}
              color={isCursor ? undefined : isModified ? 'yellow' : undefined}
            >
              {padRight(`${isCursor ? '▸ ' : '  '}${row.index}`, COL_INDEX)}
              {padRight(isModified ? '*' : '', COL_MOD)}
              <Text dimColor={!isCursor}>{padRight(typeLabel(row.type), COL_TYPE)}</Text>
              <Text color={isCursor ? undefined : valueColor}>{valueText}</Text>
            </Text>
          </Box>
        );
      })}
      {rows.length === 0 ? (
        <Box>
          <Text dimColor italic>(no constants match the current filter)</Text>
        </Box>
      ) : null}
    </Box>
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function padRight(s: string, width: number): string {
  if (s.length >= width) return s + ' ';
  return s + ' '.repeat(width - s.length);
}

function colorForType(type: ValueType, isFfi: boolean): string | undefined {
  if (isFfi) return 'red';
  switch (type) {
    case ValueType.String: return 'white';
    case ValueType.Bool:   return 'magenta';
    case ValueType.Real:
    case ValueType.Int:
    case ValueType.Long:
    case ValueType.Byte:
      return 'green';
    default:
      return undefined;
  }
}
