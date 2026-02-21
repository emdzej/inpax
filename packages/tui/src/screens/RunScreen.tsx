/**
 * RunScreen - Main INPA execution screen with full layout
 * Full-screen with titled boxes for title and menu
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { TitledBox } from '@mishieck/ink-titled-box';
import useStdoutDimensions from 'ink-use-stdout-dimensions';
import type { TuiProvider } from '@inpax/tui-provider';
import { ScreenArea, FKeyBar, StatusBar, InputDialog, type RunState } from '../components/index.js';

export interface RunScreenProps {
  provider: TuiProvider;
  title?: string;
  onQuit?: () => void;
}

export function RunScreen({ provider, title, onQuit }: RunScreenProps) {
  const { exit } = useApp();
  const [columns, rows] = useStdoutDimensions();
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
  const displayTitle = title || state.title || 'INPA';
  
  // Calculate menu title from current selection or default
  const menuTitle = state.menuTitle || 'Menu';

  return (
    <Box 
      flexDirection="column" 
      width={columns} 
      height={rows}
    >
      {/* Title box */}
      <TitledBox
        borderStyle="single"
        borderColor="cyan"
        titles={[' INPA ']}
        paddingX={1}
      >
        <Box justifyContent="space-between" width="100%">
          <Text bold color="cyan">{displayTitle}</Text>
          <Text dimColor>
            {shiftMode ? '[SHIFT] ' : ''}
            [1-0]=F1-F10 | [Q]uit | [P]ause
          </Text>
        </Box>
      </TitledBox>

      {/* Main content area */}
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
        prompt={state.inputDialog ? 'Input required' : undefined}
      />

      {/* F-key bar in titled box */}
      <TitledBox
        borderStyle="single"
        borderColor="yellow"
        titles={[` ${menuTitle} `]}
      >
        <FKeyBar items={provider.getMenuItems()} shift={shiftMode} />
      </TitledBox>
      
      {/* Help hint */}
      <Box paddingX={1}>
        <Text dimColor>
          Shift for F11-F20 | Number keys 1-0 for F1-F10
        </Text>
      </Box>
    </Box>
  );
}
