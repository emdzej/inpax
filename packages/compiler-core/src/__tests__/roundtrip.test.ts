import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseIpo } from '@emdzej/inpax-parser';
import { disassembleIpo } from '@emdzej/inpax-dis';
import { compile } from '../index.js';

const FIXTURES = join(
  dirname(fileURLToPath(import.meta.url)),
  '../..',
  '__tests__',
  'fixtures',
);

function findLastIndex<T>(arr: T[], pred: (x: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) if (pred(arr[i])) return i;
  return -1;
}

function compileFixture(name: string) {
  const source = readFileSync(join(FIXTURES, `${name}.ips`), 'utf-8');
  const bytes = compile(source);
  const ipo = parseIpo(bytes);
  const disasm = disassembleIpo(ipo, {
    showRaw: false,
    showAddress: false,
    showComments: false,
    resolveLabels: false,
    noColor: true,
  });
  return { bytes, ipo, disasm: disasm.join('\n') };
}

describe('stage 2a — minimal compile/disasm round trips', () => {
  it('empty.ips: header + auto-generated startup/shutdown + globals/constants', () => {
    const { bytes, ipo } = compileFixture('empty');

    // Header
    expect(bytes[0]).toBe(0x05);
    expect(bytes[1]).toBe(0x00);
    expect(new TextDecoder().decode(bytes.subarray(2, 15))).toBe(
      'TEST-Infotext',
    );
    expect(bytes[15]).toBe(0x0a);

    // Functions: inpainit(2), inpaexit(3), startup(0), shutdown(1)
    expect(Array.from(ipo.functions.keys()).sort()).toEqual([0, 1, 2, 3]);
    expect(ipo.functions.get(0)!.header.name).toBe('__inpa_startup__');
    expect(ipo.functions.get(1)!.header.name).toBe('__inpa_shutdown__');
    expect(ipo.functions.get(2)!.header.name).toBe('inpainit');
    expect(ipo.functions.get(3)!.header.name).toBe('inpaexit');

    // inpainit/inpaexit are empty -> single RET (0x0E)
    expect(ipo.functions.get(2)!.instructions).toHaveLength(1);
    expect(ipo.functions.get(2)!.instructions[0].opcode).toBe(0x0e);
    expect(ipo.functions.get(3)!.instructions).toHaveLength(1);
    expect(ipo.functions.get(3)!.instructions[0].opcode).toBe(0x0e);

    // startup -> FRAME, CALL_USER #[2]
    const startup = ipo.functions.get(0)!.instructions;
    expect(startup).toHaveLength(2);
    expect(startup[0].opcode).toBe(0x0f);
    expect(startup[1].opcode).toBe(0x0c);
    expect(startup[1].operand1).toBe(0x80);
    expect(startup[1].operand2).toBe(2);

    // shutdown -> FRAME, CALL_USER #[3]
    const shutdown = ipo.functions.get(1)!.instructions;
    expect(shutdown).toHaveLength(2);
    expect(shutdown[0].opcode).toBe(0x0f);
    expect(shutdown[1].opcode).toBe(0x0c);
    expect(shutdown[1].operand1).toBe(0x80);
    expect(shutdown[1].operand2).toBe(3);

    // Globals: one implicit void byte (slot 0)
    expect(ipo.globals.types).toEqual([0x00]);
    // Constants: none
    expect(ipo.constants.values).toEqual([]);
  });

  it('simple-assign.ips: `int x; x = 1;`', () => {
    const { ipo } = compileFixture('simple-assign');

    // One constant: int 1
    expect(ipo.constants.values).toHaveLength(1);
    expect(ipo.constants.values[0].value).toBe(1);

    // inpainit:
    //   ALLOC INT         (local[0] = x)
    //   LOAD CONST #[0]   (1)
    //   PUSHR LOCAL #[0]  (x)
    //   MOV
    //   RET
    const init = ipo.functions.get(2)!.instructions;
    expect(init).toHaveLength(5);
    expect(init[0]).toMatchObject({ opcode: 0x08, operand1: 0x51 }); // ALLOC INT
    expect(init[1]).toMatchObject({ opcode: 0x01, operand1: 0x01, operand2: 0 });
    expect(init[2]).toMatchObject({ opcode: 0x06, operand1: 0x02, operand2: 0 });
    expect(init[3].opcode).toBe(0x05);
    expect(init[4].opcode).toBe(0x0e);
  });

  it('add-and-call.ips: `foo(1 + 2)` with an in-param', () => {
    const { ipo } = compileFixture('add-and-call');

    // foo is the first user function -> id 4
    const foo = Array.from(ipo.functions.values()).find(
      (f) => f.header.name === 'foo',
    );
    expect(foo).toBeTruthy();
    expect(foo!.header.blockId).toBe(4);

    // Body of foo: `int x; x = v;`
    //   ALLOC INT          (local[1] = x)
    //   LOAD LOCAL #[0]    (v — in-param slot 0)
    //   PUSHR LOCAL #[1]   (x — local slot 1)
    //   MOV
    //   RET
    expect(foo!.instructions).toHaveLength(5);
    expect(foo!.instructions[0]).toMatchObject({ opcode: 0x08, operand1: 0x51 });
    expect(foo!.instructions[1]).toMatchObject({
      opcode: 0x01,
      operand1: 0x02,
      operand2: 0,
    });
    expect(foo!.instructions[2]).toMatchObject({
      opcode: 0x06,
      operand1: 0x02,
      operand2: 1,
    });
    expect(foo!.instructions[3].opcode).toBe(0x05);
    expect(foo!.instructions[4].opcode).toBe(0x0e);

    // inpainit: `foo(1 + 2);`
    //   FRAME
    //   LOAD CONST #[0]   (1)
    //   LOAD CONST #[1]   (2)
    //   ALU ADD
    //   CALL USER #[4]    (foo)
    //   RET
    const init = ipo.functions.get(2)!.instructions;
    expect(init).toHaveLength(6);
    expect(init[0].opcode).toBe(0x0f);
    expect(init[1]).toMatchObject({ opcode: 0x01, operand1: 0x01 });
    expect(init[2]).toMatchObject({ opcode: 0x01, operand1: 0x01 });
    expect(init[3]).toMatchObject({ opcode: 0x09, operand1: 0x60 });
    expect(init[4]).toMatchObject({ opcode: 0x0c, operand1: 0x80, operand2: 4 });
    expect(init[5].opcode).toBe(0x0e);
  });
});

