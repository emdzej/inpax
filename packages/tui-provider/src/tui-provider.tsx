/**
 * TUI Provider - Terminal UI implementation using ink
 */

import React, { useState, useCallback } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import { EventEmitter } from 'eventemitter3';
import type { IUIProvider, UIEvents } from '@inpax/interfaces';

// === State Types ===

interface MenuItem {
  label: string;
  value: number;
  enabled: boolean;
}

interface UserBox {
  row: number;
  col: number;
  height: number;
  width: number;
  title: string;
  lines: Array<{ text: string; row: number; col: number; fg: number; bg: number }>;
  fg: number;
  bg: number;
}

interface TuiState {
  title: string;
  menuTitle: string;
  menuItems: MenuItem[];
  activeMenu: number | null;
  screenHandle: number | null;
  screenCyclic: boolean;
  textLines: Array<{ row: number; col: number; text: string; fg: number; bg: number }>;
  userBoxes: Map<number, UserBox>;
  fg: number;
  bg: number;
  // Input state
  inputMode: 'none' | 'text' | 'number' | 'hex' | 'digital' | 'select' | 'message';
  inputPrompt: { title: string; text: string };
  inputValue: string;
  inputResolve: ((value: unknown) => void) | null;
}

const initialState: TuiState = {
  title: 'INPA',
  menuTitle: '',
  menuItems: [],
  activeMenu: null,
  screenHandle: null,
  screenCyclic: false,
  textLines: [],
  userBoxes: new Map(),
  fg: 7,
  bg: 0,
  inputMode: 'none',
  inputPrompt: { title: '', text: '' },
  inputValue: '',
  inputResolve: null,
};

// === Main TUI Component ===

interface TuiAppProps {
  state: TuiState;
  onMenuSelect: (item: MenuItem) => void;
  onInputSubmit: (value: string) => void;
  onInputCancel: () => void;
  onInputChange: (value: string) => void;
}

