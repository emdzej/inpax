/**
 * ScreenArea - Main content area rendering ScreenBuffer
 */

import React, { useEffect } from 'react';
import { Box, Text } from 'ink';
import useStdoutDimensions from 'ink-use-stdout-dimensions';
import type { ScreenBuffer } from '@emdzej/inpax-tui-provider';

export interface ScreenAreaProps {
  screenBuffer: ScreenBuffer;
}

export function ScreenArea({ screenBuffer }: ScreenAreaProps) {
  const [columns, rows] = useStdoutDimensions();

  useEffect(() => {
    if (!columns || !rows) return;
    screenBuffer.resize(columns, rows);
  }, [columns, rows, screenBuffer]);

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      <Text>{screenBuffer.render()}</Text>
    </Box>
  );
}
