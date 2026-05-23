import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { encode as encodeCp, findUnmappable } from '../lib/codepage.js';
import { TextField } from './TextField.js';

export interface EditStringProps {
  index: number;
  codepage: string;
  original: string;
  current: string;
  onSave: (next: string) => void;
  onCancel: () => void;
}

export function EditString(props: EditStringProps): React.ReactElement {
  const { index, codepage, original, current, onSave, onCancel } = props;
  const [value, setValue] = useState(current);

  // Live-validate every render — the keystroke filter rejects 0x0A so
  // the only validation that can fail at this point is codepage
  // mapping. We compute it eagerly because it drives the enable-state
  // of the confirm button.
  const unmappable = findUnmappable(value, codepage);
  const encodedLen = unmappable ? -1 : encodeCp(value, codepage).byteLength;
  const valid = unmappable === undefined;

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }
    if (key.return) {
      if (valid) onSave(value);
      return;
    }
    if (key.ctrl && input === 'r') {
      setValue(original);
      return;
    }
  });

  // Allow any character except 0x0A (the IPO string terminator). The
  // codepage check is deferred so the user can type past an
  // unsupported char and back out without the input freezing.
  const charFilter = (ch: string) => ch !== '\n' && ch !== '\r';

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={valid ? 'cyan' : 'red'} paddingX={1}>
      <Text bold>Edit string #{index}</Text>
      <Box height={1} />
      <Box>
        <Text dimColor>Original: </Text>
        <Text>{JSON.stringify(original)}</Text>
      </Box>
      <Box height={1} />
      <Box borderStyle="round" borderColor={valid ? undefined : 'red'} paddingX={1}>
        <TextField value={value} onChange={setValue} charFilter={charFilter} />
      </Box>
      <Box height={1} />
      <Box>
        <Text color={valid ? 'green' : 'red'}>
          {valid ? `cp ${codepage} ✓` : `cp ${codepage} ✗`}
        </Text>
        {valid ? (
          <>
            <Text dimColor>  ·  </Text>
            <Text dimColor>{encodedLen} bytes</Text>
            <Text dimColor>  ·  </Text>
            <Text dimColor>{value === original ? '= original' : '≠ original'}</Text>
          </>
        ) : (
          <>
            <Text dimColor>  ·  </Text>
            <Text color="red">
              col {unmappable.index + 1}: {JSON.stringify(unmappable.char)} not in codepage
            </Text>
          </>
        )}
      </Box>
      <Box height={1} />
      <Text dimColor>
        {valid ? 'enter save' : 'enter (disabled)'} · esc cancel · ⌃R revert
      </Text>
    </Box>
  );
}
