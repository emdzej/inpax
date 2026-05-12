import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { TextField } from './TextField.js';

export interface EditRealProps {
  index: number;
  original: number;
  current: number;
  onSave: (next: number) => void;
  onCancel: () => void;
}

function parseReal(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  // Accept decimal, scientific notation (e.g. `1.5e-3`). Reject bare
  // hex — IEEE-754 hex literals aren't a real input mode here.
  if (!/^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/.test(t)) return null;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

export function EditReal(props: EditRealProps): React.ReactElement {
  const { index, original, current, onSave, onCancel } = props;
  const [text, setText] = useState(String(current));
  const parsed = parseReal(text);
  const valid = parsed !== null;

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

  const charFilter = (ch: string) => /[-+0-9eE.]/.test(ch);

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={valid ? 'cyan' : 'red'} paddingX={1}>
      <Text bold>Edit real #{index}</Text>
      <Box height={1} />
      <Box>
        <Text dimColor>Original: </Text>
        <Text>{original}</Text>
      </Box>
      <Box height={1} />
      <Box borderStyle="round" borderColor={valid ? undefined : 'red'} paddingX={1}>
        <TextField value={text} onChange={setText} charFilter={charFilter} />
      </Box>
      <Box height={1} />
      <Box>
        {valid ? (
          <Text color="green">IEEE-754 ✓ {parsed}</Text>
        ) : (
          <Text color="red">enter a decimal value (e.g. 3.14 or 1.5e-3)</Text>
        )}
      </Box>
      <Box height={1} />
      <Text dimColor>
        {valid ? 'enter save' : 'enter (disabled)'} · esc cancel · ⌃R revert
      </Text>
    </Box>
  );
}
