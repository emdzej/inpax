import { ValueType } from '@emdzej/inpax-core';
import {
  FunctionDecl, GlobalDecl, ImportDecl, LineDecl, LocalDecl, MenuDecl,
  MenuItemDecl, ParameterDecl, ParamDirection, Program, ScreenDecl,
  StateDecl, StateMachineDecl, LogicTableDecl, Statement, ValueTypeName,
} from '../ast/index.js';

export class SemanticError extends Error {
  constructor(
    message: string,
    public readonly line: number,
    public readonly column: number,
  ) {
    super(`${line}:${column}: ${message}`);
    this.name = 'SemanticError';
  }
}

/**
 * INPACOMP assigns synthetic startup/shutdown function IDs first, then
 * the user entry points, then declared user functions in source order.
 * File-emission order is different — see writer/writer.ts.
 */
export const FUNC_ID_STARTUP = 0;
export const FUNC_ID_SHUTDOWN = 1;
export const FUNC_ID_INPAINIT = 2;
export const FUNC_ID_INPAEXIT = 3;
const FIRST_USER_FUNC_ID = 4;

export interface LocalInfo {
  readonly name: string;
  readonly slot: number;
  readonly type: ValueType;
  readonly direction: 'in' | 'out' | 'inout' | 'returns' | 'local';
}

export interface FunctionInfo {
  readonly id: number;
  readonly name: string;
  readonly decl: FunctionDecl;
  readonly locals: LocalInfo[];
  readonly localsByName: Map<string, LocalInfo>;
}

export interface GlobalInfo {
  readonly slot: number;
  readonly name: string;
  readonly type: ValueType;
  readonly decl: GlobalDecl;
}

export interface ScreenInfo {
  readonly id: number;
  readonly name: string;
  readonly decl: ScreenDecl;
}

export interface MenuInfo {
  readonly id: number;
  readonly name: string;
  readonly decl: MenuDecl;
}

export interface StateMachineInfo {
  readonly id: number;
  readonly name: string;
  readonly decl: StateMachineDecl;
  readonly states: Map<string, number>;
}

export interface LogicTableInfo {
  /** Function ID for the generated `lt_<name>` lookup function. */
  readonly funcId: number;
  readonly name: string;
  readonly decl: LogicTableDecl;
}

export interface ImportInfo {
  readonly alias: string;
  readonly decl: ImportDecl;
  /**
   * Encoded descriptor string written into the constant pool — e.g.
   * `kernel32::GetPrivateProfileStringA:c.sssSis%I` — and referenced by
   * `CALLE` (0x0D) at every callsite. Format reconstructed from real
   * `.ipo` constant pools (see disasm output for ABGAS.IPO).
   */
  readonly descriptor: string;
}

export interface SymbolTable {
  readonly program: Program;
  readonly functions: Map<string, FunctionInfo>;
  /** Reverse map: function id -> info. Useful for codegen / writer. */
  readonly functionsById: Map<number, FunctionInfo>;
  /** Source-declared user functions (excludes synthetic startup/shutdown). */
  readonly userFunctions: FunctionInfo[];
  readonly inpainit: FunctionInfo;
  readonly inpaexit: FunctionInfo;
  readonly globals: GlobalInfo[];
  readonly globalsByName: Map<string, GlobalInfo>;
  readonly screens: ScreenInfo[];
  readonly menus: MenuInfo[];
  readonly stateMachines: StateMachineInfo[];
  readonly logicTables: LogicTableInfo[];
  readonly imports: Map<string, ImportInfo>;
}

const TYPE_MAP: Record<ValueTypeName, ValueType> = {
  bool: ValueType.Bool,
  byte: ValueType.Byte,
  int: ValueType.Int,
  long: ValueType.Long,
  real: ValueType.Real,
  string: ValueType.String,
  // `structure` only ever appears in import32 signatures — we treat it
  // as the first handle type so it round-trips through the type table
  // even though no IPS code uses it as a variable type.
  structure: ValueType.Handle1,
};

export function typeNameToValueType(name: ValueTypeName): ValueType {
  return TYPE_MAP[name];
}

