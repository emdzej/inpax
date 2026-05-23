import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { ValueType } from '@emdzej/inpax-core';
import { TextField } from './TextField.js';

export interface EditNumberProps {
  /** Drives the range check + hex preview width. */
  type: ValueType;
  index: number;
  original: number;
  current: number;
  onSave: (next: number) => void;
  onCancel: () => void;
}

interface Range {
  label: string;
  min: number;
  max: number;
  hexWidth: number;
}

function rangeFor(type: ValueType): Range {
  switch (type) {
    case ValueType.Byte:  return { label: 'byte (u8)',  min: 0,           max: 0xff,       hexWidth: 2 };
    case ValueType.Int:   return { label: 'int (s16)',  min: -32768,      max: 32767,      hexWidth: 4 };
    case ValueType.Long:  return { label: 'long (s32)', min: -2147483648, max: 2147483647, hexWidth: 8 };
    case ValueType.ULong: return { label: 'ulong (u32)', min: 0, max: 0xffffffff, hexWidth: 8 };
    case ValueType.Numeric:
    case ValueType.Object:
      return { label: 'numeric (s32)', min: -2147483648, max: 2147483647, hexWidth: 8 };
    default:
      throw new Error(`EditNumber: unsupported type 0x${(type as number).toString(16)}`);
  }
}

/**
 * Parses both decimal and `0x…` hex. Returns `null` if the text is
 * empty, not numeric, or doesn't fit `Number.isFinite`.
 */
function parseNumber(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  let n: number;
  if (/^[-+]?0x[0-9a-f]+$/i.test(t)) {
    n = parseInt(t.replace(/^[-+]?/, ''), 16);
    if (t.startsWith('-')) n = -n;
  } else if (/^[-+]?\d+$/.test(t)) {
    n = parseInt(t, 10);
  } else {
    return null;
  }
  return Number.isFinite(n) ? n : null;
}

function toHex(n: number, width: number): string {
  if (n < 0) {
    // Two's-complement representation for the declared width.
    const bits = width * 4;
    const wrapped = (BigInt.asUintN(bits, BigInt(n))).toString(16);
    return '0x' + wrapped.padStart(width, '0');
  }
  return '0x' + n.toString(16).padStart(width, '0');
}

export function EditNumber(props: EditNumberProps): React.ReactElement {
  const { type, index, original, current, onSave, onCancel } = props;
  const range = rangeFor(type);

  const [text, setText] = useState(String(current));
  const parsed = parseNumber(text);
  const inRange = parsed !== null && parsed >= range.min && parsed <= range.max;
  const valid = inRange;

  useInput((input, key) => {
    if (key.escape) return onCancel();
    if (key.return) {
      if (valid) onSave(parsed!);
      return;
    }
    if (key.ctrl && input === 'r') {
      setText(String(original));
    }
  });

  const charFilter = (ch: string) => /[-+0-9a-fA-FxX]/.test(ch);

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={valid ? 'cyan' : 'red'} paddingX={1}>
      <Text bold>Edit {range.label} #{index}</Text>
      <Box height={1} />
      <Box>
        <Text dimColor>Original: </Text>
        <Text>
          {original}  <Text dimColor>({toHex(original, range.hexWidth)})</Text>
        </Text>
      </Box>
      <Box height={1} />
      <Box borderStyle="round" borderColor={valid ? undefined : 'red'} paddingX={1}>
        <TextField value={text} onChange={setText} charFilter={charFilter} />
      </Box>
      <Box height={1} />
      <Box>
        {parsed === null ? (
          <Text color="red">enter a decimal or 0x… hex value</Text>
        ) : inRange ? (
          <Text color="green">
            ✓ {parsed} <Text dimColor>({toHex(parsed, range.hexWidth)})</Text>
          </Text>
        ) : (
          <Text color="red">
            ✗ out of range {range.min} … {range.max}
          </Text>
        )}
      </Box>
      <Box height={1} />
      <Text dimColor>
        {valid ? 'enter save' : 'enter (disabled)'} · esc cancel · ⌃R revert
      </Text>
    </Box>
  );
}
