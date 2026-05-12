/**
 * Runtime smoke tests — compile a fixture, parse it back via
 * `@emdzej/inpax-parser`, run it through `@emdzej/inpax-interpreter`'s
 * VM, then assert on observable post-run state (globals).
 *
 * These are intentionally narrow: each fixture stores everything it
 * wants to observe in a global slot so we can read it back from the
 * VM after `run()` returns. Locals disappear when their function's
 * frame is unwound, which is exactly the behaviour we expect.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseIpo } from '@emdzej/inpax-parser';
import { VM } from '@emdzej/inpax-interpreter';
import type { IpoFile, StackEntry } from '@emdzej/inpax-core';
import { compile } from '../index.js';

const FIXTURES = join(
  dirname(fileURLToPath(import.meta.url)),
  '../..',
  '__tests__',
  'fixtures',
);

interface RunResult {
  ipo: IpoFile;
  globals: StackEntry[];
}

async function runFixture(name: string): Promise<RunResult> {
  const source = readFileSync(join(FIXTURES, `${name}.ips`), 'utf-8');
  const bytes = compile(source);
  const ipo = parseIpo(bytes);
  const vm = new VM(ipo);
  await vm.run();
  // VM keeps the globals array internally — reach it the same way the
  // existing VM tests do.
  const globals = (vm as unknown as { globals: StackEntry[] }).globals;
  return { ipo, globals };
}

describe('stage 2g — runtime smoke tests', () => {
  it('rt-global-set: literal assignment to an int global', async () => {
    const { globals } = await runFixture('rt-global-set');
    // globals[0] is the implicit void slot, [1] is `answer`.
    expect(globals[1].value).toBe(42);
  });

  it('rt-arithmetic: ALU ADD / SUB / MUL via three globals', async () => {
    const { globals } = await runFixture('rt-arithmetic');
    expect(globals[1].value).toBe(17);  // sum     = 10 + 7
    expect(globals[2].value).toBe(17);  // diff    = 20 - 3
    expect(globals[3].value).toBe(54);  // product = 6 * 9
  });

  it('rt-if-else: takes the true branch when condition holds', async () => {
    const { globals } = await runFixture('rt-if-else');
    expect(globals[1].value).toBe(5);    // input
    expect(globals[2].value).toBe(100);  // output (THEN branch)
  });

  it('rt-while-sum: loop accumulates Σ(1..10) = 55', async () => {
    const { globals } = await runFixture('rt-while-sum');
    expect(globals[1].value).toBe(55);
  });

  it('rt-out-param: callee writes through an out: ref to caller global', async () => {
    const { globals } = await runFixture('rt-out-param');
    expect(globals[1].value).toBe(99); // target
  });

  it('rt-inout-param: three bumps mutate the global through inout: ref', async () => {
    const { globals } = await runFixture('rt-inout-param');
    expect(globals[1].value).toBe(13); // 10 + 3 bumps
  });

  it('rt-globals-init: global initialisers are emitted in __inpa_startup__', async () => {
    // `int answer = 42;` and `string greeting = "hello";` get compiled
    // into LOAD CONST / PUSHR GLOBAL / MOVE triples at the head of
    // __inpa_startup__, mirroring real INPACOMP (see
    // disasm/startus.txt ~0x20EE for the analogous prologue).
    const { globals } = await runFixture('rt-globals-init');
    expect(globals[1].value).toBe(42);
    expect(globals[2].value).toBe('hello');
  });
});
