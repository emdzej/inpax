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
 * v1.x → v5.x ValueType byte translation for **constants**
 * (block `0x12`).
 *
 * NCSEXPERT.exe's constants reader (`FUN_0046a9a0` with `kind == 1`)
 * uses a different value-type table than INPA.exe's v5.x reader:
 *
 *   v1.x byte  | v1.x meaning | v5.x ValueType
 *   ───────────┼──────────────┼────────────────
 *   0x01       | BOOL         | Bool   (0x01)
 *   0x02       | INT  (s16)   | Int    (0x03)
 *   0x03       | REAL (f64)   | Real   (0x05)
 *   0x04       | STRING       | String (0x06)
 *   0x05       | LONG (s32)   | Long   (0x04)
 *
 * BYTE / ULONG / NUMERIC / OBJECT don't exist in v1.x. The migration
 * is not a clean "shift by one" — REAL moved up and LONG moved down,
 * so a v1.x byte value cannot be reused as a v5.x ValueType. We
 * translate at parse time and store the canonical v5.x ValueType in
 * `StackEntry.type`, so the disassembler / interpreter / formatters
 * don't need version-aware code paths.
 *
 * See `docs/ipo-format-versions.md` for the full reverse-engineering
 * notes.
 */
const V1_CONSTANT_TYPE_TO_VALUE_TYPE: Record<number, ValueType> = {
  0x01: ValueType.Bool,
  0x02: ValueType.Int,
  0x03: ValueType.Real,
  0x04: ValueType.String,
  0x05: ValueType.Long,
};

/**
 * v1.x → v5.x ValueType byte translation for **globals**
 * (block `0x11`).
 *
 * The globals branch of NCSEXPERT.exe's `FUN_0046a9a0(this, 0, count)`
 * is broader than the constants branch: it recognises types `0x01`
 * through `0x06` and falls through silently for anything else
 * (`local_24` stays at 0). Real v1.x files in the wild also include
 * a `0x00` slot at index 0 — same Void-at-slot-0 convention as v5.x
 * (see `docs/ipo-file-structure.md → Global Variables`).
 *
 *   v1.x byte  | v1.x meaning             | v5.x ValueType
 *   ───────────┼──────────────────────────┼────────────────
 *   0x00       | Void (reserved slot 0)   | Void   (0x00)
 *   0x01       | BOOL                     | Bool   (0x01)
 *   0x02       | INT  (s16)               | Int    (0x03)
 *   0x03       | REAL (f64)               | Real   (0x05)
 *   0x04       | STRING                   | String (0x06)
 *   0x05       | LONG (s32)               | Long   (0x04)
 *   0x06       | handle (state-machine/   | ULong  (0x07)
 *              | screen — 4-byte slot)    |
 *
 * The `0x06` mapping is a best-guess: NCSEXPERT's globals reader
 * recognises it as a 4-byte-wide slot but doesn't name it. State
 * machines and screens need handle-typed globals in v1.x, so a
 * `ULong`-equivalent is the closest v5.x semantic. If we discover
 * a counter-example, the mapping is easy to revisit.
 */
const V1_GLOBAL_TYPE_TO_VALUE_TYPE: Record<number, ValueType> = {
  0x00: ValueType.Void,
  0x01: ValueType.Bool,
  0x02: ValueType.Int,
  0x03: ValueType.Real,
  0x04: ValueType.String,
  0x05: ValueType.Long,
  0x06: ValueType.ULong,
};

/**
 * v1.x → v5.x **opcode byte** remap for the four trailing opcodes
 * that v5.x renumbered.
 *
 * The first 12 opcodes (`0x01`–`0x0C`: LOAD/PUSHREF/LOADINOUTREF/NOP/
 * MOVE/PUSHR/PUSHREFSTORE/ALLOC/ALU/JMP/JMPNZ/CALL) are bit-for-bit
 * identical between versions and don't need remapping. So is the AluOp
 * sub-vocabulary (`0x60`–`0x71`, consumed by opcode `0x09` ALU).
 *
 * The four divergent opcodes were identified by decompiling NCSEXPERT's
 * `CInterpreter::DoInterpret` at `FUN_0045d830`:
 *
 *   v1.x byte  | v1.x meaning | v5.x byte | v5.x meaning
 *   ───────────┼──────────────┼───────────┼──────────────
 *   0x0D       | RET          | 0x0E      | RET
 *   0x0E       | FRAME        | 0x0F      | FRAME
 *   0x0F       | CALLE        | 0x0D      | CALLE
 *   0x10       | PUSHIMM      | 0x11      | PUSHIMM
 *
 * v5.x added a new `LOGTABLE` opcode at `0x10` and shifted the four
 * trailing opcodes by one slot (RET/FRAME/CALLE/PUSHIMM). v1.x files
 * therefore *cannot* contain a `LOGTABLE` (no byte ever encodes it in
 * the v1.x source vocabulary), so we don't need a reverse mapping.
 *
 * We remap at parse time so the in-memory `Instruction.opcode` is
 * always a canonical v5.x value — the VM, dispatcher, disassembler,
 * and all downstream consumers stay version-agnostic. The original
 * on-disk byte stays accessible via `Instruction.raw` for tooling
 * that wants to display the file as-written.
 *
 * See `docs/ipo-format-versions.md` for the full reverse-engineering
 * notes.
 */
const V1_OPCODE_TO_V5_OPCODE: Record<number, number> = {
  0x0d: 0x0e, // RET
  0x0e: 0x0f, // FRAME
  0x0f: 0x0d, // CALLE
  0x10: 0x11, // PUSHIMM
};

