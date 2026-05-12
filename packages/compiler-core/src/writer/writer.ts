import { BlockType, ValueType } from '@emdzej/inpax-core';
import {
  CodegenResult, CompiledFunction, CompiledLogicTable, CompiledMenu,
  CompiledScreen, CompiledStateMachine,
} from '../codegen/codegen.js';
import {
  logtable, pushImmInt, ret as retInstr,
} from '../codegen/encoding.js';
import { ConstEntry } from '../codegen/constant-pool.js';
import { Instruction, packInstruction } from '../codegen/encoding.js';
import { ByteWriter } from './byte-writer.js';

const HEADER_VERSION_HI = 0x05;
const HEADER_VERSION_LO = 0x00;
const HEADER_MAGIC = 'TEST-Infotext';
const SEPARATOR = 0x0a;
const BLOCK_MARKER = 0x00;

interface BlockOptions {
  type: BlockType;
  name: string;
  blockId: number;
  flags: number;
  arg1: string;
  arg2: string;
  /** Number stored as `size` in the block header. */
  size: number;
}

/**
 * Serialises the codegen output to an IPO byte stream.
 *
 * Block emit order matches what we observe in real INPACOMP output —
 * see `disasm/startus.txt` block addresses:
 *
 *   1. user functions (type 0x05) in source order, IDs 4+
 *   2. menus (type 0x02 + 0x24 item funcs)
 *   3. screens (type 0x01 + 0x21 + 0x22* + 0x23?)
 *   4. inpainit (id 2)
 *   5. inpaexit (id 3)
 *   6. __inpa_startup__ (id 0)
 *   7. __inpa_shutdown__ (id 1)
 *   8. Global Data (0x11)
 *   9. Constant Data (0x12)
 *
 * Block IDs are *not* tied to file position — they are assigned by the
 * semantic pass and serialised into each block header. The parser does
 * rely on sub-blocks following their parent (Screen → ScreenFunc → Line
 * → Control; Menu → MenuItem), which is what `writeScreen` / `writeMenu`
 * enforce.
 */
export class IpoWriter {
  private readonly w = new ByteWriter();

  constructor(private readonly result: CodegenResult) {}

  write(): Uint8Array {
    this.writeHeader();

    for (const fn of this.result.userFunctions) {
      this.writeFunctionBlock(fn);
    }
    // Logic-table lookup functions are 0x05 blocks with synthetic
    // bodies — placed alongside user funcs so their IDs (which were
    // allocated from the same nextUserId counter in the semantic pass)
    // are present in the file.
    for (const lt of this.result.logicTables) this.writeLogicTable(lt);

    for (const menu of this.result.menus) this.writeMenu(menu);
    for (const screen of this.result.screens) this.writeScreen(screen);
    for (const sm of this.result.stateMachines) this.writeStateMachine(sm);

    this.writeFunctionBlock(this.result.inpainit);
    this.writeFunctionBlock(this.result.inpaexit);
    this.writeFunctionBlock(this.result.startup);
    this.writeFunctionBlock(this.result.shutdown);

    this.writeGlobalData();
    this.writeConstantData();

    return this.w.toUint8Array();
  }

  private writeHeader(): void {
    this.w.u8(HEADER_VERSION_HI);
    this.w.u8(HEADER_VERSION_LO);
    this.w.asciiBytes(HEADER_MAGIC);
    this.w.u8(SEPARATOR);
  }

  private writeBlockHeader(opts: BlockOptions): void {
    this.w.u8(opts.type);
    this.w.lfString(opts.name);
    this.w.u16LE(opts.blockId);
    this.w.u16LE(opts.flags);
    this.w.lfString(opts.arg1);
    this.w.lfString(opts.arg2);
    this.w.u8(BLOCK_MARKER);
    this.w.u16LE(opts.size);
  }

  private writeFunctionBlock(fn: CompiledFunction): void {
    this.writeBlockHeader({
      type: BlockType.Function,
      name: fn.name,
      blockId: fn.id,
      flags: 0,
      arg1: '',
      arg2: '',
      size: fn.instructions.length,
    });
    for (const i of fn.instructions) {
      this.w.u32LE(packInstruction(i));
    }
  }

  private writeInstructions(instructions: Instruction[]): void {
    for (const i of instructions) {
      this.w.u32LE(packInstruction(i));
    }
  }

  private writeScreen(screen: CompiledScreen): void {
    // Screen block (0x01) — instructions here are SCREEN-scope local
    // allocations (none in stage 2d).
    this.writeBlockHeader({
      type: BlockType.Screen,
      name: screen.name,
      blockId: screen.id,
      flags: 0,
      arg1: '',
      arg2: '',
      size: screen.screenInstructions.length,
    });
    this.writeInstructions(screen.screenInstructions);

    // ScreenFunc (0x21) — always present, even if empty.
    this.writeBlockHeader({
      type: BlockType.ScreenFunc,
      name: '',
      blockId: 0,
      flags: 0,
      arg1: '',
      arg2: '',
      size: screen.bodyInstructions.length,
    });
    this.writeInstructions(screen.bodyInstructions);

    // LineFunc (0x22) per LINE, optionally followed by ControlFunc (0x23).
    for (const line of screen.lines) {
      this.writeBlockHeader({
        type: BlockType.LineFunc,
        name: '',
        blockId: 0,
        flags: 0,
        arg1: line.label,
        arg2: line.tag,
        size: line.bodyInstructions.length,
      });
      this.writeInstructions(line.bodyInstructions);

      if (line.controlInstructions) {
        this.writeBlockHeader({
          type: BlockType.ControlFunc,
          name: '',
          blockId: 0,
          flags: 0,
          arg1: '',
          arg2: '',
          size: line.controlInstructions.length,
        });
        this.writeInstructions(line.controlInstructions);
      }
    }
  }

