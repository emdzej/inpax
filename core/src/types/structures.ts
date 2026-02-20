import { ValueType, BlockType, Scope } from './enums.js';


export enum StackEntryFlags {
    ByValue = 1,
    ByReference = 2,
}

/**
 * Stack entry - represents a value on the VM stack
 */
export interface StackEntry {
    type: ValueType;
    flags: StackEntryFlags;
    value: Value;
    refInfo?: RefInfo; // For references
}

/**
 * Reference info for stack entries
 */
export interface RefInfo {
    scope: Scope;
    index: number;
}

/**
 * Union type for all possible values
 */
export type Value = boolean | number | string | null;

/**
 * IPO File Header
 */
export interface IpoHeader {
    versionHi: number;
    versionLo: number;
    magic: string;
}

/**
 * IPO Block Header
 */
export interface BlockHeader {
    type: BlockType;
    name: string;
    blockId: number;
    flags: number;
    arg1: string;
    arg2: string;
    marker: number;
    size: number;
}

/**
 * Parsed IPO Block (base)
 */
export interface Block {
    header: BlockHeader;
}

/**
 * Function block with instructions
 */
export interface FunctionBlock extends Block {
    instructions: Instruction[];
}

/**
 * Global variables block
 */
export interface GlobalsBlock extends Block {
    types: ValueType[];
}

/**
 * Constants block
 */
export interface ConstantsBlock extends Block {
    values: StackEntry[];
}

/**
 * Screen block
 */
export interface ScreenBlock extends Block {
    lines: LineBlock[];
    allocFunc?: FunctionBlock;
    initFunc?: FunctionBlock;
}

/**
 * Line block (child of Screen)
 */
export interface LineBlock extends Block {
    controls: ControlBlock[];
    func?: FunctionBlock;
}

/**
 * Control block (child of Line)
 */
export interface ControlBlock extends Block {
    func?: FunctionBlock;
}

/**
 * Menu block
 */
export interface MenuBlock extends Block {
    func?: FunctionBlock;
    items: MenuItemBlock[];
}

/**
 * Menu item block
 */
export interface MenuItemBlock extends Block {
    func?: FunctionBlock;
}

/**
 * State machine block
 */
export interface StateMachineBlock extends Block {
    states: StateBlock[];
    func?: FunctionBlock;
}

/**
 * State block (child of StateMachine)
 */
export interface StateBlock extends Block {
    func?: FunctionBlock;
}

/**
 * Single VM instruction (4 bytes)
 */
export interface Instruction {
    opcode: number;
    operand1: number;
    operand2: number; // u16 little-endian
    raw: number; // Full 32-bit instruction
}

/**
 * Complete parsed IPO file
 */
export interface IpoFile {
    header: IpoHeader;
    globals: GlobalsBlock;
    constants: ConstantsBlock;
    functions: Map<number, FunctionBlock>;
    screens: Map<number, ScreenBlock>;
    menus: Map<number, MenuBlock>;
    stateMachines: Map<number, StateMachineBlock>;
}

/**
 * Return address for call stack
 */
export interface ReturnAddress {
    blockId: number;
    ip: number;
}

/**
 * Call frame marker
 */
export interface CallFrame {
    returnAddress: ReturnAddress;
    frameOffset: number;
}
