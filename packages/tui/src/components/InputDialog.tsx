/**
 * InputDialog - Modal dialog for user input
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { InputDialog as InputDialogType } from '@emdzej/inpax-tui-provider';

export interface InputDialogProps {
  dialog: InputDialogType;
  onSubmit: (value: unknown) => void;
  onCancel: () => void;
}

export function InputDialog({ dialog, onSubmit, onCancel }: InputDialogProps) {
  const [value, setValue] = useState(dialog.value);

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.return) {
      if (dialog.type === 'message') {
        onSubmit(undefined);
      } else if (dialog.type === 'number') {
        const num = parseFloat(value);
        const min = typeof dialog.min === 'number' ? dialog.min : 0;
        const max = typeof dialog.max === 'number' ? dialog.max : Infinity;
        onSubmit(Math.max(min, Math.min(max, isNaN(num) ? min : num)));
      } else if (dialog.type === 'digital') {
        const lower = value.toLowerCase();
        onSubmit(
          lower === 'true' ||
          lower === '1' ||
          lower === 'yes' ||
          lower === dialog.trueText?.toLowerCase()
        );
      } else {
        onSubmit(value);
      }
      return;
    }

    if (key.backspace || key.delete) {
      setValue(v => v.slice(0, -1));
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      // Filter input for number/hex types
      if (dialog.type === 'number') {
        if (/[\d.\-]/.test(input)) {
          setValue(v => v + input);
        }
      } else if (dialog.type === 'hex') {
        if (/[\da-fA-F]/.test(input)) {
          setValue(v => v + input.toUpperCase());
        }
      } else {
        setValue(v => v + input);
      }
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor="cyan"
      paddingX={2}
      paddingY={1}
    >
      <Text bold color="cyan">{dialog.title}</Text>
      <Text>{dialog.text}</Text>
      
      {dialog.type !== 'message' && (
        <Box marginTop={1}>
          <Text color="green">{'> '}</Text>
          <Text>{dialog.type === 'hex' ? '0x' : ''}</Text>
          <Text>{value}</Text>
          <Text color="cyan">█</Text>
        </Box>
      )}

      {dialog.type === 'number' && dialog.min !== undefined && (
        <Text dimColor>Range: {dialog.min} - {dialog.max}</Text>
      )}

      {dialog.type === 'digital' && (
        <Text dimColor>Enter: {dialog.trueText} / {dialog.falseText}</Text>
      )}

      <Box marginTop={1}>
        <Text dimColor>
          {dialog.type === 'message' ? '[Enter] OK' : '[Enter] Submit | [Esc] Cancel'}
        </Text>
      </Box>
    </Box>
  );
}
