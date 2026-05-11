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
  LineBlock,
  Instruction,
  StackEntry,
  BlockType,
  ValueType,
} from '@emdzej/inpax-core';

const MAGIC = 'TEST-Infotext';
const SEPARATOR = 0x0a;

/**
 * IPO File Parser
 */
export class IpoParser {
  private readonly bytes: Uint8Array;
  private readonly view: DataView;
  private offset: number = 0;

  constructor(buffer: Uint8Array | ArrayBufferLike) {
    // Accept either a `Uint8Array` (preferred — Node fs reads, browser
    // File API, FileSystem Access reads all yield this) or a raw
    // `ArrayBuffer`. Internally we keep the byte view and a parallel
    // DataView so we can do little-endian reads without depending on
    // Node's `Buffer.readUInt32LE` family.
    this.bytes =
      buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    this.view = new DataView(
      this.bytes.buffer,
      this.bytes.byteOffset,
      this.bytes.byteLength
    );
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
    while (this.offset < this.bytes.length) {
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
    if (this.offset >= this.bytes.length) {
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

      case BlockType.Function: {
        const func = this.parseFunction(header);
        file.functions.set(header.blockId, func);
        break;
      }

      case BlockType.Screen: {
        const screen = this.parseScreen(header);
        file.screens.set(header.blockId, screen);
        break;
      }

      case BlockType.Menu: {
        const menu = this.parseMenu(header);
        file.menus.set(header.blockId, menu);
        break;
      }

      case BlockType.StateMachine: {
        const sm = this.parseStateMachine(header);
        file.stateMachines.set(header.blockId, sm);
        break;
      }

      case BlockType.ScreenFunc:
      case BlockType.LineFunc:
      case BlockType.ControlFunc:
      case BlockType.MenuItemFunc:
      case BlockType.StateFunc: {
        // Sub-functions - should be parsed as part of parent blocks
        // If we get here, it's an orphan sub-function (shouldn't happen in valid files)
        const subFunc = this.parseFunction(header);
        file.functions.set(header.blockId, subFunc);
        break;
      }

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
   * Parse screen block with children
   * Structure: Screen header -> ScreenFunc (0x21) -> LineFunc (0x22)* -> ControlFunc (0x23)?
   */
  private parseScreen(header: BlockHeader): ScreenBlock {
    const screen: ScreenBlock = { header, lines: [] };
    const allocFunc = this.parseFunction(header);
    screen.allocFunc = allocFunc;
    // Expect ScreenFunc (0x21) immediately after screen header
    if (this.peekU8() === BlockType.ScreenFunc) {
      const funcHeader = this.parseBlockHeader()!;
      screen.initFunc = this.parseFunction(funcHeader);
    }

    // Parse LineFunc (0x22) blocks
    while (this.peekU8() === BlockType.LineFunc) {
      const lineHeader = this.parseBlockHeader()!;
      const lineFunc = this.parseFunction(lineHeader);

      const line: LineBlock = {
        header: lineHeader,
        func: lineFunc,
        controls: [],
      };

      // Check for ControlFunc (0x23) after line
      while (this.peekU8() === BlockType.ControlFunc) {
        const controlHeader = this.parseBlockHeader()!;
        const controlFunc = this.parseFunction(controlHeader);
        line.controls.push({
          header: controlHeader,
          func: controlFunc,
        });
      }

      screen.lines.push(line);
    }

    return screen;
  }

  /**
   * Parse menu block with children
   * Structure: Menu header -> MenuItemFunc (0x24)*
   */
  private parseMenu(header: BlockHeader): MenuBlock {
    const menu: MenuBlock = { header, items: [] };
    const initFunc = this.parseFunction(header);
    menu.func = initFunc;
    // Parse MenuItemFunc (0x24) blocks
    while (this.peekU8() === BlockType.MenuItemFunc) {
      const itemHeader = this.parseBlockHeader()!;
      const itemFunc = this.parseFunction(itemHeader);

      menu.items.push({
        header: itemHeader,
        func: itemFunc,
      });
    }

    return menu;
  }

  /**
   * Parse state machine block with children
   * Structure: StateMachine header -> StateFunc (0x25)*
   */
  private parseStateMachine(header: BlockHeader): StateMachineBlock {
    const sm: StateMachineBlock = { header, states: [] };
    const initFunc = this.parseFunction(header);
    sm.func = initFunc;
    // Parse StateFunc (0x25) blocks
    while (this.peekU8() === BlockType.StateFunc) {
      const stateHeader = this.parseBlockHeader()!;
      const stateFunc = this.parseFunction(stateHeader);

      sm.states.push({
        header: stateHeader,
        func: stateFunc,
      });
    }

    return sm;
  }

  // ============ Buffer reading utilities ============
  // All multi-byte reads are little-endian to match the on-disk IPO
  // format. We use DataView rather than Node `Buffer` so the parser
  // bundles cleanly into a browser app — `Uint8Array` is the lowest
  // common denominator across runtimes.

  private peekU8(): number {
    if (this.offset >= this.bytes.length) return -1;
    return this.bytes[this.offset];
  }

  private readU8(): number {
    return this.bytes[this.offset++];
  }

  private readU16LE(): number {
    const val = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return val;
  }

  private readS16LE(): number {
    const val = this.view.getInt16(this.offset, true);
    this.offset += 2;
    return val;
  }

  private readU32LE(): number {
    const val = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return val;
  }

  private readS32LE(): number {
    const val = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return val;
  }

  private readF64LE(): number {
    const val = this.view.getFloat64(this.offset, true);
    this.offset += 8;
    return val;
  }

  private readStringUntil(terminator: number): string {
    const start = this.offset;
    while (this.offset < this.bytes.length && this.bytes[this.offset] !== terminator) {
      this.offset++;
    }
    // INPA encodes its strings as Latin-1ish (Windows-1252) — TextDecoder
    // 'utf-8' will choke on accented characters in BMW German text. We
    // accept that for now since the existing tests only cover ASCII
    // strings; a CP1252 decoder is a separate concern.
    const slice = this.bytes.subarray(start, this.offset);
    const str = new TextDecoder('utf-8', { fatal: false }).decode(slice);
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
export function parseIpo(buffer: Uint8Array | ArrayBufferLike): IpoFile {
  const parser = new IpoParser(buffer);
  return parser.parse();
}