function TuiApp({ state, onMenuSelect, onInputSubmit, onInputCancel, onInputChange }: TuiAppProps) {
  const { exit } = useApp();

  useInput((input, key) => {
    if (key.escape) {
      if (state.inputMode !== 'none') {
        onInputCancel();
      }
    }
    if (input === 'q' && state.inputMode === 'none') {
      exit();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      {/* Title bar */}
      <Box borderStyle="single" paddingX={1}>
        <Text bold color="cyan">{state.title}</Text>
      </Box>

      {/* Menu */}
      {state.menuItems.length > 0 && state.inputMode === 'none' && (
        <Box flexDirection="column" marginTop={1}>
          {state.menuTitle && <Text bold>{state.menuTitle}</Text>}
          <SelectInput
            items={state.menuItems.filter(m => m.enabled).map(m => ({
              label: m.label,
              value: m.value,
            }))}
            onSelect={(item) => {
              const menuItem = state.menuItems.find(m => m.value === item.value);
              if (menuItem) onMenuSelect(menuItem);
            }}
          />
        </Box>
      )}

      {/* Screen content */}
      <Box flexDirection="column" marginTop={1} minHeight={10}>
        {state.textLines.map((line, i) => (
          <Text key={i}>{line.text}</Text>
        ))}
      </Box>

      {/* User boxes */}
      {Array.from(state.userBoxes.values()).map((box, i) => (
        <Box key={i} borderStyle="single" flexDirection="column" marginTop={1}>
          <Text bold>{box.title}</Text>
          {box.lines.map((line, j) => (
            <Text key={j}>{line.text}</Text>
          ))}
        </Box>
      ))}

      {/* Input dialogs */}
      {state.inputMode === 'text' && (
        <Box borderStyle="double" flexDirection="column" padding={1} marginTop={1}>
          <Text bold>{state.inputPrompt.title}</Text>
          <Text>{state.inputPrompt.text}</Text>
          <Box marginTop={1}>
            <Text>{'> '}</Text>
            <TextInput
              value={state.inputValue}
              onChange={onInputChange}
              onSubmit={onInputSubmit}
            />
          </Box>
        </Box>
      )}

      {state.inputMode === 'message' && (
        <Box borderStyle="double" flexDirection="column" padding={1} marginTop={1}>
          <Text bold>{state.inputPrompt.title}</Text>
          <Text>{state.inputPrompt.text}</Text>
          <Text dimColor>[Press Enter to continue]</Text>
        </Box>
      )}

      {/* Status bar */}
      <Box marginTop={1}>
        <Text dimColor>
          {state.inputMode === 'none' ? '[Q]uit | [↑↓] Navigate | [Enter] Select' : '[Esc] Cancel | [Enter] Submit'}
        </Text>
      </Box>
    </Box>
  );
}

// === TUI Provider Class ===

export class TuiProvider extends EventEmitter<UIEvents> implements IUIProvider {
  private state: TuiState = { ...initialState };
  private inkInstance: ReturnType<typeof render> | null = null;
  private rerender: (() => void) | null = null;

  constructor() {
    super();
  }

  /** Start the TUI */
  start(): void {
    const Provider = this;
    
    function App() {
      const [state, setState] = useState(Provider.state);
      
      // Store setState for external updates
      Provider.rerender = () => setState({ ...Provider.state });

      const handleMenuSelect = useCallback((item: MenuItem) => {
        Provider.emit('menu:select', { itemNum: item.value, text: item.label });
      }, []);

      const handleInputSubmit = useCallback((value: string) => {
        if (Provider.state.inputResolve) {
          Provider.state.inputResolve(value);
          Provider.state.inputResolve = null;
        }
        Provider.state.inputMode = 'none';
        Provider.state.inputValue = '';
        Provider.emit('input:submit', { value });
        Provider.update();
      }, []);

      const handleInputCancel = useCallback(() => {
        if (Provider.state.inputResolve) {
          Provider.state.inputResolve('');
          Provider.state.inputResolve = null;
        }
        Provider.state.inputMode = 'none';
        Provider.state.inputValue = '';
        Provider.emit('input:cancel');
        Provider.update();
      }, []);

      const handleInputChange = useCallback((value: string) => {
        Provider.state.inputValue = value;
        Provider.update();
      }, []);

      return (
        <TuiApp
          state={state}
          onMenuSelect={handleMenuSelect}
          onInputSubmit={handleInputSubmit}
          onInputCancel={handleInputCancel}
          onInputChange={handleInputChange}
        />
      );
    }

    this.inkInstance = render(<App />);
    this.emit('screen:ready');
  }

  /** Stop the TUI */
  stop(): void {
    if (this.inkInstance) {
      this.inkInstance.unmount();
      this.inkInstance = null;
    }
  }

  private update(): void {
    if (this.rerender) {
      this.rerender();
    }
  }

  // === Screen ===

  setScreen(handle: number, cyclic: boolean): void {
    this.state.screenHandle = handle;
    this.state.screenCyclic = cyclic;
    this.state.textLines = [];
    this.update();
  }

  blankScreen(): void {
    this.state.textLines = [];
    this.update();
  }

  clearRect(_row: number, _col: number, _width: number, _height: number): void {
    // Simplified - just clear all
    this.state.textLines = [];
    this.update();
  }

  setTitle(title: string): void {
    this.state.title = title;
    this.update();
  }

  setColor(fg: number, bg: number): void {
    this.state.fg = fg;
    this.state.bg = bg;
    this.update();
  }

  // === Menu ===

  setMenuTitle(title: string): void {
    this.state.menuTitle = title;
    this.update();
  }

  setMenu(handle: number): void {
    this.state.activeMenu = handle;
    this.update();
  }

  setItem(itemNum: number, text: string, enabled: boolean): void {
    const existing = this.state.menuItems.findIndex(m => m.value === itemNum);
    if (existing >= 0) {
      this.state.menuItems[existing] = { label: text, value: itemNum, enabled };
    } else {
      this.state.menuItems.push({ label: text, value: itemNum, enabled });
    }
    this.update();
  }

  setItemRepeat(itemNum: number, enabled: boolean): void {
    const item = this.state.menuItems.find(m => m.value === itemNum);
    if (item) {
      item.enabled = enabled;
      this.update();
    }
  }

  // === Text Output ===

  text(row: number, col: number, text: string): void {
    this.state.textLines.push({ row, col, text, fg: this.state.fg, bg: this.state.bg });
    this.update();
  }

  textOut(text: string, row: number, col: number): void {
    this.text(row, col, text);
  }

  fTextOut(text: string, row: number, col: number, fg: number, bg: number, _fontSize: number, _fontAttr: number): void {
    this.state.textLines.push({ row, col, text, fg, bg });
    this.update();
  }

  fTextClear(_text: string, _row: number, _col: number, _textSize: number, _textAttr: number): void {
    // Clear specific text - simplified
    this.update();
  }

  hexDump(row: number, col: number, data: Uint8Array, len: number): void {
    const hex = Array.from(data.slice(0, len))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ');
    this.text(row, col, hex);
  }

  // === Data Output ===

  digitalOut(value: boolean, row: number, col: number, trueText: string, falseText: string): void {
    this.text(row, col, value ? trueText : falseText);
  }

  analogOut(value: number, row: number, col: number, _min: number, _max: number, _minValid: number, _maxValid: number, format: string): void {
    // Simple format - just show value
    const text = format ? value.toFixed(2) : value.toString();
    this.text(row, col, text);
  }

  multiAnalogOut(row: number, col: number, ..._values: unknown[]): void {
    this.text(row, col, '[multi-analog]');
  }

  // === Input ===

  getInputState(): number {
    return this.state.inputMode === 'none' ? 0 : 1;
  }

  async inputText(title: string, text: string): Promise<string> {
    return new Promise((resolve) => {
      this.state.inputMode = 'text';
      this.state.inputPrompt = { title, text };
      this.state.inputValue = '';
      this.state.inputResolve = resolve as (v: unknown) => void;
      this.update();
    });
  }

  async input2Text(title: string, text: string, _str1Label: string, _str2Label: string): Promise<[string, string]> {
    const result = await this.inputText(title, text);
    return [result, ''];
  }

  async inputNum(title: string, text: string, min: number, max: number): Promise<number> {
    const result = await this.inputText(title, `${text} (${min}-${max})`);
    const num = parseFloat(result);
    return Math.max(min, Math.min(max, isNaN(num) ? min : num));
  }

  async inputInt(title: string, text: string, min: number, max: number): Promise<number> {
    const result = await this.inputNum(title, text, min, max);
    return Math.floor(result);
  }

  async input2Int(title: string, text: string, _l1: string, _l2: string, min1: number, max1: number, min2: number, _max2: number): Promise<[number, number]> {
    const result = await this.inputInt(title, text, min1, max1);
    return [result, min2];
  }

  async inputHex(title: string, text: string, min: string, _max: string): Promise<string> {
    const result = await this.inputText(title, `${text} (hex)`);
    return result || min;
  }

  async input2Hex(title: string, text: string, _l1: string, _l2: string, min1: string, _max1: string, min2: string, _max2: string): Promise<[string, string]> {
    const result = await this.inputHex(title, text, min1, '');
    return [result, min2];
  }

  async input2HexNum(title: string, text: string, _hexLabel: string, _numLabel: string, minHex: string, _maxHex: string, minNum: number, _maxNum: number): Promise<[string, number]> {
    const result = await this.inputHex(title, text, minHex, '');
    return [result, minNum];
  }

  async inputDigital(title: string, text: string, offText: string, onText: string): Promise<boolean> {
    const result = await this.inputText(title, `${text} (${offText}/${onText})`);
    return result.toLowerCase() === onText.toLowerCase() || result === '1' || result.toLowerCase() === 'true';
  }

  // === Message Boxes ===

  async messageBox(title: string, text: string): Promise<void> {
    return new Promise((resolve) => {
      this.state.inputMode = 'message';
      this.state.inputPrompt = { title, text };
      this.state.inputResolve = () => resolve();
      this.update();
    });
  }

  async infoBox(title: string, text: string): Promise<void> {
    return this.messageBox(title, text);
  }

  userBoxOpen(boxNum: number, row: number, col: number, height: number, width: number, title: string, _text: string): void {
    this.state.userBoxes.set(boxNum, {
      row, col, height, width, title,
      lines: [],
      fg: this.state.fg,
      bg: this.state.bg,
    });
    this.update();
  }

  userBoxClose(boxNum: number): void {
    this.state.userBoxes.delete(boxNum);
    this.emit('messagebox:closed', { boxNum });
    this.update();
  }

  userBoxFTextOut(boxNum: number, text: string, row: number, col: number, fg: number, bg: number): void {
    const box = this.state.userBoxes.get(boxNum);
    if (box) {
      box.lines.push({ text, row, col, fg, bg });
      this.update();
    }
  }

  userBoxClear(boxNum: number): void {
    const box = this.state.userBoxes.get(boxNum);
    if (box) {
      box.lines = [];
      this.update();
    }
  }

  userBoxSetColor(boxNum: number, fg: number, bg: number): void {
    const box = this.state.userBoxes.get(boxNum);
    if (box) {
      box.fg = fg;
      box.bg = bg;
      this.update();
    }
  }
}