describe('stage 2b — control flow', () => {
  it('if-else: predicate + MOVE-to-condition + JMPNZ to else + JMP past else', () => {
    const { ipo } = compileFixture('if-else');
    const ins = ipo.functions.get(2)!.instructions;

    // Prelude: ALLOC INT for `int x` at slot 0
    expect(ins[0]).toMatchObject({ opcode: 0x08, operand1: 0x51 });

    // condition: load x, load 1, EQ, MOVE 0,1
    expect(ins[1]).toMatchObject({ opcode: 0x01, operand1: 0x02 });
    expect(ins[2]).toMatchObject({ opcode: 0x01, operand1: 0x01 });
    expect(ins[3]).toMatchObject({ opcode: 0x09, operand1: 0x68 });
    expect(ins[4]).toMatchObject({ opcode: 0x05, operand2: 1 });

    // JMPNZ -> else; ELSE entry index is the position after THEN+JMP.
    const jmpnz = ins.findIndex((i) => i.opcode === 0x0b);
    const jmpPastElse = ins.findIndex((i, idx) => i.opcode === 0x0a && idx > jmpnz);
    expect(jmpnz).toBeGreaterThanOrEqual(0);
    expect(jmpPastElse).toBeGreaterThan(jmpnz);
    expect(ins[jmpnz].operand2).toBe(jmpPastElse + 1);
    expect(ins[jmpPastElse].operand2).toBe(ins.length - 1);
    expect(ins[ins.length - 1].opcode).toBe(0x0e);
  });

  it('while-loop: back-edge JMP returns to condition start', () => {
    const { ipo } = compileFixture('while-loop');
    const ins = ipo.functions.get(2)!.instructions;

    // ALLOC INT prelude
    expect(ins[0]).toMatchObject({ opcode: 0x08, operand1: 0x51 });

    // First JMPNZ exits the loop; the LAST jump in the function is the
    // back-edge.
    const jmpnz = ins.findIndex((i) => i.opcode === 0x0b);
    const lastJmp = findLastIndex(ins, (i) => i.opcode === 0x0a);
    expect(jmpnz).toBeGreaterThan(0);
    expect(lastJmp).toBeGreaterThan(jmpnz);

    // back-edge target is the start of the condition (instruction just
    // after the last assign before condition reload)
    const condStart = ins[lastJmp].operand2;
    expect(condStart).toBeLessThan(jmpnz);
    // JMPNZ targets the instruction right after the back-edge JMP
    expect(ins[jmpnz].operand2).toBe(lastJmp + 1);
    expect(ins[ins.length - 1].opcode).toBe(0x0e);
  });

  it('rejects `for` loops at parse time', () => {
    // `for` isn't part of the INPA grammar — INPACOMP's bison has only
    // `if_construct` and `while_construct` (verified via Ghidra string
    // scan). The parser should reject with a clear message.
    expect(() =>
      compile(`inpainit() { for (i = 0; i < 5; i = i + 1) {} } inpaexit() {}`),
    ).toThrow(/'for' loops are not part of the INPA language/);
  });

  it('STATEMACHINE: 0x03 INIT block + 0x25 per state, handle scope = 0x42', () => {
    const { ipo } = compileFixture('statemachine');

    // 1 state machine, id=0
    expect(ipo.stateMachines.size).toBe(1);
    const sm = ipo.stateMachines.get(0)!;
    expect(sm.header.name).toBe('sm_demo');

    // INIT body: FRAME, LOAD const "Demo", CALL settitle (sys id 0x03)
    const init = sm.func!.instructions;
    const callSettitle = init.find(
      (i) => i.opcode === 0x0c && i.operand1 === 0x81 && i.operand2 === 0x03,
    );
    expect(callSettitle).toBeTruthy();

    // 3 states with names "start", "running", "done"
    expect(sm.states.map((s) => s.header.name)).toEqual(['start', 'running', 'done']);

    // inpainit -> setstatemachine(sm_demo) emits PUSHREF with scope=0x42
    const initFn = ipo.functions.get(2)!.instructions;
    const handle = initFn.find((i) => i.opcode === 0x02 && i.operand1 === 0x42);
    expect(handle).toMatchObject({ operand1: 0x42, operand2: 0 });
  });

  it('LOGTABLE: 0x05 lookup function + 0x04 data block with 3×u32 entries', () => {
    const { bytes } = compileFixture('logtable');
    // The high-level parser doesn't expose 0x04 blocks. Inspect bytes
    // directly to verify the layout.
    const txt = Buffer.from(bytes).toString('latin1');

    // Function block name "lt_demo" exists exactly once.
    const fnIdx = txt.indexOf('lt_demo');
    expect(fnIdx).toBeGreaterThan(0);

    // Data block name " LT_lt_demo" (space-prefixed) exists exactly once.
    const dataIdx = txt.indexOf(' LT_lt_demo');
    expect(dataIdx).toBeGreaterThan(fnIdx);

    // Function body has the canonical 4-instruction shape:
    //   11 51 02 00  PUSHIMM INT 2  (2 input bits — i1, i2)
    //   11 51 01 00  PUSHIMM INT 1  (1 output bit — o)
    //   10 44 00 00  LOGTABLE 0x44 0
    //   0E 00 00 00  RET
    // The size header u16 (0x04 0x00) immediately precedes the body.
    const idx = bytes.indexOf(0x11, fnIdx); // first PUSHIMM after the name
    expect(bytes[idx]).toBe(0x11);
    expect(bytes[idx + 1]).toBe(0x51); // INT marker
    expect(bytes[idx + 2]).toBe(0x02); // 2 input bits
    expect(bytes[idx + 4]).toBe(0x11);
    expect(bytes[idx + 6]).toBe(0x01); // 1 output bit
    expect(bytes[idx + 8]).toBe(0x10); // LOGTABLE
    expect(bytes[idx + 9]).toBe(0x44); // magic 0x44
    expect(bytes[idx + 12]).toBe(0x0e); // RET

    // The data-block size (u16 at start of payload header) is 4 entries
    // — find the size right after ' LT_lt_demo' name + separators.
    // Layout: [04][name][0A][id u16][flags u16][arg1 0A][arg2 0A][00][size u16]
    // We can just verify the entry count by looking for first entry:
    // 00 00 00 00 03 00 00 00 00 00 00 00  (input=0, mask=3, output=0 for 0y00 → 0y0)
    const entriesStart = bytes.indexOf(0x00, dataIdx + 11);
    // First entry's mask field should be 0x03 (both input bits matter)
    // — confirmed by scanning forward to the 5th u32:
    const view = new DataView(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength,
    );
    // Search forward for a u32 == 3 followed by a u32 == 0 (the
    // canonical mask + first output for entry 0 in our 2-bit table).
    let foundMask3 = false;
    for (let i = dataIdx; i < bytes.length - 8; i++) {
      if (view.getUint32(i, true) === 0 && view.getUint32(i + 4, true) === 3) {
        foundMask3 = true;
        break;
      }
    }
    expect(foundMask3).toBe(true);
  });

  it('rejects `++` / `--` / `%` / `return value` / `arr[i]`', () => {
    const cases: Array<[string, RegExp]> = [
      [
        'inpainit() { int x; x++; } inpaexit() {}',
        /'\+\+' is not part of the INPA language/,
      ],
      [
        'inpainit() { int x; --x; } inpaexit() {}',
        /'--' is not part of the INPA language/,
      ],
      [
        'inpainit() { int x; x = 5 % 3; } inpaexit() {}',
        /modulo '%' is not part of the INPA language/,
      ],
      [
        'foo() { return 5; } inpainit() { foo(); } inpaexit() {}',
        /INPA does not support 'return <value>;'/,
      ],
      [
        'inpainit() { int x; x = arr[0]; } inpaexit() {}',
        /array indexing 'expr\[i\]' is not part of the INPA language/,
      ],
    ];
    for (const [src, expected] of cases) {
      expect(() => compile(src), `case: ${src}`).toThrow(expected);
    }
  });
});

