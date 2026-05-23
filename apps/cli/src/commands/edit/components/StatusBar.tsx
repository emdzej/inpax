import React from 'react';
import { Box, Text } from 'ink';

export interface StatusBarProps {
  filePath: string;
  codepage: string;
  totalConstants: number;
  filteredCount: number;
  edits: number;
  readonly: boolean;
  hint?: string;
}

export function StatusBar(props: StatusBarProps): React.ReactElement {
  const tail: string[] = [`cp ${props.codepage}`];
  if (props.readonly) tail.push('readonly');
  if (props.edits > 0) tail.push(`${props.edits} edits · modified`);

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold color="cyan">
          ipo-editor
        </Text>
        <Text> — </Text>
        <Text>{props.filePath}</Text>
        <Box flexGrow={1} />
        <Text dimColor>{tail.join(' · ')}</Text>
      </Box>
      <Box>
        <Text dimColor>
          {props.totalConstants} constants
          {props.filteredCount !== props.totalConstants
            ? ` · ${props.filteredCount} shown`
            : ''}
        </Text>
        {props.hint ? (
          <>
            <Text dimColor>  ·  </Text>
            <Text color="yellow">{props.hint}</Text>
          </>
        ) : null}
      </Box>
    </Box>
  );
}
