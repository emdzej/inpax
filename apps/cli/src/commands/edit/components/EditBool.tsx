import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

export interface EditBoolProps {
  index: number;
  original: boolean;
  current: boolean;
  onSave: (next: boolean) => void;
  onCancel: () => void;
}

export function EditBool(props: EditBoolProps): React.ReactElement {
  const { index, original, current, onSave, onCancel } = props;
  const [value, setValue] = useState<boolean>(current);

  useInput((input, key) => {
    if (key.escape) return onCancel();
    if (key.return) return onSave(value);
    if (key.upArrow || input === 'k') setValue(false);
    if (key.downArrow || input === 'j') setValue(true);
    if (input === ' ') setValue((v) => !v);
  });

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="cyan" paddingX={1}>
      <Text bold>Edit bool #{index}</Text>
      <Box height={1} />
      <Text>
        <Text color={value === false ? 'cyan' : undefined}>{value === false ? '▸ ' : '  '}</Text>
        <Text>({value === false ? '●' : ' '}) false</Text>
        {original === false ? <Text dimColor>  ← original</Text> : null}
      </Text>
      <Text>
        <Text color={value === true ? 'cyan' : undefined}>{value === true ? '▸ ' : '  '}</Text>
        <Text>({value === true ? '●' : ' '}) true</Text>
        {original === true ? <Text dimColor>  ← original</Text> : null}
      </Text>
      <Box height={1} />
      <Text dimColor>↑↓ select · space toggle · enter save · esc cancel</Text>
    </Box>
  );
}
