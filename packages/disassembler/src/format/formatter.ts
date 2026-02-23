import {
  Instruction,
  Opcode,
  AluOp,
  Scope,
  CallTarget,
  ValueType,
  IpoFile,
  FunctionBlock,
  ScreenBlock,
  MenuBlock,
  StateMachineBlock,
  SystemFunctionMap,
} from '@inpax/core';
import chalk, { type ChalkInstance } from 'chalk';

/** Opcode names */
export const OPCODE_NAMES: Record<number, string> = {
  [Opcode.LOAD]: 'LOAD',
  [Opcode.PUSHREF]: 'PUSHREF',
  [Opcode.LOADINOUTREF]: 'LOADINOUTREF',
  [Opcode.NOP]: 'NOP',
  [Opcode.MOVE]: 'MOVE',
  [Opcode.PUSHR]: 'PUSHR',
  [Opcode.PUSHREFSTORE]: 'PUSHREFSTORE',
  [Opcode.ALLOC]: 'ALLOC',
  [Opcode.ALU]: 'ALU',
  [Opcode.JMP]: 'JMP',
  [Opcode.JMPNZ]: 'JMPNZ',
  [Opcode.CALL]: 'CALL',
  [Opcode.CALLE]: 'CALLE',
  [Opcode.RET]: 'RET',
  [Opcode.FRAME]: 'FRAME',
  [Opcode.LOGTABLE]: 'LOGTABLE',
  [Opcode.PUSHIMM]: 'PUSHIMM',
};

/** ALU operation names */
export const ALU_NAMES: Record<AluOp, string> = {
  [AluOp.ADD]: 'ADD', [AluOp.SUB]: 'SUB', [AluOp.MUL]: 'MUL', [AluOp.DIV]: 'DIV',
  [AluOp.LT]: 'LT', [AluOp.LE]: 'LE', [AluOp.GT]: 'GT', [AluOp.GE]: 'GE',
  [AluOp.EQ]: 'EQ', [AluOp.NE]: 'NE', [AluOp.AND]: 'AND', [AluOp.OR]: 'OR',
  [AluOp.XOR]: 'XOR', [AluOp.NEG]: 'NEG', [AluOp.NOT]: 'NOT',
  [AluOp.BAND]: 'BAND', [AluOp.BOR]: 'BOR', [AluOp.BXOR]: 'BXOR',
};

/** Scope names */
export const SCOPE_NAMES: Record<Scope, string> = {
  [Scope.Global]: 'global', [Scope.Const]: 'const', [Scope.Local]: 'local',
  [Scope.Screen]: 'screen', [Scope.Menu]: 'menu', [Scope.StateMachine]: 'state',
};

/** Value type names */
export const VALUE_TYPE_NAMES: Record<ValueType, string> = {
  [ValueType.Void]: 'void', [ValueType.Bool]: 'bool', [ValueType.Byte]: 'byte',
  [ValueType.Int]: 'int', [ValueType.Long]: 'long', [ValueType.Real]: 'real',
  [ValueType.String]: 'string', [ValueType.Handle1]: 'handle1',
  [ValueType.Handle2]: 'handle2', [ValueType.Handle3]: 'handle3',
};

/** Color scheme for syntax highlighting */
export interface ColorScheme {
  address: ChalkInstance;
  raw: ChalkInstance;
  mnemonic: ChalkInstance;
  mnemonicJump: ChalkInstance;
  mnemonicCall: ChalkInstance;
  mnemonicRet: ChalkInstance;
  operand: ChalkInstance;
  number: ChalkInstance;
  string: ChalkInstance;
  label: ChalkInstance;
  comment: ChalkInstance;
  funcHeader: ChalkInstance;
  separator: ChalkInstance;
}

/** Default color scheme */
export const DEFAULT_COLORS: ColorScheme = {
  address: chalk.gray,
  raw: chalk.dim.cyan,
  mnemonic: chalk.green,
  mnemonicJump: chalk.yellow,
  mnemonicCall: chalk.magenta,
  mnemonicRet: chalk.red,
  operand: chalk.white,
  number: chalk.cyan,
  string: chalk.yellow,
  label: chalk.blue.bold,
  comment: chalk.gray,
  funcHeader: chalk.cyan.bold,
  separator: chalk.gray,
};

/** No-op color scheme (no colors) */
const NO_COLORS: ColorScheme = {
  address: chalk.reset,
  raw: chalk.reset,
  mnemonic: chalk.reset,
  mnemonicJump: chalk.reset,
  mnemonicCall: chalk.reset,
  mnemonicRet: chalk.reset,
  operand: chalk.reset,
  number: chalk.reset,
  string: chalk.reset,
  label: chalk.reset,
  comment: chalk.reset,
  funcHeader: chalk.reset,
  separator: chalk.reset,
};

