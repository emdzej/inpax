import {
  Instruction,
  Opcode,
  AluOp,
  Scope,
  CallTarget,
  ValueType,
  IpoFile,
  FunctionBlock,
  SystemFunctionMap,
} from '@inpax/core';

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

export interface DisassemblyOptions {
  showRaw?: boolean;
  showAddress?: boolean;
  resolveLabels?: boolean;
  showComments?: boolean;
  indent?: string;
}

const DEFAULT_OPTIONS: DisassemblyOptions = {
  showRaw: true, showAddress: true, resolveLabels: true, showComments: true, indent: '  ',
};

/** Format single instruction */
export function formatInstruction(
  instr: Instruction, index: number, ipo?: IpoFile, options: DisassemblyOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const parts: string[] = [];

  if (opts.showAddress) parts.push(`${index.toString(16).padStart(4, '0')}:`);
  if (opts.showRaw) {
    const raw = instr.raw.toString(16).padStart(8, '0').toUpperCase();
    parts.push(`[${raw}]`);
  }

  const mnemonic = OPCODE_NAMES[instr.opcode] || `UNK_${instr.opcode.toString(16)}`;
  const operands = formatOperands(instr.opcode, instr.operand1, instr.operand2, ipo);
  parts.push(operands ? `${mnemonic.padEnd(12)} ${operands}` : mnemonic);

  if (opts.showComments) {
    const comment = getComment(instr.opcode);
    if (comment) parts.push(`; ${comment}`);
  }

  return parts.join(' ');
}

function formatOperands(opcode: number, op1: number, op2: number, ipo?: IpoFile): string {
  switch (opcode) {
    case Opcode.LOAD: case Opcode.PUSHREF: case Opcode.LOADINOUTREF:
    case Opcode.PUSHR: case Opcode.PUSHREFSTORE:
      return formatScopeIndex(op1, op2);
    case Opcode.NOP:
      return '';
    case Opcode.ALLOC:
      return op2.toString();
    case Opcode.JMP: case Opcode.JMPNZ:
      return `@${op2}`;
    case Opcode.ALU:
      return ALU_NAMES[op1 as AluOp] || `op_${op1.toString(16)}`;
    case Opcode.CALL:
      if (op1 === CallTarget.UserFunction) {
        const name = ipo?.functions.get(op2)?.header.name || `func_${op2}`;
        return `user ${name}`;
      }
      return `sys ${SystemFunctionMap.get(op2)?.name || `sys_${op2.toString(16)}`}`;
    case Opcode.CALLE:
      return `dll[${ipo?.constants.values[op2]?.value || op2}]`;
    case Opcode.LOGTABLE:
      return `table[${op2}]`;
    case Opcode.PUSHIMM:
      return formatConstant(op2, ipo);
    default:
      return (op1 || op2) ? `${op1.toString(16)}, ${op2.toString(16)}` : '';
  }
}

function formatScopeIndex(scope: Scope, index: number): string {
  const name = SCOPE_NAMES[scope];
  if (name) return `${name}[${index}]`;
  if (scope >= 0x40) return `ui_${(scope - 0x40).toString(16)}[${index}]`;
  return `scope_${scope.toString(16)}[${index}]`;
}

function formatConstant(index: number, ipo?: IpoFile): string {
  if (!ipo) return `const[${index}]`;
  const c = ipo.constants.values[index];
  if (!c) return `const[${index}]`;
  const type = VALUE_TYPE_NAMES[c.type] || 'unknown';
  if (c.type === ValueType.String) {
    const str = String(c.value).replace(/\n/g, '\\n').slice(0, 30);
    return `const[${index}] ; ${type} "${str}"`;
  }
  return `const[${index}] ; ${type} ${c.value}`;
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
  func: FunctionBlock, ipo?: IpoFile, options: DisassemblyOptions = {}
): string[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const lines: string[] = [
    `; ========================================`,
    `; Function: ${func.header.name}`,
    `; Block ID: ${func.header.blockId}`,
    `; Instructions: ${func.instructions.length}`,
    `; ========================================`,
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
    if (opts.resolveLabels && jumpTargets.has(i)) lines.push(`L${i}:`);
    lines.push(opts.indent + formatInstruction(func.instructions[i], i, ipo, opts));
  }

  return lines;
}

/** Disassemble entire IPO file */
export function disassembleIpo(ipo: IpoFile, options: DisassemblyOptions = {}): string[] {
  const lines: string[] = [
    `; IPO Disassembly`,
    `; Version: ${ipo.header.versionHi}.${ipo.header.versionLo}`,
    '',
    `; Globals: ${ipo.globals.types.length}`,
    `; Constants: ${ipo.constants.values.length}`,
    '',
  ];

  for (const [, func] of Array.from(ipo.functions.entries()).sort((a, b) => a[0] - b[0])) {
    lines.push(...disassembleFunction(func, ipo, options), '');
  }

  return lines;
}
