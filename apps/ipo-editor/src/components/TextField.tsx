import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

export interface TextFieldProps {
  value: string;
  onChange: (next: string) => void;
  /** Block keystrokes that produce invalid values (e.g. 0x0A in strings). */
  charFilter?: (ch: string) => boolean;
  width?: number;
  focus?: boolean;
}

/**
 * Minimal controlled text input with a visible block cursor.
 *
 * Built inline because the only external option (`ink-text-input`) is
 * stuck on ink 4 and we want char-by-char filter hooks anyway (e.g.
 * to reject `\n` in IPO strings and unmappable characters in the
 * current codepage). Pulls just enough cursor handling to feel
 * usable; explicit-IME / multi-line editing is out of scope.
 */
export function TextField(props: TextFieldProps): React.ReactElement {
  const { value, onChange, charFilter, focus = true } = props;
  const [cursor, setCursor] = useState(value.length);

  useInput(
    (input, key) => {
      if (key.leftArrow) {
        setCursor((c) => Math.max(0, c - 1));
        return;
      }
      if (key.rightArrow) {
        setCursor((c) => Math.min(value.length, c + 1));
        return;
      }
      if (key.ctrl && (input === 'a')) {
        setCursor(0);
        return;
      }
      if (key.ctrl && (input === 'e')) {
        setCursor(value.length);
        return;
      }
      if (key.backspace || key.delete) {
        if (cursor === 0) return;
        onChange(value.slice(0, cursor - 1) + value.slice(cursor));
        setCursor((c) => c - 1);
        return;
      }
      if (key.return || key.escape || key.tab || key.ctrl || key.meta) {
        return; // owner handles control-flow keys
      }
      if (input.length === 0) return;
      // ink delivers multi-char paste in a single `input`; filter and
      // splice atomically so the caller's onChange sees one update.
      let chars = '';
      for (const ch of input) {
        if (!charFilter || charFilter(ch)) chars += ch;
      }
      if (chars.length === 0) return;
      onChange(value.slice(0, cursor) + chars + value.slice(cursor));
      setCursor((c) => c + chars.length);
    },
    { isActive: focus },
  );

  const before = value.slice(0, cursor);
  const at = value.slice(cursor, cursor + 1) || ' ';
  const after = value.slice(cursor + 1);

  return (
    <Box>
      <Text>{before}</Text>
      <Text inverse>{at}</Text>
      <Text>{after}</Text>
    </Box>
  );
}