export interface DisassemblyOptions {
  showRaw?: boolean;
  showAddress?: boolean;
  resolveLabels?: boolean;
  showComments?: boolean;
  indent?: string;
  colorize?: boolean;
  colors?: Partial<ColorScheme>;
}

const DEFAULT_OPTIONS: DisassemblyOptions = {
  showRaw: true,
  showAddress: true,
  resolveLabels: true,
  showComments: true,
  indent: '  ',
  colorize: false,
};

function getColors(options: DisassemblyOptions): ColorScheme {
  if (!options.colorize) return NO_COLORS;
  return { ...DEFAULT_COLORS, ...options.colors };
}

function getMnemonicColor(opcode: number, colors: ColorScheme): ChalkInstance {
  switch (opcode) {
    case Opcode.JMP:
    case Opcode.JMPNZ:
      return colors.mnemonicJump;
    case Opcode.CALL:
    case Opcode.CALLE:
      return colors.mnemonicCall;
    case Opcode.RET:
      return colors.mnemonicRet;
    default:
      return colors.mnemonic;
  }
}

/** Format single instruction */
export function formatInstruction(
  instr: Instruction,
  index: number,
  ipo?: IpoFile,
  options: DisassemblyOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const c = getColors(opts);
  const parts: string[] = [];

  if (opts.showAddress) {
    parts.push(c.address(`${index.toString(16).padStart(4, '0')}:`));
  }

  if (opts.showRaw) {
    const raw = instr.raw.toString(16).padStart(8, '0').toUpperCase();
    parts.push(c.raw(`[${raw}]`));
  }

  const mnemonic = OPCODE_NAMES[instr.opcode] || `UNK_${instr.opcode.toString(16)}`;
  const mnemonicColor = getMnemonicColor(instr.opcode, c);
  const operands = formatOperands(instr.opcode, instr.operand1, instr.operand2, ipo, c);

  parts.push(operands
    ? `${mnemonicColor(mnemonic.padEnd(12))} ${operands}`
    : mnemonicColor(mnemonic));

  if (opts.showComments) {
    const comment = getComment(instr.opcode);
    if (comment) parts.push(c.comment(`; ${comment}`));
  }

  return parts.join(' ');
}

function formatOperands(
  opcode: number,
  op1: number,
  op2: number,
  ipo: IpoFile | undefined,
  c: ColorScheme
): string {
  switch (opcode) {
    case Opcode.LOAD:
    case Opcode.PUSHREF:
    case Opcode.LOADINOUTREF:
    case Opcode.PUSHR:
    case Opcode.PUSHREFSTORE:
      return formatScopeIndex(op1, op2, c);
    case Opcode.NOP:
      return '';
    case Opcode.ALLOC:
      return c.number(op2.toString());
    case Opcode.JMP:
    case Opcode.JMPNZ:
      return c.label(`@${op2}`);
    case Opcode.ALU:
      return c.operand(ALU_NAMES[op1 as AluOp] || `op_${op1.toString(16)}`);
    case Opcode.CALL:
      if (op1 === CallTarget.UserFunction) {
        const name = ipo?.functions.get(op2)?.header.name || `func_${op2}`;
        return `${c.operand('user')} ${c.label(name)}`;
      }
      return `${c.operand('sys')} ${c.label(SystemFunctionMap.get(op2)?.name || `sys_${op2.toString(16)}`)}`;
    case Opcode.CALLE:
      return `${c.operand('dll')}${c.separator('[')}${c.string(String(ipo?.constants.values[op2]?.value || op2))}${c.separator(']')}`;
    case Opcode.LOGTABLE:
      return `${c.operand('table')}${c.separator('[')}${c.number(op2.toString())}${c.separator(']')}`;
    case Opcode.PUSHIMM:
      return formatConstant(op2, ipo, c);
    default:
      return (op1 || op2)
        ? `${c.number(op1.toString(16))}${c.separator(', ')}${c.number(op2.toString(16))}`
        : '';
  }
}

function formatScopeIndex(scope: Scope, index: number, c: ColorScheme): string {
  const name = SCOPE_NAMES[scope];
  if (name) return `${c.operand(name)}${c.separator('[')}${c.number(index.toString())}${c.separator(']')}`;
  if (scope >= 0x40) return `${c.operand(`ui_${(scope - 0x40).toString(16)}`)}${c.separator('[')}${c.number(index.toString())}${c.separator(']')}`;
  return `${c.operand(`scope_${scope.toString(16)}`)}${c.separator('[')}${c.number(index.toString())}${c.separator(']')}`;
}

