/**
 * DigitalIndicator - Circle indicator for boolean values
 */

import React from 'react';
import { Box, Text } from 'ink';

export interface DigitalIndicatorProps {
  label?: string;
  value: boolean;
  trueText: string;
  falseText: string;
}

export function DigitalIndicator({
  label,
  value,
  trueText,
  falseText,
}: DigitalIndicatorProps) {
  const indicator = value ? '●' : '○';
  const text = value ? trueText : falseText;
  const color = value ? 'green' : 'gray';

  return (
    <Box>
      {label && <Text>{label}: </Text>}
      <Text color={color}>{indicator}</Text>
      <Text> {text}</Text>
    </Box>
  );
}