  private writeMenu(menu: CompiledMenu): void {
    // Menu block (0x02) — instructions are the INIT body.
    this.writeBlockHeader({
      type: BlockType.Menu,
      name: menu.name,
      blockId: menu.id,
      flags: 0,
      arg1: '',
      arg2: '',
      size: menu.initInstructions.length,
    });
    this.writeInstructions(menu.initInstructions);

    // MenuItemFunc (0x24) per ITEM — key in `flags`, label in `arg1`.
    for (const item of menu.items) {
      this.writeBlockHeader({
        type: BlockType.MenuItemFunc,
        name: '',
        blockId: 0,
        flags: item.key,
        arg1: item.label,
        arg2: '',
        size: item.bodyInstructions.length,
      });
      this.writeInstructions(item.bodyInstructions);
    }
  }

  private writeStateMachine(sm: CompiledStateMachine): void {
    // StateMachine block (0x03) — body = INIT block instructions.
    // Per-state blocks (0x25) follow immediately, parsed greedily by
    // `IpoParser.parseStateMachine` (peekU8 == 0x25 loop).
    this.writeBlockHeader({
      type: BlockType.StateMachine,
      name: sm.name,
      blockId: sm.id,
      flags: 0,
      arg1: '',
      arg2: '',
      size: sm.initInstructions.length,
    });
    this.writeInstructions(sm.initInstructions);

    for (const state of sm.states) {
      this.writeBlockHeader({
        type: BlockType.StateFunc,
        name: state.name,
        blockId: 0,
        flags: 0,
        arg1: '',
        arg2: '',
        size: state.bodyInstructions.length,
      });
      this.writeInstructions(state.bodyInstructions);
    }
  }

  private writeLogicTable(lt: CompiledLogicTable): void {
    // Function block 0x05 holding the synthetic lookup body that real
    // INPACOMP generates. Layout reconstructed from EHC_2.IPO's
    // `handst` table (file offset 0xE7A):
    //   11 51 <inputBits> 00   ; PUSHIMM INT <inputBits>
    //   11 51 <outputBits> 00  ; PUSHIMM INT <outputBits>
    //   10 44 00 00            ; LOGTABLE 0x44 0
    //   0E 00 00 00            ; RET
    const body = [
      pushImmInt(lt.inputBits),
      pushImmInt(lt.outputBits),
      logtable(0),
      retInstr(),
    ];
    this.writeBlockHeader({
      type: BlockType.Function,
      name: lt.name,
      blockId: lt.funcId,
      flags: 0,
      arg1: '',
      arg2: '',
      size: body.length,
    });
    this.writeInstructions(body);

    // Data block 0x04 with the entry table. Real INPACOMP prefixes
    // the name with a leading space: e.g. ` LT_handst`. We match that
    // — the parser stores `header.name` as-is, so a downstream
    // disassembler that strips the space would still need to know
    // about the convention.
    this.writeBlockHeader({
      type: BlockType.LogicTable,
      name: ' LT_' + lt.name,
      blockId: 0,
      flags: 0,
      arg1: '',
      arg2: '',
      size: lt.entries.length,
    });
    for (const e of lt.entries) {
      this.w.u32LE(e.inputValue);
      this.w.u32LE(e.inputMask);
      this.w.u32LE(e.outputValue);
    }
  }

  private writeGlobalData(): void {
    // Slot 0 is the implicit `void` global the runtime expects (see
    // docs/ipo-file-structure.md). The semantic pass keeps user globals
    // in slots 1+; we just prepend the void byte here.
    const types: number[] = [ValueType.Void];
    for (const g of this.result.globals) types.push(g.type);

    this.writeBlockHeader({
      type: BlockType.GlobalData,
      name: 'Global Data',
      blockId: 0,
      flags: 0,
      arg1: '',
      arg2: '',
      size: types.length,
    });
    for (const t of types) this.w.u8(t);
  }

  private writeConstantData(): void {
    const entries = this.result.constants.all();
    this.writeBlockHeader({
      type: BlockType.ConstantData,
      name: 'Constant Data',
      blockId: 0,
      flags: 0,
      arg1: '',
      arg2: '',
      size: entries.length,
    });
    for (const e of entries) this.writeConstantValue(e);
  }

  private writeConstantValue(c: ConstEntry): void {
    this.w.u8(c.type);
    switch (c.type) {
      case ValueType.Bool:
        this.w.u8(c.value ? 1 : 0);
        return;
      case ValueType.Byte:
        this.w.u8(Number(c.value) & 0xff);
        return;
      case ValueType.Int:
        this.w.s16LE(Number(c.value));
        return;
      case ValueType.Long:
        this.w.s32LE(Number(c.value));
        return;
      case ValueType.Real:
        this.w.f64LE(Number(c.value));
        return;
      case ValueType.String:
        this.w.asciiBytes(String(c.value));
        this.w.u8(SEPARATOR);
        return;
      default:
        throw new Error(`cannot serialise constant of type ${c.type}`);
    }
  }
}

export function writeIpo(result: CodegenResult): Uint8Array {
  return new IpoWriter(result).write();
}

export function instructionBytes(instr: Instruction): number {
  return packInstruction(instr);
}