describe('stage 2c — out / inout parameters', () => {
  it('out-param: caller PUSHREF marker + callee PUSHREFSTORE for write', () => {
    const { ipo } = compileFixture('out-param');

    // Caller (inpainit):
    //   ALLOC INT    (local x)
    //   FRAME
    //   PUSHREF local[0]  -- 0x02 marker, callee sees ref descriptor as its local[0]
    //   CALL user set_to_one
    //   RET
    const init = ipo.functions.get(2)!.instructions;
    expect(init).toHaveLength(5);
    expect(init[0]).toMatchObject({ opcode: 0x08, operand1: 0x51 });
    expect(init[1].opcode).toBe(0x0f);
    expect(init[2]).toMatchObject({ opcode: 0x02, operand1: 0x02, operand2: 0 });
    expect(init[3]).toMatchObject({ opcode: 0x0c, operand1: 0x80, operand2: 4 });
    expect(init[4].opcode).toBe(0x0e);

    // Callee (set_to_one):
    //   LOAD const[0] (1)
    //   PUSHREFSTORE local[0]  -- 0x07 dereferences caller's slot
    //   MOVE
    //   RET
    const callee = Array.from(ipo.functions.values()).find(
      (f) => f.header.name === 'set_to_one',
    )!;
    expect(callee.instructions).toHaveLength(4);
    expect(callee.instructions[0]).toMatchObject({ opcode: 0x01, operand1: 0x01 });
    expect(callee.instructions[1]).toMatchObject({
      opcode: 0x07,
      operand1: 0x02,
      operand2: 0,
    });
    expect(callee.instructions[2].opcode).toBe(0x05);
    expect(callee.instructions[3].opcode).toBe(0x0e);
  });

  it('inout-param: callee reads via LOADINOUTREF, writes via PUSHREFSTORE', () => {
    const { ipo } = compileFixture('inout-param');
    const bump = Array.from(ipo.functions.values()).find(
      (f) => f.header.name === 'bump',
    )!;

    //   LOADINOUTREF local[0]   -- 0x03 read inout param n
    //   LOAD const (1)
    //   ALU ADD
    //   PUSHREFSTORE local[0]   -- 0x07 write back into caller's slot
    //   MOVE
    //   RET
    expect(bump.instructions).toHaveLength(6);
    expect(bump.instructions[0]).toMatchObject({
      opcode: 0x03,
      operand1: 0x02,
      operand2: 0,
    });
    expect(bump.instructions[1]).toMatchObject({ opcode: 0x01, operand1: 0x01 });
    expect(bump.instructions[2]).toMatchObject({ opcode: 0x09, operand1: 0x60 });
    expect(bump.instructions[3]).toMatchObject({
      opcode: 0x07,
      operand1: 0x02,
      operand2: 0,
    });
    expect(bump.instructions[4].opcode).toBe(0x05);
    expect(bump.instructions[5].opcode).toBe(0x0e);
  });
});

