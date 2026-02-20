/**
 * React hooks for TUI
 */

import { useState, useEffect } from 'react';
import type { TuiProvider, TuiState } from '@inpax/tui-provider';

/**
 * Subscribe to TuiProvider state changes
 */
export function useProviderState(provider: TuiProvider): Readonly<TuiState> {
  const [state, setState] = useState(provider.state);

  useEffect(() => {
    const handleChange = () => {
      // Create new object to trigger re-render
      setState({
        ...provider.state,
        userBoxes: new Map(provider.state.userBoxes),
      });
    };

    return provider.onStateChange(handleChange);
  }, [provider]);

  return state;
}
