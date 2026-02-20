/**
 * StatusBar - Status indicator and prompt
 */

import React from 'react';
import { Box, Text } from 'ink';

export type RunState = 'running' | 'paused' | 'stopped' | 'error';

export interface StatusBarProps {
  state: RunState;
  prompt?: string;
  ecu?: string;
}

const stateColors: Record<RunState, string> = {
  running: 'green',
  paused: 'yellow',
  stopped: 'gray',
  error: 'red',
};

const stateLabels: Record<RunState, string> = {
  running: 'RUNNING',
  paused: 'PAUSED',
  stopped: 'STOPPED',
  error: 'ERROR',
};

export function StatusBar({ state, prompt = 'Select menu', ecu }: StatusBarProps) {
  return (
    <Box paddingX={1} gap={2}>
      <Box width={10}>
        <Text backgroundColor={stateColors[state]} color="black" bold>
          {' '}{stateLabels[state]}{' '}
        </Text>
      </Box>
      <Box flexGrow={1}>
        <Text>{prompt}</Text>
      </Box>
      {ecu && (
        <Text dimColor>ECU: {ecu}</Text>
      )}
    </Box>
  );
}
