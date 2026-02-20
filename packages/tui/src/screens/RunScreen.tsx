/**
 * RunScreen - Main INPA execution screen with full layout
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import type { TuiProvider } from '@inpax/tui-provider';
import { ScreenArea, FKeyBar, StatusBar, InputDialog, type RunState } from '../components/index.js';

export interface RunScreenProps {
  provider: TuiProvider;
  title?: string;
  onQuit?: () => void;
}

export function RunScreen({ provider, title, onQuit }: RunScreenProps) {
  const { exit } = useApp();
  const [state, setState] = useState(provider.state);
  const [runState, setRunState] = useState<RunState>('running');
  const [shiftMode, setShiftMode] = useState(false);

  // Subscribe to provider state changes
  useEffect(() => {
    const handleChange = () => {
      setState({ ...provider.state, userBoxes: new Map(provider.state.userBoxes) });
    };
    return provider.onStateChange(handleChange);
  }, [provider]);

  // Handle keyboard input
  useInput((input, key) => {
    // Shift modifier tracking
    if (key.shift) {
      setShiftMode(true);
    }

    // If dialog is open, let InputDialog handle it
    if (state.inputDialog) {
      return;
    }

    // Quit
    if (input === 'q' || input === 'Q') {
      if (onQuit) {
        onQuit();
      } else {
        exit();
      }
      return;
    }

    // Pause/Resume
    if (input === 'p' || input === 'P') {
      setRunState(s => s === 'running' ? 'paused' : 'running');
      return;
    }

    // F1-F10 keys (using number keys as fallback since terminal F-keys are tricky)
    const fKeyMatch = input.match(/^[1-9]$|^0$/);
    if (fKeyMatch) {
      const num = input === '0' ? 10 : parseInt(input, 10);
      const itemNum = shiftMode ? num + 10 : num;
      provider.selectMenuItem(itemNum);
      setShiftMode(false);
      return;
    }

    // Escape - back
    if (key.escape) {
      provider.menuBack();
      return;
    }
  });

  // Input dialog handlers
  const handleInputSubmit = useCallback((value: unknown) => {
    provider.submitInput(value);
  }, [provider]);

  const handleInputCancel = useCallback(() => {
    provider.cancelInput();
  }, [provider]);

  const dialog = provider.getInputDialog();

  return (
    <Box flexDirection="column" height="100%">
      {/* Title bar */}
      <Box borderStyle="single" paddingX={1}>
        <Text bold color="cyan">
          INPA - {title || state.title}
        </Text>
        <Box flexGrow={1} />
        <Text dimColor>
          {shiftMode ? '[SHIFT] ' : ''}
          [1-0]=F1-F10 | [Q]uit | [P]ause
        </Text>
      </Box>

      {/* Main screen area */}
      <Box flexGrow={1} flexDirection="column">
        <ScreenArea state={state} />
      </Box>

      {/* Input dialog overlay */}
      {dialog && (
        <Box position="absolute" marginTop={5} marginLeft={10}>
          <InputDialog
            dialog={dialog}
            onSubmit={handleInputSubmit}
            onCancel={handleInputCancel}
          />
        </Box>
      )}

      {/* Status bar */}
      <StatusBar
        state={runState}
        prompt={state.inputDialog ? 'Input required' : 'Select menu'}
      />

      {/* F-key bar */}
      <FKeyBar items={provider.getMenuItems()} shift={shiftMode} />
      
      {/* Help hint */}
      <Box paddingX={1}>
        <Text dimColor>
          Hold Shift for F11-F20 | Press number keys 1-0 for F1-F10
        </Text>
      </Box>
    </Box>
  );
}
