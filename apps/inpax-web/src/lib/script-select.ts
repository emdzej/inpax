/**
 * Parser for INPA's script-select INI files (`E46.ENG`, `E60.ENG`,
 * `Antrieb.GER`, …). These drive the `scriptselect` system function:
 * a tree-like menu where each tree node is an INI section and each
 * entry under it picks a `.IPO` script in `SGDAT/`.
 *
 * ## File shape
 *
 * Sections name the tree path using `_` as the path separator —
 *
 *   `[ROOT]`               → root node
 *   `[ROOT_MOTOR]`         → child of ROOT, label "Engine"
 *   `[ROOT_KAROSSERIE]`    → child of ROOT, label "Body"
 *   `[ROOT_KAROSSERIE_SITZ]` → grandchild, label "Seat"
 *
 * Each section carries:
 *
 *   `DESCRIPTION=<label>` — what the tree node displays
 *   `ENTRY=<ipo>,<text>,<extra>` — one row in the section's table;
 *      `<ipo>` is the IPO basename to load (e.g. `MS430`),
 *      `<text>` is the human-readable label shown next to it,
 *      `<extra>` is unknown / unused. An entry with an empty first
 *      field (`ENTRY=,,`) is a visual separator the picker shows
 *      as a blank row.
 *
 * Comment lines start with `//` (and existing `;`-style INI comments
 * also exist in the wild — `parseIni` already handles both).
 */

import { parse as parseIni, type IniFile } from "@emdzej/inpax-ini-parser";

export interface ScriptSelectEntry {
  /** IPO basename to load on confirm. Empty string = separator. */
  ipo: string;
  /** Label shown next to the entry. */
  text: string;
  /** Third comma-separated field; meaning unknown — preserved verbatim. */
  extra: string;
}

export interface ScriptSelectNode {
  /** Full section name (`ROOT`, `ROOT_MOTOR`, …). */
  section: string;
  /** Section's `DESCRIPTION=` value; empty if missing. */
  description: string;
  /** Direct child nodes — keyed by the next path segment. */
  children: ScriptSelectNode[];
  /** Entries declared under this section. */
  entries: ScriptSelectEntry[];
}

/**
 * Parse the contents of a `.ENG` / `.GER` script-select INI into a
 * navigable tree. Returns `null` if the file has no sections at all.
 */
export function parseScriptSelect(content: string): ScriptSelectNode | null {
  const ini = parseIni(content);
  const sectionNames = Object.keys(ini);
  if (sectionNames.length === 0) return null;

  // Build a flat map of sections → node, then link parents <-> children
  // by splitting names on `_`. The shortest name (`ROOT`) is the tree
  // root; everything else hangs off it.
  const nodes = new Map<string, ScriptSelectNode>();
  for (const name of sectionNames) {
    nodes.set(name, {
      section: name,
      description: firstValue(ini, name, "DESCRIPTION") ?? "",
      children: [],
      entries: parseEntries(ini, name),
    });
  }

  // Pick the shortest section as root (typically `[ROOT]`). If
  // multiple sections share the shortest depth, fall back to the
  // alphabetically-first one — keeps the picker deterministic.
  const rootName = [...nodes.keys()].sort(
    (a, b) => a.split("_").length - b.split("_").length || a.localeCompare(b)
  )[0];
  const root = nodes.get(rootName)!;

  // Wire each non-root section under its parent (`A_B_C`'s parent is
  // `A_B`). Sections whose parent name isn't in the map are attached
  // to the root — INPA files occasionally omit intermediate sections.
  for (const [name, node] of nodes) {
    if (name === rootName) continue;
    const parts = name.split("_");
    let parentName: string | null = null;
    for (let i = parts.length - 1; i >= 1; i--) {
      const candidate = parts.slice(0, i).join("_");
      if (nodes.has(candidate)) {
        parentName = candidate;
        break;
      }
    }
    const parent = parentName ? nodes.get(parentName) : root;
    (parent ?? root).children.push(node);
  }

  // Stable ordering — INPA files keep their tree in declaration order,
  // and the parser preserves it, but child ordering after the parent-
  // linking pass depends on iteration order of the names map.
  // Re-sort by section name length then lex so the tree reads
  // consistently across reloads.
  const sortChildren = (n: ScriptSelectNode): void => {
    n.children.sort((a, b) => a.section.localeCompare(b.section));
    for (const child of n.children) sortChildren(child);
  };
  sortChildren(root);

  return root;
}

function firstValue(ini: IniFile, section: string, key: string): string | undefined {
  const sec = ini[section];
  if (!sec) return undefined;
  // IniFile values are typed as `Record<string, string | string[]>`;
  // pick the first occurrence if it's an array.
  const v = sec[key];
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function parseEntries(ini: IniFile, section: string): ScriptSelectEntry[] {
  const sec = ini[section];
  if (!sec) return [];
  const raw = sec["ENTRY"];
  if (raw === undefined) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map((line) => {
    const fields = line.split(",", 3);
    return {
      ipo: (fields[0] ?? "").trim(),
      text: (fields[1] ?? "").trim(),
      extra: (fields[2] ?? "").trim(),
    };
  });
}

/**
 * Locate the .ENG/.GER file in CFGDAT by name (case-insensitive),
 * read it, and parse the tree. Returns null if the file can't be
 * found. INPA scripts pass uppercase names (`E46.ENG`) but real
 * installs often have mixed-case filenames after a Windows → macOS
 * rsync; the lookup matches either way.
 */
export async function loadScriptSelect(
  cfgdat: FileSystemDirectoryHandle,
  filename: string
): Promise<ScriptSelectNode | null> {
  const target = filename.toLowerCase();
  let handle: FileSystemFileHandle | null = null;
  for await (const [name, entry] of cfgdat.entries()) {
    if (entry.kind === "file" && name.toLowerCase() === target) {
      handle = entry as FileSystemFileHandle;
      break;
    }
  }
  if (!handle) return null;
  const file = await handle.getFile();
  const content = await file.text();
  return parseScriptSelect(content);
}
