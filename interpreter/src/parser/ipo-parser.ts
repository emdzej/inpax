import {
  IpoFile,
  IpoHeader,
  BlockHeader,
  GlobalsBlock,
  ConstantsBlock,
  FunctionBlock,
  ScreenBlock,
  MenuBlock,
  StateMachineBlock,
  Instruction,
  StackEntry,
  BlockType,
  ValueType,
} from '../types/index.js';

const MAGIC = 'TEST-Infotext';
const SEPARATOR = 0x0a;

/**
 * IPO File Parser
 */
export class IpoParser {
  private buffer: Buffer;
  private offset: number = 0;

  constructor(buffer: Buffer) {
    this.buffer = buffer;
  }

  /**
   * Parse complete IPO file
   */
  parse(): IpoFile {
    const header = this.parseHeader();
    
    const file: IpoFile = {
      header,
      globals: null!,
      constants: null!,
      functions: new Map(),
      screens: new Map(),
      menus: new Map(),
      stateMachines: new Map(),
    };

    // Parse blocks sequentially
    while (this.offset < this.buffer.length) {
      const blockHeader = this.parseBlockHeader();
      if (!blockHeader) break;

      this.parseBlock(file, blockHeader);
    }

    return file;
  }

  /**
   * Parse file header
   */
  private parseHeader(): IpoHeader {
    const versionHi = this.readU8();
    const versionLo = this.readU8();
    const magic = this.readStringUntil(SEPARATOR);

    if (magic !== MAGIC) {
      throw new Error(`Invalid magic: expected "${MAGIC}", got "${magic}"`);
    }

    return { versionHi, versionLo, magic };
  }

  /**
   * Parse block header
   */
  private parseBlockHeader(): BlockHeader | null {
    if (this.offset >= this.buffer.length) {
      return null;
    }

    const type = this.readU8() as BlockType;
    const name = this.readStringUntil(SEPARATOR);
    const blockId = this.readU16LE();
    const flags = this.readU16LE();
    const arg1 = this.readStringUntil(SEPARATOR);
    const arg2 = this.readStringUntil(SEPARATOR);
    const marker = this.readU8();
    const size = this.readU16LE();

    return { type, name, blockId, flags, arg1, arg2, marker, size };
  }

  /**
   * Parse block based on type
   */
  private parseBlock(file: IpoFile, header: BlockHeader): void {
    switch (header.type) {
      case BlockType.GlobalData:
        file.globals = this.parseGlobals(header);
        break;

      case BlockType.ConstantData:
        file.constants = this.parseConstants(header);
        break;

      case BlockType.Function:
        const func = this.parseFunction(header);
        file.functions.set(header.blockId, func);
        break;

      case BlockType.Screen:
        const screen = this.parseScreen(header);
        file.screens.set(header.blockId, screen);
        break;

      case BlockType.Menu:
        const menu = this.parseMenu(header);
        file.menus.set(header.blockId, menu);
        break;

      case BlockType.StateMachine:
        const sm = this.parseStateMachine(header);
        file.stateMachines.set(header.blockId, sm);
        break;

      case BlockType.ScreenFunc:
      case BlockType.LineFunc:
      case BlockType.ControlFunc:
      case BlockType.MenuItemFunc:
      case BlockType.StateFunc:
        // Sub-functions - attached to parent blocks
        const subFunc = this.parseFunction(header);
        file.functions.set(header.blockId, subFunc);
        break;

      default:
        // Skip unknown block types
        this.skipBytes(header.size);
    }
  }

  /**
   * Parse global variables block
   */
  private parseGlobals(header: BlockHeader): GlobalsBlock {
    const types: ValueType[] = [];
    
    for (let i = 0; i < header.size; i++) {
      types.push(this.readU8() as ValueType);
    }

    return { header, types };
  }

  /**
   * Parse constants block
   */
  private parseConstants(header: BlockHeader): ConstantsBlock {
    const values: StackEntry[] = [];
    
    for (let i = 0; i < header.size; i++) {
      const entry = this.parseConstant();
      values.push(entry);
    }

    return { header, values };
  }

  /**
   * Parse single constant value
   */
  private parseConstant(): StackEntry {
    const type = this.readU8() as ValueType;
    let value: boolean | number | string | null = null;

    switch (type) {
      case ValueType.Bool:
        value = this.readU8() !== 0;
        break;
      case ValueType.Byte:
        value = this.readU8();
        break;
      case ValueType.Int:
        value = this.readS16LE();
        break;
      case ValueType.Long:
        value = this.readS32LE();
        break;
      case ValueType.Real:
        value = this.readF64LE();
        break;
      case ValueType.String:
        value = this.readStringUntil(SEPARATOR);
        break;
      case ValueType.Handle1:
      case ValueType.Handle2:
      case ValueType.Handle3:
        value = this.readS32LE();
        break;
    }

    return { type, flags: 1, value };
  }

  /**
   * Parse function block (instructions)
   */
  private parseFunction(header: BlockHeader): FunctionBlock {
    const instructions: Instruction[] = [];
    
    for (let i = 0; i < header.size; i++) {
      const raw = this.readU32LE();
      instructions.push({
        opcode: raw & 0xff,
        operand1: (raw >> 8) & 0xff,
        operand2: (raw >> 16) & 0xffff,
        raw,
      });
    }

    return { header, instructions };
  }

  /**
   * Parse screen block (placeholder - needs child parsing)
   */
  private parseScreen(header: BlockHeader): ScreenBlock {
    // TODO: Parse child LINE blocks
    return { header, lines: [] };
  }

  /**
   * Parse menu block (placeholder)
   */
  private parseMenu(header: BlockHeader): MenuBlock {
    // TODO: Parse child MENUITEM blocks
    return { header, items: [] };
  }

  /**
   * Parse state machine block (placeholder)
   */
  private parseStateMachine(header: BlockHeader): StateMachineBlock {
    // TODO: Parse child STATE blocks
    return { header, states: [] };
  }

  // ============ Buffer reading utilities ============

  private readU8(): number {
    return this.buffer.readUInt8(this.offset++);
  }

  private readU16LE(): number {
    const val = this.buffer.readUInt16LE(this.offset);
    this.offset += 2;
    return val;
  }

  private readS16LE(): number {
    const val = this.buffer.readInt16LE(this.offset);
    this.offset += 2;
    return val;
  }

  private readU32LE(): number {
    const val = this.buffer.readUInt32LE(this.offset);
    this.offset += 4;
    return val;
  }

  private readS32LE(): number {
    const val = this.buffer.readInt32LE(this.offset);
    this.offset += 4;
    return val;
  }

  private readF64LE(): number {
    const val = this.buffer.readDoubleLE(this.offset);
    this.offset += 8;
    return val;
  }

  private readStringUntil(terminator: number): string {
    const start = this.offset;
    while (this.offset < this.buffer.length && this.buffer[this.offset] !== terminator) {
      this.offset++;
    }
    const str = this.buffer.slice(start, this.offset).toString('utf8');
    this.offset++; // Skip terminator
    return str;
  }

  private skipBytes(count: number): void {
    this.offset += count;
  }
}

/**
 * Parse IPO file from buffer
 */
export function parseIpo(buffer: Buffer): IpoFile {
  const parser = new IpoParser(buffer);
  return parser.parse();
}
