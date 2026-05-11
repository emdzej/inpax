import { off } from 'process';
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

export interface FileBlock {
    fileOffset?: number;
}

/**
 * IPO File Header
 */
export interface IpoHeader extends FileBlock {
    versionHi: number;
    versionLo: number;
    magic: string;
}

/**
 * IPO Block Header
 */
export interface BlockHeader extends FileBlock {
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
export interface Block extends FileBlock {
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
export interface Instruction extends FileBlock {
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
 * Return address for call stack.
 *
 * `block` is the FunctionBlock reference the callee should return to —
 * carried by reference (not by ID lookup) because LINE/CONTROL/ITEM
 * blocks share the integer ID namespace with top-level functions
 * (e.g. function `__inpa_startup__` has blockId 0, AND every screen's
 * first LINE block has blockId 0). An integer-only return address
 * would resolve back to the wrong block on RET.
 *
 * `blockId` is kept alongside `block` purely for diagnostics; the
 * interpreter only reads `block`. `null` is the sentinel — popping a
 * null `block` means "no caller", which is how `vm.execute()` knows
 * to halt at the top-level function's RET.
 */
export interface ReturnAddress {
    /** Block to resume in; null when the stack is empty (halt sentinel). */
    block: FunctionBlock | null;
    /** Instruction pointer to resume at (within `block`). */
    ip: number;
    /** Diagnostic only — matches `block.header.blockId` when non-null. */
    blockId: number;
}

/**
 * Call frame marker. Pushed by the FRAME opcode before arguments are
 * pushed for the upcoming CALL. `savedFrameOffset` is the caller's
 * frameOffset to restore on popFrame. `markerPosition` is the stack
 * length at FRAME time — i.e. where the callee's local[0] starts.
 */
export interface CallFrame {
    returnAddress: ReturnAddress;
    savedFrameOffset: number;
    markerPosition: number;
}
