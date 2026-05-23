import React from 'react';
import { Box, Text } from 'ink';

export interface FilterPromptProps {
  value: string;
  matchedCount: number;
  totalCount: number;
}

export function FilterPrompt(props: FilterPromptProps): React.ReactElement {
  return (
    <Box>
      <Text dimColor>filter: </Text>
      <Text>{JSON.stringify(props.value)}</Text>
      <Text inverse> </Text>
      <Box flexGrow={1} />
      <Text dimColor>
        {props.matchedCount} of {props.totalCount} match
      </Text>
    </Box>
  );
}