export function analyze(program: Program): SymbolTable {
  // --- Globals ---
  // Slot 0 is reserved for the implicit "void" global the runtime
  // expects (see docs/ipo-file-structure.md → Global Variables).
  const globals: GlobalInfo[] = [];
  const globalsByName = new Map<string, GlobalInfo>();
  let globalSlot = 1;
  for (const g of program.globals) {
    if (globalsByName.has(g.name)) {
      throw new SemanticError(`duplicate global '${g.name}'`, g.line, g.column);
    }
    const info: GlobalInfo = {
      slot: globalSlot++,
      name: g.name,
      type: typeNameToValueType(g.type.name),
      decl: g,
    };
    globals.push(info);
    globalsByName.set(g.name, info);
  }

  // --- Functions ---
  // We need inpainit/inpaexit present; both are mandatory per docs.
  let inpainit: FunctionInfo | undefined;
  let inpaexit: FunctionInfo | undefined;
  const functions = new Map<string, FunctionInfo>();
  const functionsById = new Map<number, FunctionInfo>();
  const userFunctions: FunctionInfo[] = [];
  let nextUserId = FIRST_USER_FUNC_ID;

  for (const fn of program.functions) {
    if (functions.has(fn.name)) {
      throw new SemanticError(`duplicate function '${fn.name}'`, fn.line, fn.column);
    }
    let id: number;
    const lower = fn.name.toLowerCase();
    if (lower === 'inpainit') {
      id = FUNC_ID_INPAINIT;
    } else if (lower === 'inpaexit') {
      id = FUNC_ID_INPAEXIT;
    } else {
      id = nextUserId++;
    }
    const info = buildFunctionInfo(id, fn);
    functions.set(fn.name, info);
    functionsById.set(id, info);
    if (lower === 'inpainit') inpainit = info;
    else if (lower === 'inpaexit') inpaexit = info;
    else userFunctions.push(info);
  }

  if (!inpainit) {
    throw new SemanticError("missing required function 'inpainit'", 1, 1);
  }
  if (!inpaexit) {
    throw new SemanticError("missing required function 'inpaexit'", 1, 1);
  }

  // --- Screens / Menus / State machines / Logic tables ---
  // Each block type has its own ID namespace. IDs are 0-indexed in
  // source-declaration order — confirm against more samples once the
  // disasm round-trip is wired.
  const screens: ScreenInfo[] = program.screens.map(
    (s, i) => ({ id: i, name: s.name, decl: s }),
  );
  const menus: MenuInfo[] = program.menus.map(
    (m, i) => ({ id: i, name: m.name, decl: m }),
  );
  const stateMachines: StateMachineInfo[] = program.stateMachines.map(
    (sm, i) => {
      const states = new Map<string, number>();
      sm.states.forEach((s, idx) => states.set(s.name, idx));
      return { id: i, name: sm.name, decl: sm, states };
    },
  );
  const logicTables: LogicTableInfo[] = program.logicTables.map((lt) => ({
    funcId: nextUserId++,
    name: lt.name,
    decl: lt,
  }));

  // --- Imports ---
  const imports = new Map<string, ImportInfo>();
  for (const imp of program.imports) {
    if (imports.has(imp.alias) || functions.has(imp.alias)) {
      throw new SemanticError(`duplicate symbol '${imp.alias}'`, imp.line, imp.column);
    }
    imports.set(imp.alias, {
      alias: imp.alias,
      decl: imp,
      descriptor: encodeImportDescriptor(imp),
    });
  }

  return {
    program,
    functions,
    functionsById,
    userFunctions,
    inpainit,
    inpaexit,
    globals,
    globalsByName,
    screens,
    menus,
    stateMachines,
    logicTables,
    imports,
  };
}

/**
 * Build the import descriptor string stored in the IPO constant pool.
 *
 * Format: `DLL::Function:<conv>.<param-chars><return-marker>`
 *   - DLL string: from the `lib "..."` clause, verbatim (case
 *     preserved). If the lib clause is `lib "X"` without `::Func`,
 *     we synthesise `X::<alias>`.
 *   - conv: single letter — uppercase for 16-bit `import` (P/C/S),
 *     lowercase for 32-bit `import32` (p/c/s).
 *   - param chars: one or two letters per parameter (`in:` → lower,
 *     `out:`/`inout:` → upper for most types; `structure` always
 *     occupies TWO slots — `tl` — matching the Pascal calling
 *     convention's pointer + size pair seen in disasm/ABGAS.IPO).
 *   - return marker: `%` plus the return type letter (e.g. `%I` for
 *     `returns: int`). Imports without `returns:` get a trailing `%`.
 *
 * Encoding for each (direction, type) pair is reconstructed from the
 * five real descriptors observed in ABGAS.IPO's constant pool plus the
 * docs' partial table. Cases marked `???` below throw so we get a loud
 * failure instead of silently producing a wrong descriptor.
 */
