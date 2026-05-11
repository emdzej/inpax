/**
 * ScreenArea - Main content area rendering the INPA ScreenBuffer.
 *
 * Strategy: one outer `<Text>` containing all rows as nested coloured
 * `<Text>` spans separated by literal "\n". This mirrors what the
 * previous (broken) render did — a single Text component — but uses
 * ink's native colour props on inner Text instead of injecting raw SGR
 * escapes. ink composes the spans into a single multi-line string and
 * measures width per visible char (not per byte), so the zebra-striping
 * that the SGR-escape version produced is gone.
 */

import React, { useEffect, useState } from 'react';
import { Box, Text, useStdout } from 'ink';
import type { ScreenBuffer, ScreenSpan } from '@emdzej/inpax-tui-provider';

export interface ScreenAreaProps {
  screenBuffer: ScreenBuffer;
}

// ANSI 16-color palette → ink color name. Codes 0–7 are standard, 8–15
// the "bright" variants. INPA scripts in the wild use the standard 8
// for foreground; backgrounds are usually 0 (black). Fall back to
// undefined (terminal default) for anything we don't recognise.
const COLOR_NAMES: Record<number, string> = {
  0: 'black',
  1: 'red',
  2: 'green',
  3: 'yellow',
  4: 'blue',
  5: 'magenta',
  6: 'cyan',
  7: 'white',
  8: 'gray',
  9: 'redBright',
  10: 'greenBright',
  11: 'yellowBright',
  12: 'blueBright',
  13: 'magentaBright',
  14: 'cyanBright',
  15: 'whiteBright',
};

const colorName = (code: number): string | undefined => COLOR_NAMES[code];

function useStdoutDimensions(): [number, number] {
  const { stdout } = useStdout();
  const [size, setSize] = useState<[number, number]>(() => [
    stdout.columns ?? 80,
    stdout.rows ?? 24,
  ]);

  useEffect(() => {
    const onResize = () => setSize([stdout.columns ?? 80, stdout.rows ?? 24]);
    stdout.on('resize', onResize);
    return () => {
      stdout.off('resize', onResize);
    };
  }, [stdout]);

  return size;
}

export function ScreenArea({ screenBuffer }: ScreenAreaProps) {
  const [columns, rows] = useStdoutDimensions();

  useEffect(() => {
    if (!columns || !rows) return;
    screenBuffer.resize(columns, rows);
  }, [columns, rows, screenBuffer]);

  const spanRows = screenBuffer.renderSpans();

  // Compose a flat list of <Text>-spans and "\n" string separators.
  // ink renders this as one multi-line Text with correctly-styled
  // sub-runs and correct width measurement.
  const children: React.ReactNode[] = [];
  spanRows.forEach((row, rowIdx) => {
    if (rowIdx > 0) children.push('\n');
    row.forEach((span, spanIdx) => {
      children.push(
        <Text
          key={`${rowIdx}-${spanIdx}`}
          color={colorName(span.fg)}
          backgroundColor={colorName(span.bg)}
        >
          {span.text}
        </Text>
      );
    });
  });

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Text>{children}</Text>
    </Box>
  );
}
