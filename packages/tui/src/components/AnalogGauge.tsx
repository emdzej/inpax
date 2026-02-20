/**
 * AnalogGauge - Bar gauge component for analog values
 */

import React from 'react';
import { Box, Text } from 'ink';

export interface AnalogGaugeProps {
  label?: string;
  unit?: string;
  value: number;
  min: number;
  max: number;
  minValid?: number;
  maxValid?: number;
  width?: number;
}

export function AnalogGauge({
  label,
  unit,
  value,
  min,
  max,
  minValid = min,
  maxValid = max,
  width = 30,
}: AnalogGaugeProps) {
  const range = max - min;
  const percent = range > 0 ? Math.max(0, Math.min(1, (value - min) / range)) : 0;
  const filled = Math.round(percent * width);
  
  const isValid = value >= minValid && value <= maxValid;
  const barColor = isValid ? 'green' : 'red';
  
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  const formatted = value.toFixed(2);

  return (
    <Box flexDirection="column">
      {label && <Text>{label}</Text>}
      {unit && <Text dimColor>[{unit}]</Text>}
      <Box>
        <Text backgroundColor={barColor}>
          <Text color="black">{bar.slice(0, filled)}</Text>
        </Text>
        <Text color="green">{bar.slice(filled)}</Text>
        <Text>  {formatted}</Text>
      </Box>
      <Box width={width + 10}>
        <Text dimColor>{min}</Text>
        <Box flexGrow={1} />
        <Text dimColor>{max}</Text>
      </Box>
    </Box>
  );
}
