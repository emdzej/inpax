/**
 * FKeyBar - Bottom bar with F1-F10 function key labels
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { MenuItem } from '@emdzej/inpax-tui-provider';

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
    <Box>
      {slots.map((slot, i) => (
        <React.Fragment key={i}>
          {i > 0 && <Text dimColor>│</Text>}
          <Box width={10} justifyContent="center">
            {slot ? (
              <Box flexDirection="column" alignItems="center">
                <Text dimColor>{slot.key}</Text>
                <Text bold>{slot.label.slice(0, 8)}</Text>
              </Box>
            ) : (
              <Box flexDirection="column" alignItems="center">
                <Text dimColor>F{i + 1}</Text>
                <Text dimColor>-</Text>
              </Box>
            )}
          </Box>
        </React.Fragment>
      ))}
    </Box>
  );
}
