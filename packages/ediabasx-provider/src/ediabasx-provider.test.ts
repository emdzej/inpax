/**
 * Provider binding tests. These cover the INPA → EdiabasX glue layer
 * only — the underlying @emdzej/ediabasx-ediabas Ediabas class is
 * mocked so the suite stays fast and deterministic. The real package
 * has its own VM-level tests for things like opcode semantics.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import type { EdiabasJobResult } from '@emdzej/ediabasx-ediabas';

// Build a controllable stand-in for the Ediabas class. Each test
// queues result sets via `setNextResult` and asserts on the captured
// calls via `loadCalls` / `jobCalls`.
class FakeEdiabas {
  loadCalls: string[] = [];
  jobCalls: Array<{ name: string; params: string[] }> = [];
  nextResult: EdiabasJobResult[][] = [];
  nextError: Error | null = null;
  connectCalls = 0;
  disconnectCalls = 0;

  async loadSgbd(filename: string): Promise<void> {
    this.loadCalls.push(filename);
  }
  async connect(): Promise<void> {
    this.connectCalls++;
  }
  async disconnect(): Promise<void> {
    this.disconnectCalls++;
  }
  async executeJob(
    jobName: string,
    options?: { params?: string[]; timeout?: number }
  ): Promise<EdiabasJobResult[][]> {
    this.jobCalls.push({ name: jobName, params: options?.params ?? [] });
    if (this.nextError) {
      const err = this.nextError;
      this.nextError = null;
      throw err;
    }
    const result = this.nextResult;
    this.nextResult = [];
    return result;
  }
}

// Module-level singleton the mock factory hands back. Tests reset it
// between runs via `beforeEach`.
let fake = new FakeEdiabas();

vi.mock('@emdzej/ediabasx-ediabas', () => ({
  // The provider does `new Ediabas(...)`; return the singleton so the
  // test can poke at it. The factory takes the constructor config as
  // its arg but the binding layer doesn't care what's inside it.
  Ediabas: vi.fn().mockImplementation(() => fake),
}));

// `/node` is dynamic-imported only when configFile is supplied. Mock
// it too so the config-file branch is testable without touching the
// filesystem.
vi.mock('@emdzej/ediabasx-ediabas/node', () => ({
  createFromConfigFile: vi.fn(async () => fake),
}));

// Pull the provider under test AFTER the mocks register so it picks
// up the mocked module.
const { EdiabasXProvider } = await import('./ediabasx-provider.js');

function makeResult(
  name: string,
  type: EdiabasJobResult['type'],
  value: unknown
): EdiabasJobResult {
  // The published type narrows `value` to `string | number | Uint8Array`,
  // but the provider has defensive branches for `boolean` and other
  // transports' values. Accept `unknown` so tests can exercise those
  // branches without lying to the type system about the public API.
  return { name, type, value: value as EdiabasJobResult['value'] };
}

describe('EdiabasXProvider', () => {
  beforeEach(() => {
    fake = new FakeEdiabas();
    vi.clearAllMocks();
  });

  describe('lifecycle', () => {
    it('init() connects when autoConnect is the default (true)', async () => {
      const p = new EdiabasXProvider({ config: { ecuPath: '.', simulation: true } });
      const restored = vi.fn();
      p.on('connection:restored', restored);
      await p.init();
      expect(fake.connectCalls).toBe(1);
      expect(restored).toHaveBeenCalledTimes(1);
    });

    it('init() skips connect when autoConnect=false', async () => {
      const p = new EdiabasXProvider({ config: { ecuPath: '.', simulation: true }, autoConnect: false });
      await p.init();
      expect(fake.connectCalls).toBe(0);
    });

    it('init() reads from configFile via the /node subpath', async () => {
      const { createFromConfigFile } = await import('@emdzej/ediabasx-ediabas/node');
      const p = new EdiabasXProvider({ configFile: '/tmp/ediabas.config.json', autoConnect: false });
      await p.init();
      expect(createFromConfigFile).toHaveBeenCalledWith('/tmp/ediabas.config.json');
    });

    it('end() disconnects and clears cached state', async () => {
      const p = new EdiabasXProvider({ config: { ecuPath: '.', simulation: true }, autoConnect: false });
      const lost = vi.fn();
      p.on('connection:lost', lost);
      await p.init();
      await p.end();
      expect(fake.disconnectCalls).toBe(1);
      expect(lost).toHaveBeenCalledTimes(1);
      expect(p.resultSets()).toBe(0);
      expect(p.checkJobStatus('OKAY')).toBe(false);
    });

    it('end() is idempotent', async () => {
      const p = new EdiabasXProvider({ config: { ecuPath: '.', simulation: true }, autoConnect: false });
      await p.init();
      await p.end();
      await p.end();
      expect(fake.disconnectCalls).toBe(1);
    });
  });

  describe('job() — SGBD loading', () => {
    it('loads the SGBD on first hit and caches subsequent calls for the same ECU', async () => {
      const p = new EdiabasXProvider({ config: { ecuPath: '.', simulation: true }, autoConnect: false });
      await p.init();
      await p.job('DME', 'IDENT', '', '');
      await p.job('DME', 'STATUS_LESEN', '', '');
      expect(fake.loadCalls).toEqual(['DME.prg']);
    });

    it('reloads when the ECU name changes', async () => {
      const p = new EdiabasXProvider({ config: { ecuPath: '.', simulation: true }, autoConnect: false });
      await p.init();
      await p.job('DME', 'IDENT', '', '');
      await p.job('EGS', 'IDENT', '', '');
      expect(fake.loadCalls).toEqual(['DME.prg', 'EGS.prg']);
    });

    it('keeps explicit .prg and .grp extensions untouched', async () => {
      const p = new EdiabasXProvider({ config: { ecuPath: '.', simulation: true }, autoConnect: false });
      await p.init();
      await p.job('D_0023.GRP', 'IDENT', '', '');
      await p.job('ms430ds0.prg', 'IDENT', '', '');
      expect(fake.loadCalls).toEqual(['D_0023.GRP', 'ms430ds0.prg']);
    });

    it('forwards arg1/arg2 as positional params', async () => {
      const p = new EdiabasXProvider({ config: { ecuPath: '.', simulation: true }, autoConnect: false });
      await p.init();
      await p.job('DME', 'READ_DATA', 'foo', 'bar');
      expect(fake.jobCalls).toEqual([{ name: 'READ_DATA', params: ['foo', 'bar'] }]);
    });

    it('emits job:complete with the multi-set count', async () => {
      const p = new EdiabasXProvider({ config: { ecuPath: '.', simulation: true }, autoConnect: false });
      const complete = vi.fn();
      p.on('job:complete', complete);
      fake.nextResult = [
        [makeResult('JOB_STATUS', 'string', 'OKAY')],
        [makeResult('F_ORT_NR', 'int', 215)],
        [makeResult('F_ORT_NR', 'int', 152)],
      ];
      await p.init();
      await p.job('DME', 'FS_LESEN', '', '');
      expect(complete).toHaveBeenCalledWith({ ecu: 'DME', job: 'FS_LESEN', sets: 3 });
    });

    it('emits job:error when not initialised', async () => {
      const p = new EdiabasXProvider({ config: { ecuPath: '.', simulation: true }, autoConnect: false });
      const error = vi.fn();
      p.on('job:error', error);
      await p.job('DME', 'IDENT', '', '');
      expect(error).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('Not initialized'),
      }));
    });

    it('emits job:error when the underlying call throws', async () => {
      const p = new EdiabasXProvider({ config: { ecuPath: '.', simulation: true }, autoConnect: false });
      await p.init();
      const error = vi.fn();
      p.on('job:error', error);
      fake.nextError = new Error('comm timeout');
      await p.job('DME', 'IDENT', '', '');
      expect(error).toHaveBeenCalledWith({ code: -1, message: 'comm timeout' });
    });
  });

  describe('resultSets()', () => {
    it('returns 0 before any job has run', async () => {
      const p = new EdiabasXProvider({ config: { ecuPath: '.', simulation: true }, autoConnect: false });
      await p.init();
      expect(p.resultSets()).toBe(0);
    });

    it('preserves N sets for multi-record jobs', async () => {
      // FS_LESEN-style: one set per fault record.
      const p = new EdiabasXProvider({ config: { ecuPath: '.', simulation: true }, autoConnect: false });
      await p.init();
      fake.nextResult = [
        [makeResult('F_ORT_NR', 'int', 215)],
        [makeResult('F_ORT_NR', 'int', 152)],
        [makeResult('F_ORT_NR', 'int', 112)],
      ];
      await p.job('DME', 'FS_LESEN', '', '');
      expect(p.resultSets()).toBe(3);
    });
  });

  describe('result lookups — indexing', () => {
    it('uses 1-based set indexing matching the INPA spec', async () => {
      const p = new EdiabasXProvider({ config: { ecuPath: '.', simulation: true }, autoConnect: false });
      await p.init();
      fake.nextResult = [
        [makeResult('CODE', 'int', 1)],
        [makeResult('CODE', 'int', 2)],
        [makeResult('CODE', 'int', 3)],
      ];
      await p.job('DME', 'FS_LESEN', '', '');
      expect(p.resultInt('CODE', 1)).toBe(1);
      expect(p.resultInt('CODE', 2)).toBe(2);
      expect(p.resultInt('CODE', 3)).toBe(3);
    });

    it('matches names case-insensitively', async () => {
      const p = new EdiabasXProvider({ config: { ecuPath: '.', simulation: true }, autoConnect: false });
      await p.init();
      fake.nextResult = [[makeResult('Job_Status', 'string', 'OKAY')]];
      await p.job('DME', 'IDENT', '', '');
      expect(p.resultText('job_status', 1, '')).toBe('OKAY');
      expect(p.resultText('JOB_STATUS', 1, '')).toBe('OKAY');
    });

    it('returns sensible defaults for missing names / out-of-range sets', async () => {
      const p = new EdiabasXProvider({ config: { ecuPath: '.', simulation: true }, autoConnect: false });
      await p.init();
      fake.nextResult = [[makeResult('A', 'int', 42)]];
      await p.job('DME', 'IDENT', '', '');
      expect(p.resultInt('MISSING', 1)).toBe(0);
      expect(p.resultText('MISSING', 1, '')).toBe('');
      expect(p.resultAnalog('MISSING', 1)).toBe(0);
      expect(p.resultDigital('MISSING', 1)).toBe(false);
      expect(p.resultBinary('MISSING', 1)).toEqual(new Uint8Array());
      // out-of-range set
      expect(p.resultInt('A', 2)).toBe(0);
      expect(p.resultInt('A', 0)).toBe(0);
    });
  });

  describe('resultText() — format spec', () => {
    let p: InstanceType<typeof EdiabasXProvider>;
    beforeEach(async () => {
      p = new EdiabasXProvider({ config: { ecuPath: '.', simulation: true }, autoConnect: false });
      await p.init();
    });

    async function loadValue(name: string, value: EdiabasJobResult['value']): Promise<void> {
      fake.nextResult = [[makeResult(name, 'real', value)]];
      await p.job('DME', 'IDENT', '', '');
    }

    it('applies %.2f to floats', async () => {
      await loadValue('VOLT', 13.4567);
      expect(p.resultText('VOLT', 1, '%.2f')).toBe('13.46');
    });

    it('applies %d (truncate toward zero) to numerics', async () => {
      await loadValue('X', 9.9);
      expect(p.resultText('X', 1, '%d')).toBe('9');
      await loadValue('X', -9.9);
      expect(p.resultText('X', 1, '%d')).toBe('-9');
    });

    it('applies %X for uppercase hex', async () => {
      await loadValue('CODE', 255);
      expect(p.resultText('CODE', 1, '%X')).toBe('FF');
      await loadValue('CODE', 0xa0);
      expect(p.resultText('CODE', 1, '0x%02X')).toBe('0xA0');
    });

    it('applies width padding', async () => {
      await loadValue('N', 5);
      expect(p.resultText('N', 1, '%4d')).toBe('   5');
    });

    it('falls back to plain stringification for non-numeric values', async () => {
      fake.nextResult = [[makeResult('S', 'string', 'hello')]];
      await p.job('DME', 'IDENT', '', '');
      expect(p.resultText('S', 1, '%d')).toBe('hello');
    });

    it('falls back to plain stringification when format is empty', async () => {
      await loadValue('VOLT', 13.4);
      expect(p.resultText('VOLT', 1, '')).toBe('13.4');
    });
  });

  describe('resultInt() — C-style truncation', () => {
    let p: InstanceType<typeof EdiabasXProvider>;
    beforeEach(async () => {
      p = new EdiabasXProvider({ config: { ecuPath: '.', simulation: true }, autoConnect: false });
      await p.init();
    });

    async function loadValue(value: unknown): Promise<void> {
      fake.nextResult = [[makeResult('X', 'real', value)]];
      await p.job('DME', 'IDENT', '', '');
    }

    it('truncates toward zero for positive floats', async () => {
      await loadValue(1.9);
      expect(p.resultInt('X', 1)).toBe(1);
    });

    it('truncates toward zero for negative floats (not floor)', async () => {
      await loadValue(-1.5);
      expect(p.resultInt('X', 1)).toBe(-1); // not -2 (Math.floor)
    });

    it('parses numeric strings', async () => {
      await loadValue('42');
      expect(p.resultInt('X', 1)).toBe(42);
    });

    it('returns 0 for unparseable strings', async () => {
      await loadValue('hello');
      expect(p.resultInt('X', 1)).toBe(0);
    });

    it('coerces booleans to 0/1', async () => {
      await loadValue(true);
      expect(p.resultInt('X', 1)).toBe(1);
      await loadValue(false);
      expect(p.resultInt('X', 1)).toBe(0);
    });
  });

  describe('resultAnalog() — float coercion', () => {
    let p: InstanceType<typeof EdiabasXProvider>;
    beforeEach(async () => {
      p = new EdiabasXProvider({ config: { ecuPath: '.', simulation: true }, autoConnect: false });
      await p.init();
    });

    it('passes through numeric values', async () => {
      fake.nextResult = [[makeResult('V', 'real', 13.42)]];
      await p.job('DME', 'IDENT', '', '');
      expect(p.resultAnalog('V', 1)).toBe(13.42);
    });

    it('parses numeric strings via parseFloat', async () => {
      fake.nextResult = [[makeResult('V', 'string', '13.42 V')]];
      await p.job('DME', 'IDENT', '', '');
      expect(p.resultAnalog('V', 1)).toBe(13.42);
    });

    it('returns 0 for unparseable strings', async () => {
      fake.nextResult = [[makeResult('V', 'string', 'n/a')]];
      await p.job('DME', 'IDENT', '', '');
      expect(p.resultAnalog('V', 1)).toBe(0);
    });
  });

  describe('resultBinary()', () => {
    let p: InstanceType<typeof EdiabasXProvider>;
    beforeEach(async () => {
      p = new EdiabasXProvider({ config: { ecuPath: '.', simulation: true }, autoConnect: false });
      await p.init();
    });

    it('passes Uint8Array through unchanged', async () => {
      const bytes = new Uint8Array([0x12, 0x34, 0x56]);
      fake.nextResult = [[makeResult('B', 'binary', bytes)]];
      await p.job('DME', 'IDENT', '', '');
      expect(p.resultBinary('B', 1)).toBe(bytes);
    });

    it('encodes string values as UTF-8 bytes', async () => {
      fake.nextResult = [[makeResult('B', 'string', 'AB')]];
      await p.job('DME', 'IDENT', '', '');
      expect(Array.from(p.resultBinary('B', 1))).toEqual([0x41, 0x42]);
    });
  });

  describe('resultDigital()', () => {
    let p: InstanceType<typeof EdiabasXProvider>;
    beforeEach(async () => {
      p = new EdiabasXProvider({ config: { ecuPath: '.', simulation: true }, autoConnect: false });
      await p.init();
    });

    async function loadValue(value: unknown): Promise<void> {
      fake.nextResult = [[makeResult('FLAG', 'string', value)]];
      await p.job('DME', 'IDENT', '', '');
    }

    it.each([
      [true, true],
      [false, false],
      [1, true],
      [0, false],
      ['true', true],
      ['1', true],
      ['OKAY', true],
      ['JA', true],
      ['yes', true],
      ['false', false],
      ['0', false],
      ['nein', false],
    ])('coerces %s → %s', async (input, expected) => {
      await loadValue(input);
      expect(p.resultDigital('FLAG', 1)).toBe(expected);
    });
  });

  describe('checkJobStatus()', () => {
    let p: InstanceType<typeof EdiabasXProvider>;
    beforeEach(async () => {
      p = new EdiabasXProvider({ config: { ecuPath: '.', simulation: true }, autoConnect: false });
      await p.init();
    });

    it('returns false before any job runs', () => {
      expect(p.checkJobStatus('OKAY')).toBe(false);
    });

    it('matches when the last job emitted JOB_STATUS = ref', async () => {
      fake.nextResult = [[makeResult('JOB_STATUS', 'string', 'OKAY')]];
      await p.job('DME', 'IDENT', '', '');
      expect(p.checkJobStatus('OKAY')).toBe(true);
      expect(p.checkJobStatus('ERROR')).toBe(false);
    });

    it('captures JOB_STATUS from any emitted set (last wins)', async () => {
      fake.nextResult = [
        [makeResult('JOB_STATUS', 'string', 'BUSY')],
        [makeResult('OTHER', 'int', 42)],
        [makeResult('JOB_STATUS', 'string', 'OKAY')], // trailing set wins
      ];
      await p.job('DME', 'FS_LESEN', '', '');
      expect(p.checkJobStatus('OKAY')).toBe(true);
      expect(p.checkJobStatus('BUSY')).toBe(false);
    });

    it('resets JOB_STATUS when a job emits no system result', async () => {
      fake.nextResult = [[makeResult('JOB_STATUS', 'string', 'OKAY')]];
      await p.job('DME', 'IDENT', '', '');
      expect(p.checkJobStatus('OKAY')).toBe(true);
      // Second job emits no JOB_STATUS — checker should no longer match
      // the previous run's value.
      fake.nextResult = [[makeResult('OTHER', 'int', 1)]];
      await p.job('DME', 'OTHER_JOB', '', '');
      expect(p.checkJobStatus('OKAY')).toBe(false);
    });
  });

  describe('fault storage', () => {
    it('fsLesen() runs the configured job and emits fs:complete', async () => {
      const p = new EdiabasXProvider({ config: { ecuPath: '.', simulation: true }, autoConnect: false });
      await p.init();
      const fsComplete = vi.fn();
      p.on('fs:complete', fsComplete);
      fake.nextResult = [[makeResult('JOB_STATUS', 'string', 'OKAY')], [makeResult('F_ORT_NR', 'int', 1)]];
      await p.fsLesen('DME', '/tmp/faults.log');
      expect(fake.jobCalls).toEqual([{ name: 'FS_LESEN', params: ['/tmp/faults.log', ''] }]);
      expect(fsComplete).toHaveBeenCalledWith({ ecu: 'DME', fileName: '/tmp/faults.log', faultCount: 2 });
    });

    it('fsMode() overrides the job name used by fsLesen', async () => {
      const p = new EdiabasXProvider({ config: { ecuPath: '.', simulation: true }, autoConnect: false });
      await p.init();
      p.fsMode(1, '', '', '', 'FS_LESEN_DETAIL');
      await p.fsLesen('DME', '/tmp/faults.log');
      expect(fake.jobCalls[0].name).toBe('FS_LESEN_DETAIL');
    });

    it('fsMode() with empty jobName falls back to FS_LESEN', async () => {
      const p = new EdiabasXProvider({ config: { ecuPath: '.', simulation: true }, autoConnect: false });
      await p.init();
      p.fsMode(1, '', '', '', 'CUSTOM');
      p.fsMode(0, '', '', '', '');
      await p.fsLesen('DME', '');
      expect(fake.jobCalls[0].name).toBe('FS_LESEN');
    });

    it('fsLesen2() delegates to fsLesen', async () => {
      const p = new EdiabasXProvider({ config: { ecuPath: '.', simulation: true }, autoConnect: false });
      await p.init();
      await p.fsLesen2('DME', '/tmp/x');
      expect(fake.jobCalls).toEqual([{ name: 'FS_LESEN', params: ['/tmp/x', ''] }]);
    });
  });
});