/**
 * IPO File Parser
 */
export class IpoParser {
  private readonly bytes: Uint8Array;
  private readonly view: DataView;
  private offset: number = 0;
  // Captured from `parseHeader()` so version-dependent parse paths
  // (constants/globals in v1.x vs v5.x) can dispatch without threading
  // the version through every helper signature.
  private versionHi: number = 0;

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

    this.versionHi = versionHi;
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
   * Parse global variables block. The block stores `size` type bytes
   * with no values — variables are initialised to defaults at runtime.
   * Type-byte vocabulary differs between v1.x and v5.x, so we
   * translate v1.x bytes into the canonical v5.x ValueType space
   * (see `V1_TYPE_TO_VALUE_TYPE`).
   */
  private parseGlobals(header: BlockHeader): GlobalsBlock {
    const types: ValueType[] = [];
    const isV1 = this.versionHi === 1;

    for (let i = 0; i < header.size; i++) {
      const raw = this.readU8();
      if (isV1) {
        const mapped = V1_GLOBAL_TYPE_TO_VALUE_TYPE[raw];
        if (mapped === undefined) {
          throw new Error(
            `Unknown v1.x global type byte 0x${raw.toString(16)} at offset ${this.offset - 1}`,
          );
        }
        types.push(mapped);
      } else {
        types.push(raw as ValueType);
      }
    }

    return { header, types };
  }

  /**
   * Parse constants block
   */
  private parseConstants(header: BlockHeader): ConstantsBlock {
    const values: StackEntry[] = [];
    const isV1 = this.versionHi === 1;

    for (let i = 0; i < header.size; i++) {
      const entry = isV1 ? this.parseConstantV1() : this.parseConstantV5();
      values.push(entry);
    }

    return { header, values };
  }

  /**
   * v5.x constant reader — types 0x01–0x09.
   *
   * Mirrors INPA.exe's `FUN_00463bd7` (the debug-path reader) and
   * matches the type table verified at `INPA.exe!FUN_0046456b`.
   */
  private parseConstantV5(): StackEntry {
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
      case ValueType.ULong:
      case ValueType.Numeric:
      case ValueType.Object:
        value = this.readS32LE();
        break;
    }

    return { type, flags: 1, value };
  }

  /**
   * v1.x constant reader — types 0x01–0x05.
   *
   * Mirrors NCSEXPERT.exe's `FUN_0046a9a0(this, 1, count)` switch.
   * The on-disk type byte is translated into the canonical v5.x
   * ValueType so downstream consumers don't need to know about the
   * v1.x vocabulary.
   */
  private parseConstantV1(): StackEntry {
    const raw = this.readU8();
    const type = V1_CONSTANT_TYPE_TO_VALUE_TYPE[raw];
    if (type === undefined) {
      throw new Error(
        `Unknown v1.x constant type byte 0x${raw.toString(16)} at offset ${this.offset - 1}`,
      );
    }

    let value: boolean | number | string | null = null;
    switch (raw) {
      case 0x01: // BOOL
        value = this.readU8() !== 0;
        break;
      case 0x02: // INT (s16)
        value = this.readS16LE();
        break;
      case 0x03: // REAL (f64)
        value = this.readF64LE();
        break;
      case 0x04: // STRING (LF-terminated)
        value = this.readStringUntil(SEPARATOR);
        break;
      case 0x05: // LONG (s32)
        value = this.readS32LE();
        break;
    }

    return { type, flags: 1, value };
  }

  /**
   * Parse function block (instructions).
   *
   * Each instruction is 4 bytes: `[opcode][operand1][operand2_lo][operand2_hi]`.
   * For v1.x files, four of the opcode bytes carry different meanings
   * than their v5.x counterparts (see `V1_OPCODE_TO_V5_OPCODE` for the
   * full table and rationale). We remap to canonical v5.x opcode bytes
   * here so the rest of the system — VM, disassembler, dispatcher —
   * works on a single normalised representation.
   *
   * The `raw` field preserves the original 32-bit on-disk word so any
   * tooling that needs to render the file faithfully (e.g. a "show me
   * what's actually in the bytes" disassembler view) can do so without
   * losing information.
   */
  private parseFunction(header: BlockHeader): FunctionBlock {
    const instructions: Instruction[] = [];
    const isV1 = this.versionHi === 1;

    for (let i = 0; i < header.size; i++) {
      const raw = this.readU32LE();
      const rawOpcode = raw & 0xff;
      // For v1.x, swap the four renumbered opcodes (0x0D–0x10) into
      // their v5.x positions. Other opcodes pass through unchanged
      // — the first 12 (0x01–0x0C) and the ALU sub-codes (0x60–0x71)
      // are identical in both versions.
      const opcode = isV1 ? (V1_OPCODE_TO_V5_OPCODE[rawOpcode] ?? rawOpcode) : rawOpcode;
      instructions.push({
        opcode,
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
    // INPA encodes strings as Windows-1252 (BMW workshop / German
    // language) — `ä`, `ö`, `ü`, etc. live in the 0xA0-0xFF range
    // where UTF-8 sees them as invalid start bytes and writes a
    // replacement char (the `Steuerger�t` symptom). `TextDecoder`
    // supports `windows-1252` natively in both browsers and Node.
    const slice = this.bytes.subarray(start, this.offset);
    const str = new TextDecoder('windows-1252', { fatal: false }).decode(slice);
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
