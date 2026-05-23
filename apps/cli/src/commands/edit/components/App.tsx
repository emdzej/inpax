import React, { useEffect, useMemo, useState } from 'react';
import { writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import { ValueType } from '@emdzej/inpax-core';
import type { ConstantRecord, ConstValue, WalkResult } from '../lib/walker.js';
import { saveEdited } from '../lib/save.js';
import { looksLikeFfiDescriptor } from '../lib/format.js';
import { patchFromEdits } from '../patch/from-edits.js';
import { patchToYaml } from '../patch/serialize.js';
import { canonicalCodepage } from '../lib/codepage.js';
import { ConstantsList } from './ConstantsList.js';
import { FilterPrompt } from './FilterPrompt.js';
import { HelpOverlay } from './HelpOverlay.js';
import { StatusBar } from './StatusBar.js';
import { EditString } from './EditString.js';
import { EditBool } from './EditBool.js';
import { EditNumber } from './EditNumber.js';
import { EditReal } from './EditReal.js';
import { QuitPrompt } from './QuitPrompt.js';

type TypeFilter = 'all' | 'string' | 'number' | 'bool';

const TYPE_FILTER_LABEL: Record<TypeFilter, string> = {
  all: 'all',
  string: 'strings',
  number: 'numbers',
  bool: 'bools',
};

type View =
  | { mode: 'list' }
  | { mode: 'edit'; constIndex: number }
  | { mode: 'quit-prompt' };

export interface AppProps {
  filePath: string;
  walk: WalkResult;
  readonly: boolean;
  allowFfi: boolean;
  backup: boolean;
  initialHint?: string;
}

export function App(props: AppProps): React.ReactElement {
  const { filePath, walk, readonly, allowFfi, backup, initialHint } = props;
  const { exit } = useApp();
  const { stdout } = useStdout();

  const [cursor, setCursor] = useState(0);
  const [filter, setFilter] = useState('');
  const [filterMode, setFilterMode] = useState<'idle' | 'editing'>('idle');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [modifiedOnly, setModifiedOnly] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [view, setView] = useState<View>({ mode: 'list' });
  const [hint, setHint] = useState<string | undefined>(initialHint);
  const [toast, setToast] = useState<{ text: string; tone: 'info' | 'error' } | undefined>();

  /** Edit map keyed by constant pool index. */
  const [edits, setEdits] = useState<Map<number, ConstValue>>(() => new Map());

  const [cols, setCols] = useState(stdout.columns ?? 100);
  const [rows, setRows] = useState(stdout.rows ?? 30);
  useEffect(() => {
    const onResize = () => {
      setCols(stdout.columns ?? 100);
      setRows(stdout.rows ?? 30);
    };
    stdout.on('resize', onResize);
    return () => {
      stdout.off('resize', onResize);
    };
  }, [stdout]);

  // Materialised view of the constant list with edits applied — used
  // both for display in the list and for save serialisation. We never
  // mutate `walk.constants`; edits live in the side map.
  const effective: ConstantRecord[] = useMemo(
    () =>
      walk.constants.map((c) =>
        edits.has(c.index) ? { ...c, value: edits.get(c.index)! } : c,
      ),
    [walk.constants, edits],
  );

  const filteredRows: ConstantRecord[] = useMemo(() => {
    const needle = filter.toLowerCase();
    return effective.filter((c) => {
      if (modifiedOnly && !edits.has(c.index)) return false;
      if (typeFilter !== 'all' && !matchesTypeFilter(c.type, typeFilter)) return false;
      if (needle.length === 0) return true;
      return String(c.value).toLowerCase().includes(needle);
    });
  }, [effective, edits, filter, typeFilter, modifiedOnly]);

  useEffect(() => {
    if (cursor >= filteredRows.length) {
      setCursor(Math.max(0, filteredRows.length - 1));
    }
  }, [filteredRows.length, cursor]);

  useEffect(() => {
    if (!hint && !toast) return;
    const handle = setTimeout(() => {
      setHint(undefined);
      setToast(undefined);
    }, 4000);
    return () => clearTimeout(handle);
  }, [hint, toast]);

  // Edit / quit dialogs have their own useInput hooks; the list-mode
  // hook is disabled while a dialog is open so we don't double-process.
  const listInputActive =
    view.mode === 'list' && !showHelp && filterMode === 'idle';
  const filterInputActive =
    view.mode === 'list' && !showHelp && filterMode === 'editing';

  useInput(
    (input, key) => {
      if (showHelp) {
        setShowHelp(false);
        return;
      }
      if (input === '?' || (key.shift && input === '/')) {
        setShowHelp(true);
        return;
      }
      if (input === 'q' || key.escape) {
        if (edits.size > 0) {
          setView({ mode: 'quit-prompt' });
        } else {
          exit();
        }
        return;
      }
      if (input === 'j' || key.downArrow) {
        setCursor((c) => Math.min(filteredRows.length - 1, c + 1));
        return;
      }
      if (input === 'k' || key.upArrow) {
        setCursor((c) => Math.max(0, c - 1));
        return;
      }
      if (key.pageDown) {
        setCursor((c) => Math.min(filteredRows.length - 1, c + viewportRows(rows)));
        return;
      }
      if (key.pageUp) {
        setCursor((c) => Math.max(0, c - viewportRows(rows)));
        return;
      }
      if (input === 'g') {
        setCursor(0);
        return;
      }
      if (input === 'G') {
        setCursor(Math.max(0, filteredRows.length - 1));
        return;
      }
      if (input === '/') {
        setFilterMode('editing');
        setFilter('');
        return;
      }
      if (input === 't') {
        setTypeFilter(nextTypeFilter);
        return;
      }
      if (input === 'm') {
        setModifiedOnly((v) => !v);
        return;
      }
      if (input === 'u') {
        const row = filteredRows[cursor];
        if (row && edits.has(row.index)) {
          setEdits((prev) => {
            const next = new Map(prev);
            next.delete(row.index);
            return next;
          });
          setToast({ text: `undone #${row.index}`, tone: 'info' });
        }
        return;
      }
      if (input === 'U') {
        if (edits.size > 0) {
          setToast({ text: `undone all ${edits.size} edits`, tone: 'info' });
          setEdits(new Map());
        }
        return;
      }
      if (key.return) {
        const row = filteredRows[cursor];
        if (!row) return;
        if (readonly) {
          setToast({ text: 'readonly mode — edits disabled', tone: 'info' });
          return;
        }
        if (!allowFfi && looksLikeFfiDescriptor(row.value)) {
          setToast({ text: 'FFI descriptor locked — pass --allow-ffi to edit', tone: 'error' });
          return;
        }
        setView({ mode: 'edit', constIndex: row.index });
        return;
      }
      if (input === 's') {
        handleSave();
        return;
      }
      if (input === 'P') {
        handleSaveAsPatch();
        return;
      }
    },
    { isActive: listInputActive },
  );

  useInput(
    (input, key) => {
      if (key.escape) {
        setFilter('');
        setFilterMode('idle');
        return;
      }
      if (key.return) {
        setFilterMode('idle');
        return;
      }
      if (key.backspace || key.delete) {
        setFilter((f) => f.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setFilter((f) => f + input);
      }
    },
    { isActive: filterInputActive },
  );

  function handleSaveAsPatch(): void {
    if (edits.size === 0) {
      setToast({ text: 'nothing to save — no edits made yet', tone: 'info' });
      return;
    }
    try {
      const doc = patchFromEdits(walk, edits, {
        name: basename(filePath),
        // Location is metadata only — we don't know the install-tree
        // from the file path without heuristics, and asking via a
        // prompt would be a bigger UX. Default to 'unknown'; the user
        // can edit the YAML afterwards if they care.
        location: 'unknown',
        targetEncoding: canonicalCodepage(walk.codepage),
        description: `Saved from ipo-editor — ${edits.size} edit${edits.size === 1 ? '' : 's'}`,
      });
      const yaml = patchToYaml(doc);
      const outputPath = `${filePath}.patch.yaml`;
      writeFileSync(outputPath, yaml, 'utf8');

      const encWarn =
        canonicalCodepage(walk.codepage) !== 'cp1252'
          ? ` · ⚠ ${walk.codepage} not cp1252 — see docs/research/ipo-encoding.md`
          : '';
      setToast({
        text: `✓ patch saved · ${edits.size} entr${edits.size === 1 ? 'y' : 'ies'} · ${outputPath}${encWarn}`,
        tone: 'info',
      });
    } catch (err) {
      setToast({ text: `patch save failed: ${(err as Error).message}`, tone: 'error' });
    }
  }

  function handleSave(): void {
    if (readonly) {
      setToast({ text: 'readonly mode — save disabled', tone: 'info' });
      return;
    }
    if (edits.size === 0) {
      setToast({ text: 'nothing to save', tone: 'info' });
      return;
    }
    try {
      const r = saveEdited(walk, {
        filePath,
        codepage: walk.codepage,
        edits,
        backup,
      });
      const deltaSign = r.delta >= 0 ? '+' : '';
      setToast({
        text: `✓ saved · ${r.bytesWritten} B (${deltaSign}${r.delta}) · backup: ${r.backupPath ?? 'none'}`,
        tone: 'info',
      });
      // After a successful save the on-disk file matches the in-memory
      // edits, so a fresh walker pass would see no diff. We keep the
      // edits map populated — losing it mid-session would surprise
      // the user — but disk and memory are now in sync.
    } catch (err) {
      setToast({ text: `save failed: ${(err as Error).message}`, tone: 'error' });
    }
  }

  function applyEdit(constIndex: number, next: ConstValue): void {
    const original = walk.constants[constIndex];
    setEdits((prev) => {
      const map = new Map(prev);
      if (sameValue(next, original.value)) {
        map.delete(constIndex);
      } else {
        map.set(constIndex, next);
      }
      return map;
    });
    setView({ mode: 'list' });
  }

  const cancelEdit = (): void => setView({ mode: 'list' });
  const listHeight = viewportRows(rows);

  // ===== render =====

  if (view.mode === 'edit') {
    const orig = walk.constants[view.constIndex];
    const cur = edits.get(view.constIndex) ?? orig.value;
    const onSave = (v: ConstValue) => applyEdit(view.constIndex, v);
    return (
      <Box flexDirection="column" width={cols} height={rows} paddingX={1}>
        {renderEditor(view.constIndex, orig.type, orig.value, cur, walk.codepage, onSave, cancelEdit)}
      </Box>
    );
  }

  if (view.mode === 'quit-prompt') {
    return (
      <Box flexDirection="column" width={cols} height={rows} paddingX={1} paddingY={1}>
        <QuitPrompt
          edits={edits.size}
          canSave={!readonly}
          onPick={(choice) => {
            if (choice === 'cancel') {
              setView({ mode: 'list' });
            } else if (choice === 'discard-quit') {
              exit();
            } else {
              try {
                saveEdited(walk, { filePath, codepage: walk.codepage, edits, backup });
                exit();
              } catch (err) {
                setView({ mode: 'list' });
                setToast({ text: `save failed: ${(err as Error).message}`, tone: 'error' });
              }
            }
          }}
        />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width={cols} height={rows}>
      <StatusBar
        filePath={filePath}
        codepage={walk.codepage}
        totalConstants={walk.constants.length}
        filteredCount={filteredRows.length}
        edits={edits.size}
        readonly={readonly}
        hint={hint}
      />
      {filterMode === 'editing' ? (
        <FilterPrompt
          value={filter}
          matchedCount={filteredRows.length}
          totalCount={walk.constants.length}
        />
      ) : (
        <Box>
          <Text dimColor>type-filter:</Text>
          <Text> {TYPE_FILTER_LABEL[typeFilter]}</Text>
          {modifiedOnly ? <Text color="yellow">  · modified-only</Text> : null}
          {filter ? <Text dimColor>  · filter: {JSON.stringify(filter)}</Text> : null}
          <Box flexGrow={1} />
          {toast ? (
            <Text color={toast.tone === 'error' ? 'red' : 'yellow'}>{toast.text}</Text>
          ) : null}
        </Box>
      )}

      {showHelp ? (
        <HelpOverlay />
      ) : (
        <ConstantsList
          rows={filteredRows}
          cursor={cursor}
          viewportRows={listHeight}
          width={cols}
          modified={new Set(edits.keys())}
        />
      )}

      <Box flexGrow={1} />
      <Box>
        {filterMode === 'editing' ? (
          <Text dimColor>type to filter · enter commit · esc cancel</Text>
        ) : (
          <Text dimColor>
            ↑↓ select · enter edit · / filter · t types · m modified · u undo · s save · ? help · q quit
          </Text>
        )}
      </Box>
    </Box>
  );
}

function renderEditor(
  index: number,
  type: ValueType,
  original: ConstValue,
  current: ConstValue,
  codepage: string,
  onSave: (next: ConstValue) => void,
  onCancel: () => void,
): React.ReactElement {
  switch (type) {
    case ValueType.String:
      return (
        <EditString
          index={index}
          codepage={codepage}
          original={String(original)}
          current={String(current)}
          onSave={onSave}
          onCancel={onCancel}
        />
      );
    case ValueType.Bool:
      return (
        <EditBool
          index={index}
          original={Boolean(original)}
          current={Boolean(current)}
          onSave={onSave}
          onCancel={onCancel}
        />
      );
    case ValueType.Real:
      return (
        <EditReal
          index={index}
          original={Number(original)}
          current={Number(current)}
          onSave={onSave}
          onCancel={onCancel}
        />
      );
    case ValueType.Byte:
    case ValueType.Int:
    case ValueType.Long:
    case ValueType.ULong:
    case ValueType.Numeric:
    case ValueType.Object:
      return (
        <EditNumber
          type={type}
          index={index}
          original={Number(original)}
          current={Number(current)}
          onSave={onSave}
          onCancel={onCancel}
        />
      );
    default:
      return (
        <Box borderStyle="single" borderColor="red" paddingX={1} flexDirection="column">
          <Text color="red">cannot edit type 0x{(type as number).toString(16)}</Text>
          <Text dimColor>esc to return</Text>
        </Box>
      );
  }
}

function sameValue(a: ConstValue, b: ConstValue): boolean {
  if (typeof a !== typeof b) return false;
  return a === b;
}

function viewportRows(termRows: number): number {
  return Math.max(5, termRows - 6);
}

function matchesTypeFilter(type: ValueType, filter: TypeFilter): boolean {
  switch (filter) {
    case 'string': return type === ValueType.String;
    case 'bool':   return type === ValueType.Bool;
    case 'number':
      return (
        type === ValueType.Byte ||
        type === ValueType.Int ||
        type === ValueType.Long ||
        type === ValueType.Real
      );
    default:
      return true;
  }
}

function nextTypeFilter(current: TypeFilter): TypeFilter {
  switch (current) {
    case 'all':    return 'string';
    case 'string': return 'number';
    case 'number': return 'bool';
    case 'bool':   return 'all';
  }
}