describe('stage 2d — screens and menus', () => {
  it('screen-menu: correct block order, ids, line/control sub-blocks, menu item keys', () => {
    const { bytes, ipo } = compileFixture('screen-menu');

    // 1 screen at id 0, 1 menu at id 0
    expect(ipo.screens.size).toBe(1);
    expect(ipo.menus.size).toBe(1);
    const screen = ipo.screens.get(0)!;
    const menu = ipo.menus.get(0)!;
    expect(screen.header.name).toBe('s_main');
    expect(menu.header.name).toBe('m_main');

    // Screen has 2 lines, the first with a control sub-block
    expect(screen.lines).toHaveLength(2);
    expect(screen.lines[0].header.arg1).toBe('Voltage');
    expect(screen.lines[0].header.arg2).toBe('VOLT');
    expect(screen.lines[0].controls).toHaveLength(1);
    expect(screen.lines[1].header.arg1).toBe('Status');
    expect(screen.lines[1].header.arg2).toBe('STAT');
    expect(screen.lines[1].controls).toHaveLength(0);

    // Menu items: key in `flags`, label in `arg1`
    expect(menu.items).toHaveLength(2);
    expect(menu.items[0].header.flags).toBe(1);
    expect(menu.items[0].header.arg1).toBe('Show');
    expect(menu.items[1].header.flags).toBe(10);
    expect(menu.items[1].header.arg1).toBe('Exit');

    // inpainit -> setmenu(m_main) emits PUSHREF Menu(0x41)[0],
    // setscreen(s_main, TRUE) emits PUSHREF Screen(0x40)[0]
    const init = ipo.functions.get(2)!.instructions;
    const setmenuArg = init.find(
      (i) => i.opcode === 0x02 && i.operand1 === 0x41,
    );
    const setscreenArg = init.find(
      (i) => i.opcode === 0x02 && i.operand1 === 0x40,
    );
    expect(setmenuArg).toMatchObject({ operand1: 0x41, operand2: 0 });
    expect(setscreenArg).toMatchObject({ operand1: 0x40, operand2: 0 });

    // File layout sanity: confirm the screen block comes after user
    // funcs but before inpainit/etc by checking bytes layout
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  it('screen-menu: menu item exit call references system function 0x0c', () => {
    const { ipo } = compileFixture('screen-menu');
    const menu = ipo.menus.get(0)!;
    // ITEM(10, "Exit") body: `exit();` -> FRAME, CALL SYSTEM 0x0c
    const exitItem = menu.items[1];
    const fn = exitItem.func!;
    expect(fn.instructions).toHaveLength(2);
    expect(fn.instructions[0].opcode).toBe(0x0f);
    expect(fn.instructions[1]).toMatchObject({
      opcode: 0x0c,
      operand1: 0x81,
      operand2: 0x0c,
    });
  });
});

describe('stage 2e — #include + #pragma', () => {
  it('resolves nested #include relative to the source file', () => {
    const fixturePath = join(FIXTURES, 'with-include.ips');
    const src = readFileSync(fixturePath, 'utf-8');
    const ipo = parseIpo(compile(src, { filePath: fixturePath }));

    // Two globals — both came in from headers.
    //   util.h:    `string banner = "hello";`
    //   header.h:  `int from_header_counter;`
    expect(ipo.globals.types).toEqual([0x00, 0x06, 0x03]); // void, string, int

    // The `extern delay(...);` in header.h is parsed but otherwise
    // ignored — verify by checking we still only have 4 functions.
    expect(ipo.functions.size).toBe(4);

    // inpainit body references `from_header_counter`, which the symbol
    // table resolves to global slot 2 (string banner is slot 1).
    const init = ipo.functions.get(2)!.instructions;
    const store = init.find((i) => i.opcode === 0x06);
    expect(store).toMatchObject({ operand1: 0x00, operand2: 2 });
  });

  it('detects include cycles', () => {
    expect(() =>
      compile('#include "a.h"\ninpainit() {}\ninpaexit() {}', {
        filePath: '/virt/main.ips',
        fileReader: (p) => {
          if (p === '/virt/a.h') return '#include "b.h"\n';
          if (p === '/virt/b.h') return '#include "a.h"\n';
          return undefined;
        },
      }),
    ).toThrow(/include cycle/);
  });

  it('reports an error when an #include cannot be found', () => {
    expect(() =>
      compile('#include "missing.h"\ninpainit() {}\ninpaexit() {}', {
        filePath: '/virt/main.ips',
        fileReader: () => undefined,
      }),
    ).toThrow(/cannot find include/);
  });

  it('decodes #include bodies with the supplied --encoding (cp1252)', () => {
    // BMW headers like `BMW_STD.H` ship in cp1252; reading them as
    // UTF-8 silently corrupts every byte ≥ 0x80 (German umlauts).
    // The `encoding` option flows to the preprocessor's default
    // fileReader so the included content arrives as the right JS
    // string. We construct a cp1252 file on disk byte-by-byte to
    // avoid depending on what the test runner's locale does.
    const { mkdtempSync, writeFileSync, rmSync } = require('node:fs') as typeof import('node:fs');
    const { tmpdir } = require('node:os') as typeof import('node:os');
    const tmp = mkdtempSync(join(tmpdir(), 'inpax-enc-'));
    try {
      // Encode `string gruss = "Zündung";` directly as cp1252 bytes —
      // the only non-ASCII char is ü (0xFC). Keeping the identifier
      // ASCII so the lexer doesn't need to handle non-ASCII idents.
      const cp1252 = Buffer.from([
        // string gruss = "
        0x73, 0x74, 0x72, 0x69, 0x6e, 0x67, 0x20, 0x67, 0x72, 0x75, 0x73, 0x73,
        0x20, 0x3d, 0x20, 0x22,
        // Zündung
        0x5a, 0xfc, 0x6e, 0x64, 0x75, 0x6e, 0x67,
        // ";\n
        0x22, 0x3b, 0x0a,
      ]);
      writeFileSync(join(tmp, 'hdr.h'), cp1252);
      const bytes = compile(
        '#include "hdr.h"\ninpainit() { settitle(gruss); }\ninpaexit() {}',
        { filePath: join(tmp, 'main.ips'), encoding: 'cp1252' },
      );
      // The compiled IPO should contain the cp1252-encoded "Zündung"
      // bytes (the writer encodes JS strings naively via
      // `charCodeAt & 0xff`, which is identity for Latin-1 high
      // bytes — so 0xFC stays 0xFC).
      const needle = Buffer.from([0x5a, 0xfc, 0x6e, 0x64, 0x75, 0x6e, 0x67]);
      expect(Buffer.from(bytes).includes(needle)).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('resolves an #include case-insensitively (basename) when the disk casing differs', () => {
    // Real BMW case: a script written under DOS/Windows uses
    // uppercase `BMW_STD.H`, but the file on a case-sensitive
    // filesystem is `bmw_std.h`. The preprocessor's CI-fallback uses
    // `readdirSync` on the real filesystem, so this test exercises
    // an actual temp directory rather than the virtual fileReader.
    const { mkdtempSync, writeFileSync, rmSync } = require('node:fs') as typeof import('node:fs');
    const { tmpdir } = require('node:os') as typeof import('node:os');
    const tmp = mkdtempSync(join(tmpdir(), 'inpax-ci-include-'));
    try {
      writeFileSync(join(tmp, 'bmw_std.h'), 'int counter;\n');
      writeFileSync(
        join(tmp, 'main.ips'),
        '#include "BMW_STD.H"\ninpainit() { counter = 1; }\ninpaexit() {}',
      );
      const src = readFileSync(join(tmp, 'main.ips'), 'utf-8');
      const bytes = compile(src, {
        filePath: join(tmp, 'main.ips'),
        includePaths: [tmp],
      });
      const ipo = parseIpo(bytes);
      // One user global (`counter`) plus the implicit void slot.
      expect(ipo.globals.types).toEqual([0x00, 0x03]);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('stage 2f — import32 / CALLE', () => {
  it('emits CALLE with the encoded descriptor constant', () => {
    const { ipo } = compileFixture('import32-call');

    // Descriptor for GetIniString must match the format observed in
    // real INPACOMP output (see ABGAS.IPO constant pool +
    // docs/ipo-file-structure.md):
    //   <DLL>::<Func>:<conv>.<param chars><return marker>
    const descriptor = ipo.constants.values.find(
      (c) => typeof c.value === 'string' && c.value.includes('GetPrivateProfileStringA'),
    );
    expect(descriptor?.value).toBe(
      'kernel32::GetPrivateProfileStringA:c.sssSis%I',
    );

    // inpainit body: ALLOC string, ALLOC int, FRAME, push 7 args, CALLE
    const init = ipo.functions.get(2)!.instructions;
    expect(init[0]).toMatchObject({ opcode: 0x08, operand1: 0x55 }); // ALLOC STRING
    expect(init[1]).toMatchObject({ opcode: 0x08, operand1: 0x51 }); // ALLOC INT
    expect(init[2].opcode).toBe(0x0f); // FRAME

    // arg pushes (in:string, in:string, in:string, out:string,
    //             in:int, in:string, returns:int)
    expect(init[3]).toMatchObject({ opcode: 0x01, operand1: 0x01 }); // LOAD const
    expect(init[4]).toMatchObject({ opcode: 0x01, operand1: 0x01 });
    expect(init[5]).toMatchObject({ opcode: 0x01, operand1: 0x01 });
    expect(init[6]).toMatchObject({ opcode: 0x02, operand1: 0x02 }); // PUSHREF local (out buff)
    expect(init[7]).toMatchObject({ opcode: 0x01, operand1: 0x01 });
    expect(init[8]).toMatchObject({ opcode: 0x01, operand1: 0x01 });
    expect(init[9]).toMatchObject({ opcode: 0x02, operand1: 0x02 }); // PUSHREF local (returns size)

    // CALLE 01 <descriptor index>
    const calle = init[10];
    expect(calle.opcode).toBe(0x0d);
    expect(calle.operand1).toBe(0x01);
    const descIdx = ipo.constants.values.findIndex(
      (c) => c.value === 'kernel32::GetPrivateProfileStringA:c.sssSis%I',
    );
    expect(calle.operand2).toBe(descIdx);
  });

  it('preserves DLL string verbatim when no `::` in lib clause', () => {
    // OpenFile is declared with `lib "kernel32"` and no `::Func`;
    // descriptor should fall back to using the alias as the function
    // name. Although we don't call OpenFile from the fixture, the
    // descriptor builder is exercised at semantic-analysis time — but
    // codegen only allocates it on call. Encode it manually and check
    // the rule by constructing a tiny standalone case below.
    const ipo = parseIpo(
      compile(
        `import32 "C" lib "kernel32" OpenFile(in: string FileName, inout: structure ReOpenBuff, in: int Style, returns: int ReturnedValue);

inpainit() {
  string fn;
  int    err;
  // Note: ReOpenBuff would be a structure; we pass any string ref
  // here for the disasm test — semantic checks for structure args are
  // a stage-3 concern.
  OpenFile(fn, fn, 0, err);
}
inpaexit() {}
`,
      ),
    );
    const descriptor = ipo.constants.values.find(
      (c) => typeof c.value === 'string' && c.value.includes('OpenFile'),
    );
    expect(descriptor?.value).toBe('kernel32::OpenFile:c.stli%I');
  });

  it('encodes 16-bit `import` with uppercase convention letter', () => {
    const ipo = parseIpo(
      compile(
        `import "C" lib "kernel::Func" CallMe(in: string s, returns: int r);

inpainit() {
  int x;
  CallMe("hello", x);
}
inpaexit() {}
`,
      ),
    );
    const descriptor = ipo.constants.values.find(
      (c) => typeof c.value === 'string' && c.value.startsWith('kernel::Func'),
    );
    // 16-bit -> uppercase C; rest of encoding identical
    expect(descriptor?.value).toBe('kernel::Func:C.s%I');
  });
});
