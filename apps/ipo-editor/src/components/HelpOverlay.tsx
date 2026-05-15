import React from 'react';
import { Box, Text } from 'ink';

export function HelpOverlay(): React.ReactElement {
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="cyan" paddingX={1}>
      <Text bold color="cyan">
        ipo-editor — keybindings
      </Text>
      <Box height={1} />
      <HelpSection title="Navigation">
        <HelpKey k="↑ / ↓ / j / k">move cursor</HelpKey>
        <HelpKey k="PgUp / PgDn">page</HelpKey>
        <HelpKey k="Home / End">jump to first / last</HelpKey>
        <HelpKey k="g">go to index #…</HelpKey>
      </HelpSection>
      <HelpSection title="Filtering">
        <HelpKey k="/">substring filter</HelpKey>
        <HelpKey k="t">cycle type filter (all → string → number → bool)</HelpKey>
        <HelpKey k="m">show modified only</HelpKey>
        <HelpKey k="esc">clear filter</HelpKey>
      </HelpSection>
      <HelpSection title="Editing (not yet wired)">
        <HelpKey k="enter">edit current constant</HelpKey>
        <HelpKey k="u / U">undo / undo all</HelpKey>
      </HelpSection>
      <HelpSection title="File">
        <HelpKey k="s">save (overwrites the .ipo)</HelpKey>
        <HelpKey k="P">save edits as a patch (.patch.yaml)</HelpKey>
        <HelpKey k="q">quit</HelpKey>
        <HelpKey k="?">toggle this help</HelpKey>
      </HelpSection>
      <Box height={1} />
      <Text dimColor>press ? or any key to close</Text>
    </Box>
  );
}

function HelpSection({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold underline>
        {title}
      </Text>
      {children}
    </Box>
  );
}

function HelpKey({ k, children }: { k: string; children: React.ReactNode }): React.ReactElement {
  return (
    <Box>
      <Box width={28}>
        <Text color="cyan">{k}</Text>
      </Box>
      <Text>{children}</Text>
    </Box>
  );
}
