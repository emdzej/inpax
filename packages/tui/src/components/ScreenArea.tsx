/**
 * ScreenArea - Main content area rendering TuiProvider state
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { TuiState, TextLine, AnalogValue, DigitalValue, UserBox } from '@inpax/tui-provider';
import { AnalogGauge } from './AnalogGauge.js';
import { DigitalIndicator } from './DigitalIndicator.js';

export interface ScreenAreaProps {
  state: Readonly<TuiState>;
}

// INPA color palette (simplified)
const colorMap: Record<number, string> = {
  0: 'black',
  1: 'blue',
  2: 'green',
  3: 'cyan',
  4: 'red',
  5: 'magenta',
  6: 'yellow',
  7: 'white',
};

function TextLineComponent({ line }: { line: TextLine }) {
  return (
    <Text color={colorMap[line.fg % 8] || 'white'}>
      {line.text}
    </Text>
  );
}

function UserBoxComponent({ box }: { box: UserBox }) {
  if (!box.visible) return null;
  
  return (
    <Box flexDirection="column" borderStyle="single" marginTop={1}>
      <Text bold>{box.title}</Text>
      {box.lines.map((line, i) => (
        <TextLineComponent key={i} line={line} />
      ))}
    </Box>
  );
}

export function ScreenArea({ state }: ScreenAreaProps) {
  // Group items by row for layout
  const rows = new Map<number, Array<{ col: number; element: React.ReactNode }>>();

  // Add text lines
  for (const line of state.textLines) {
    if (!rows.has(line.row)) rows.set(line.row, []);
    rows.get(line.row)!.push({
      col: line.col,
      element: <TextLineComponent key={`t-${line.row}-${line.col}`} line={line} />,
    });
  }

  // Add digital values
  for (const dv of state.digitalValues) {
    if (!rows.has(dv.row)) rows.set(dv.row, []);
    rows.get(dv.row)!.push({
      col: dv.col,
      element: (
        <DigitalIndicator
          key={`d-${dv.row}-${dv.col}`}
          value={dv.value}
          trueText={dv.trueText}
          falseText={dv.falseText}
        />
      ),
    });
  }

  // Sort rows
  const sortedRows = Array.from(rows.entries()).sort((a, b) => a[0] - b[0]);

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      {/* Title */}
      <Box justifyContent="center" marginBottom={1}>
        <Text bold>{state.title}</Text>
      </Box>

      {/* Text/Digital content - simple row layout */}
      {sortedRows.map(([row, items]) => (
        <Box key={row} gap={2}>
          {items
            .sort((a, b) => a.col - b.col)
            .map((item, i) => (
              <React.Fragment key={i}>{item.element}</React.Fragment>
            ))}
        </Box>
      ))}

      {/* Analog gauges - two columns */}
      {state.analogValues.length > 0 && (
        <Box flexDirection="row" flexWrap="wrap" marginTop={1}>
          {state.analogValues.map((av, i) => (
            <Box key={i} width="50%" marginBottom={1}>
              <AnalogGauge
                value={av.value}
                min={av.min}
                max={av.max}
                minValid={av.minValid}
                maxValid={av.maxValid}
                label={av.label}
                unit={av.unit}
              />
            </Box>
          ))}
        </Box>
      )}

      {/* Hex dumps */}
      {state.hexDumps.map((hd, i) => (
        <Text key={i} color="cyan">{hd.data}</Text>
      ))}

      {/* User boxes */}
      {Array.from(state.userBoxes.values()).map((box) => (
        <UserBoxComponent key={box.boxNum} box={box} />
      ))}
    </Box>
  );
}
