/**
 * RunScreen - Main INPA execution screen with full layout
 * Full-screen with titled boxes for title and menu
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput, useApp, useStdout } from 'ink';
import { TitledBox } from '@mishieck/ink-titled-box';
import clipboard from 'clipboardy';
import type { TuiProvider } from '@emdzej/inpax-tui-provider';
import { ScreenArea, FKeyBar, InputDialog, type RunState } from '../components/index.js';

export interface RunScreenProps {
  provider: TuiProvider;
  title?: string;
  onQuit?: () => void;
}

export function RunScreen({ provider, title, onQuit }: RunScreenProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [state, setState] = useState(provider.state);
  const [runState, setRunState] = useState<RunState>('running');
  const [shiftMode, setShiftMode] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({
    columns: stdout?.columns || 80,
    rows: stdout?.rows || 24
  });

  // Track terminal resize
  useEffect(() => {
    if (!stdout) return;

    const handleResize = () => {
      setDimensions({ columns: stdout.columns, rows: stdout.rows });
    };

    stdout.on('resize', handleResize);
    return () => { stdout.off('resize', handleResize); };
  }, [stdout]);

  // Subscribe to provider state changes
  useEffect(() => {
    const handleChange = () => {
      setState({ ...provider.state, userBoxes: new Map(provider.state.userBoxes) });
    };
    return provider.onStateChange(handleChange);
  }, [provider]);

  // Generate text representation of screen area
  const getScreenText = useCallback(() => {
    const lines: string[] = [];
    const textLines = provider.getTextLines();
    const analogValues = provider.getAnalogValues();
    const digitalValues = provider.getDigitalValues();

    // Group text by rows
    const rowMap = new Map<number, Array<{ col: number; text: string }>>();

    for (const line of textLines) {
      if (!rowMap.has(line.row)) {
        rowMap.set(line.row, []);
      }
      rowMap.get(line.row)!.push({ col: line.col, text: line.text });
    }

    // Add analog values
    for (const av of analogValues) {
      const formatted = av.format.replace(/%[.\d]*[fdeg]/g, av.value.toString());
      if (!rowMap.has(av.row)) {
        rowMap.set(av.row, []);
      }
      rowMap.get(av.row)!.push({ col: av.col, text: `${formatted}` });
    }

    // Add digital values
    for (const dv of digitalValues) {
      const text = dv.value ? dv.trueText : dv.falseText;
      if (!rowMap.has(dv.row)) {
        rowMap.set(dv.row, []);
      }
      rowMap.get(dv.row)!.push({ col: dv.col, text });
    }

    // Sort rows and build output
    const sortedRows = Array.from(rowMap.keys()).sort((a, b) => a - b);

    for (const row of sortedRows) {
      const items = rowMap.get(row)!.sort((a, b) => a.col - b.col);
      let line = '';
      let currentCol = 0;

      for (const item of items) {
        if (item.col > currentCol) {
          line += ' '.repeat(item.col - currentCol);
        }
        line += item.text;
        currentCol = item.col + item.text.length;
      }

      lines.push(line);
    }

    return lines.join('\n');
  }, [provider]);

  // Copy screen to clipboard
  const copyToClipboard = useCallback(async () => {
    try {
      const text = getScreenText();
      await clipboard.write(text);
      setCopyMessage('Copied!');
      setTimeout(() => setCopyMessage(null), 1500);
    } catch {
      setCopyMessage('Copy failed');
      setTimeout(() => setCopyMessage(null), 1500);
    }
  }, [getScreenText]);

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

    // Copy to clipboard
    if (input === 'c' || input === 'C') {
      copyToClipboard();
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

  // Menu title
  const menuTitle = state.menuTitle || 'Menu';

  // Status indicator
  const statusText = runState === 'paused' ? 'PAUSED' : 'RUNNING';
  const statusColor = runState === 'paused' ? 'yellow' : 'green';

  return (
    <Box
      flexDirection="column"
      width={dimensions.columns}
      height={dimensions.rows}
    >
      {/* Title box with status */}
      <TitledBox
        borderStyle="single"
        borderColor="cyan"
        titles={["INPAX", displayTitle]}
        paddingX={1}
      >
        <Box justifyContent="space-between" width="100%">
          <Box>
            <Text color={statusColor} bold>[{statusText}]</Text>
            {shiftMode && <Text color="magenta"> [SHIFT]</Text>}
            {copyMessage && <Text color="green"> {copyMessage}</Text>}
          </Box>
          <Text dimColor>
            [1-0]=F1-F10 | Shift=F11-F20 | [C]opy | [P]ause | [Q]uit
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

      {/* F-key bar in titled box */}
      <TitledBox
        borderStyle="single"
        borderColor="yellow"
        titles={[` ${menuTitle} `]}
      >
        <FKeyBar items={provider.getMenuItems()} shift={shiftMode} />
      </TitledBox>
    </Box>
  );
}