function formatConstant(index: number, ipo: IpoFile | undefined, c: ColorScheme): string {
  if (!ipo) return `${c.operand('const')}${c.separator('[')}${c.number(index.toString())}${c.separator(']')}`;
  const cv = ipo.constants.values[index];
  if (!cv) return `${c.operand('const')}${c.separator('[')}${c.number(index.toString())}${c.separator(']')}`;
  const type = VALUE_TYPE_NAMES[cv.type] || 'unknown';
  if (cv.type === ValueType.String) {
    const str = String(cv.value).replace(/\n/g, '\\n').slice(0, 30);
    return `${c.operand('const')}${c.separator('[')}${c.number(index.toString())}${c.separator(']')} ${c.comment(`; ${type}`)} ${c.string(`"${str}"`)}`;
  }
  return `${c.operand('const')}${c.separator('[')}${c.number(index.toString())}${c.separator(']')} ${c.comment(`; ${type} ${cv.value}`)}`;
}

function getComment(opcode: number): string {
  switch (opcode) {
    case Opcode.JMPNZ: return 'jump if true';
    case Opcode.FRAME: return 'push call frame';
    case Opcode.MOVE: return 'assign';
    case Opcode.RET: return 'return';
    case Opcode.ALLOC: return 'allocate locals';
    case Opcode.LOGTABLE: return 'logic table lookup';
    default: return '';
  }
}

/** Disassemble function block */
export function disassembleFunction(
  func: FunctionBlock,
  ipo?: IpoFile,
  options: DisassemblyOptions = {}
): string[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const c = getColors(opts);

  const lines: string[] = [
    c.separator(`; ========================================`),
    c.funcHeader(`; Function: ${func.header.name}`),
    c.comment(`; Block ID: ${func.header.blockId}`),
    c.comment(`; Instructions: ${func.instructions.length}`),
    c.separator(`; ========================================`),
    '',
  ];

  const jumpTargets = new Set<number>();
  if (opts.resolveLabels) {
    for (const i of func.instructions) {
      if ([Opcode.JMP, Opcode.JMPNZ].includes(i.opcode)) {
        jumpTargets.add(i.operand2);
      }
    }
  }

  for (let i = 0; i < func.instructions.length; i++) {
    if (opts.resolveLabels && jumpTargets.has(i)) {
      lines.push(c.label(`L${i}:`));
    }
    lines.push(opts.indent + formatInstruction(func.instructions[i], i, ipo, opts));
  }

  return lines;
}

/** Disassemble entire IPO file */
export function disassembleIpo(ipo: IpoFile, options: DisassemblyOptions = {}): string[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const c = getColors(opts);

  const lines: string[] = [
    c.funcHeader(`; IPO Disassembly`),
    c.comment(`; Version: ${ipo.header.versionHi}.${ipo.header.versionLo}`),
    '',
    c.comment(`; Globals: ${ipo.globals.types.length}`),
    c.comment(`; Constants: ${ipo.constants.values.length}`),
    c.comment(`; Functions: ${ipo.functions.size}`),
    c.comment(`; Screens: ${ipo.screens.size}`),
    c.comment(`; Menus: ${ipo.menus.size}`),
    c.comment(`; State Machines: ${ipo.stateMachines.size}`),
    '',
  ];

  // Functions
  if (ipo.functions.size > 0) {
    lines.push(c.funcHeader('; ======== FUNCTIONS ========'), '');
    for (const [, func] of Array.from(ipo.functions.entries()).sort((a, b) => a[0] - b[0])) {
      lines.push(...disassembleFunction(func, ipo, options), '');
    }
  }

  // Screens
  if (ipo.screens.size > 0) {
    lines.push(c.funcHeader('; ======== SCREENS ========'), '');
    for (const [, screen] of Array.from(ipo.screens.entries()).sort((a, b) => a[0] - b[0])) {
      lines.push(...disassembleScreen(screen, ipo, options), '');
    }
  }

  // Menus
  if (ipo.menus.size > 0) {
    lines.push(c.funcHeader('; ======== MENUS ========'), '');
    for (const [, menu] of Array.from(ipo.menus.entries()).sort((a, b) => a[0] - b[0])) {
      lines.push(...disassembleMenu(menu, ipo, options), '');
    }
  }

  // State Machines
  if (ipo.stateMachines.size > 0) {
    lines.push(c.funcHeader('; ======== STATE MACHINES ========'), '');
    for (const [, sm] of Array.from(ipo.stateMachines.entries()).sort((a, b) => a[0] - b[0])) {
      lines.push(...disassembleStateMachine(sm, ipo, options), '');
    }
  }

  return lines;
}

