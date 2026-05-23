import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

export type QuitChoice = 'save-quit' | 'discard-quit' | 'cancel';

export interface QuitPromptProps {
  edits: number;
  canSave: boolean;
  onPick: (choice: QuitChoice) => void;
}

export function QuitPrompt(props: QuitPromptProps): React.ReactElement {
  const { edits, canSave, onPick } = props;
  const choices: QuitChoice[] = canSave
    ? ['save-quit', 'discard-quit', 'cancel']
    : ['discard-quit', 'cancel'];
  const [pos, setPos] = useState(0);

  useInput((_input, key) => {
    if (key.escape) return onPick('cancel');
    if (key.upArrow) setPos((p) => Math.max(0, p - 1));
    if (key.downArrow) setPos((p) => Math.min(choices.length - 1, p + 1));
    if (key.return) onPick(choices[pos]);
  });

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="yellow" paddingX={1}>
      <Text bold>Unsaved changes</Text>
      <Box height={1} />
      <Text>{edits} constants edited.</Text>
      <Box height={1} />
      {choices.map((c, i) => (
        <Text key={c} inverse={i === pos}>
          {i === pos ? '▸ ' : '  '}
          {labelFor(c)}
        </Text>
      ))}
      <Box height={1} />
      <Text dimColor>↑↓ select · enter confirm · esc cancel</Text>
    </Box>
  );
}

function labelFor(c: QuitChoice): string {
  switch (c) {
    case 'save-quit': return '[ Save and quit ]';
    case 'discard-quit': return '[ Discard and quit ]';
    case 'cancel': return '[ Cancel — back to editor ]';
  }
}