function encodeImportDescriptor(imp: ImportDecl): string {
  // Parser splits `lib "X::Y"` into (dll="X", symbol="Y") and `lib "X"`
  // into (dll="", symbol="X"). The descriptor always wants the
  // `DLL::Function` form; when the `lib` clause omitted the function
  // name, the alias is treated as the entry-point name (see
  // `import32 "C" lib "kernel32" OpenFile` in BMW_STD.H).
  const fullLib = imp.dll
    ? `${imp.dll}::${imp.symbol}`
    : `${imp.symbol}::${imp.alias}`;
  const conv = canonicalConvention(imp.is32, imp.convention, imp);

  let params = '';
  let returnMarker: string | undefined;
  for (const p of imp.params) {
    if (p.direction === 'returns') {
      if (returnMarker) {
        throw new SemanticError(
          `'returns:' may only appear once`,
          p.line,
          p.column,
        );
      }
      returnMarker = '%' + paramChar(p, true);
      continue;
    }
    params += paramChars(p);
  }
  return `${fullLib}:${conv}.${params}${returnMarker ?? '%'}`;
}

function canonicalConvention(is32: boolean, src: string, imp: ImportDecl): string {
  if (!src) {
    throw new SemanticError(
      `import is missing a calling convention`,
      imp.line,
      imp.column,
    );
  }
  // The source spells out the convention as a string literal (e.g.
  // "C", "c", "pascal", "PASCAL"). Map it to the canonical single
  // character; case is dictated by 32-bit vs 16-bit.
  const lower = src.toLowerCase();
  let letter: string;
  if (lower === 'c' || lower === 'cdecl') letter = 'c';
  else if (lower === 'p' || lower === 'pascal') letter = 'p';
  else if (lower === 's' || lower === 'stdcall') letter = 's';
  else {
    throw new SemanticError(
      `unknown calling convention '${src}'`,
      imp.line,
      imp.column,
    );
  }
  return is32 ? letter : letter.toUpperCase();
}

function paramChars(p: ParameterDecl): string {
  if (p.type.name === 'structure') {
    // Structures occupy two slots in the descriptor (pointer + len),
    // always lower-case regardless of direction.
    return 'tl';
  }
  return paramChar(p, false);
}

function paramChar(p: ParameterDecl, forReturn: boolean): string {
  const out = forReturn ? true : p.direction === 'out' || p.direction === 'inout';
  switch (p.type.name) {
    case 'int':    return out ? 'I' : 'i';
    case 'long':   return out ? 'L' : 'l';
    case 'string': return out ? 'S' : 's';
    case 'bool':   return out ? 'B' : 'b';
    case 'byte':   return out ? 'Y' : 'y';
    case 'real':   return out ? 'R' : 'r';
    case 'structure':
      throw new SemanticError(
        `'structure' cannot be a return type`,
        p.line,
        p.column,
      );
  }
}

function buildFunctionInfo(id: number, decl: FunctionDecl): FunctionInfo {
  const locals: LocalInfo[] = [];
  const localsByName = new Map<string, LocalInfo>();
  let slot = 0;

  const addLocal = (
    name: string,
    type: ValueType,
    direction: LocalInfo['direction'],
    line: number,
    column: number,
  ): LocalInfo => {
    if (localsByName.has(name)) {
      throw new SemanticError(`duplicate local '${name}'`, line, column);
    }
    const info: LocalInfo = { name, slot: slot++, type, direction };
    locals.push(info);
    localsByName.set(name, info);
    return info;
  };

  // Parameters first — they share the local index space.
  for (const p of decl.params) {
    addLocal(
      p.name,
      typeNameToValueType(p.type.name),
      p.direction,
      p.line,
      p.column,
    );
  }
  // Then any locals declared anywhere inside the body (hoisted, since
  // INPA-VM allocates the full local frame on entry — see the ALLOC
  // emission pattern in disasm/mj-alloc-01.txt).
  walkLocals(decl.body, (l) => {
    addLocal(
      l.name,
      typeNameToValueType(l.type.name),
      'local',
      l.line,
      l.column,
    );
  });

  return { id, name: decl.name, decl, locals, localsByName };
}

function walkLocals(body: Statement[], visit: (decl: LocalDecl) => void): void {
  for (const s of body) walkStatement(s, visit);
}

function walkStatement(stmt: Statement, visit: (decl: LocalDecl) => void): void {
  switch (stmt.kind) {
    case 'BlockStmt':
      for (const s of stmt.statements) walkStatement(s, visit);
      break;
    case 'IfStmt':
      walkStatement(stmt.then, visit);
      if (stmt.else) walkStatement(stmt.else, visit);
      break;
    case 'WhileStmt':
      walkStatement(stmt.body, visit);
      break;
    case 'ForStmt':
      if (stmt.init && (stmt.init as LocalDecl).kind === 'LocalDecl') {
        visit(stmt.init as LocalDecl);
      }
      walkStatement(stmt.body, visit);
      break;
    case 'LocalDecl':
      visit(stmt);
      break;
    default:
      // Other statement kinds (ExprStmt, ReturnStmt, BreakStmt,
      // ContinueStmt) cannot introduce locals.
      break;
  }
}
