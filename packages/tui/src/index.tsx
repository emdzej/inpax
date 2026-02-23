/**
 * @emdzej/inpax-tui
 * Terminal UI renderer for INPA runtime using ink
 * 
 * Renders state from @emdzej/inpax-tui-provider
 */

import React from 'react';
import { render } from 'ink';
import type { TuiProvider } from '@emdzej/inpax-tui-provider';
import { RunScreen } from './screens/RunScreen.js';

// Re-export components for custom UIs
export * from './components/index.js';
export * from './screens/index.js';
export * from './hooks/index.js';

export interface RenderOptions {
  title?: string;
  onQuit?: () => void;
}

/**
 * Render the TUI with a TuiProvider
 */
export function renderTui(provider: TuiProvider, options: RenderOptions = {}) {
  const instance = render(
    <RunScreen
      provider={provider}
      title={options.title}
      onQuit={options.onQuit}
    />
  );

  return {
    /** Unmount the TUI */
    unmount: () => instance.unmount(),
    /** Wait for TUI to exit */
    waitUntilExit: () => instance.waitUntilExit(),
  };
}