/** Disassemble screen block */
export function disassembleScreen(
  screen: ScreenBlock,
  ipo?: IpoFile,
  options: DisassemblyOptions = {}
): string[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const c = getColors(opts);

  const lines: string[] = [
    c.separator(`; ----------------------------------------`),
    c.funcHeader(`; Screen: ${screen.header.name}`),
    c.comment(`; Block ID: ${screen.header.blockId}`),
    c.comment(`; Lines: ${screen.lines.length}`),
    c.separator(`; ----------------------------------------`),
    '',
  ];

  // Alloc function
  if (screen.allocFunc) {
    lines.push(c.comment(`; [ALLOC]`));
    lines.push(...disassembleFunctionBody(screen.allocFunc, ipo, opts));
    lines.push('');
  }

  // Init function
  if (screen.initFunc) {
    lines.push(c.comment(`; [INIT]`));
    lines.push(...disassembleFunctionBody(screen.initFunc, ipo, opts));
    lines.push('');
  }

  // Lines
  for (let i = 0; i < screen.lines.length; i++) {
    const line = screen.lines[i];
    if (line.func) {
      lines.push(c.comment(`; [LINE ${i}] ${line.header.name}`));
      lines.push(...disassembleFunctionBody(line.func, ipo, opts));
      lines.push('');
    }

    // Controls within line
    for (let j = 0; j < line.controls.length; j++) {
      const ctrl = line.controls[j];
      if (ctrl.func) {
        lines.push(c.comment(`; [LINE ${i}][CTRL ${j}] ${ctrl.header.name}`));
        lines.push(...disassembleFunctionBody(ctrl.func, ipo, opts));
        lines.push('');
      }
    }
  }

  return lines;
}

/** Disassemble menu block */
export function disassembleMenu(
  menu: MenuBlock,
  ipo?: IpoFile,
  options: DisassemblyOptions = {}
): string[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const c = getColors(opts);

  const lines: string[] = [
    c.separator(`; ----------------------------------------`),
    c.funcHeader(`; Menu: ${menu.header.name}`),
    c.comment(`; Block ID: ${menu.header.blockId}`),
    c.comment(`; Items: ${menu.items.length}`),
    c.separator(`; ----------------------------------------`),
    '',
  ];

  // Menu init function
  if (menu.func) {
    lines.push(c.comment(`; [INIT]`));
    lines.push(...disassembleFunctionBody(menu.func, ipo, opts));
    lines.push('');
  }

  // Menu items
  for (let i = 0; i < menu.items.length; i++) {
    const item = menu.items[i];
    if (item.func) {
      lines.push(c.comment(`; [ITEM ${i}] ${item.header.name}`));
      lines.push(...disassembleFunctionBody(item.func, ipo, opts));
      lines.push('');
    }
  }

  return lines;
}

/** Disassemble state machine block */
export function disassembleStateMachine(
  sm: StateMachineBlock,
  ipo?: IpoFile,
  options: DisassemblyOptions = {}
): string[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const c = getColors(opts);

  const lines: string[] = [
    c.separator(`; ----------------------------------------`),
    c.funcHeader(`; State Machine: ${sm.header.name}`),
    c.comment(`; Block ID: ${sm.header.blockId}`),
    c.comment(`; States: ${sm.states.length}`),
    c.separator(`; ----------------------------------------`),
    '',
  ];

  // State machine INIT function
  if (sm.func) {
    lines.push(c.comment(`; [INIT]`));
    lines.push(...disassembleFunctionBody(sm.func, ipo, opts));
    lines.push('');
  }

  // States
  for (const state of sm.states) {
    if (state.func) {
      lines.push(c.comment(`; [STATE] ${state.header.name}`));
      lines.push(...disassembleFunctionBody(state.func, ipo, opts));
      lines.push('');
    }
  }

  return lines;
}

/** Disassemble function body (without header) */
function disassembleFunctionBody(
  func: FunctionBlock,
  ipo?: IpoFile,
  options: DisassemblyOptions = {}
): string[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const c = getColors(opts);
  const lines: string[] = [];

  const jumpTargets = new Set<number>();
  if (opts.resolveLabels) {
    for (const i of func.instructions) {
      if ([Opcode.JMP, Opcode.JMPNZ].includes(i.opcode)) {
        jumpTargets.add(i.operand2);
      }
    }
  }

  for (let i = 0; i < func.instructions.length; i++) {
    if (opts.resolveLabels && jumpTargets.has(i)) {
      lines.push(c.label(`L${i}:`));
    }
    lines.push(opts.indent + formatInstruction(func.instructions[i], i, ipo, opts));
  }

  return lines;
}
