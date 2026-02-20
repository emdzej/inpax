/**
 * FKeyBar - Bottom bar with F1-F10 function key labels
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { MenuItem } from '@inpax/tui-provider';

export interface FKeyBarProps {
  items: readonly MenuItem[];
  shift?: boolean;
}

export function FKeyBar({ items, shift = false }: FKeyBarProps) {
  // F1-F10 for normal, F11-F20 (displayed as Shift+F1-F10) for shift
  const startNum = shift ? 11 : 1;
  const slots: Array<{ key: string; label: string } | null> = [];

  for (let i = 0; i < 10; i++) {
    const itemNum = startNum + i;
    const item = items.find(m => m.itemNum === itemNum && m.enabled);
    const keyLabel = shift ? `S+F${i + 1}` : `F${i + 1}`;
    
    if (item) {
      slots.push({ key: keyLabel, label: item.text });
    } else {
      slots.push(null);
    }
  }

  return (
    <Box borderStyle="single" paddingX={1}>
      {slots.map((slot, i) => (
        <Box key={i} width={12} justifyContent="center" borderStyle="single" borderLeft={i > 0} borderTop={false} borderBottom={false} borderRight={false}>
          {slot ? (
            <Box flexDirection="column" alignItems="center">
              <Text dimColor>{slot.key}</Text>
              <Text bold>{slot.label.slice(0, 10)}</Text>
            </Box>
          ) : (
            <Box flexDirection="column" alignItems="center">
              <Text dimColor>F{i + 1}</Text>
              <Text> </Text>
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
}
