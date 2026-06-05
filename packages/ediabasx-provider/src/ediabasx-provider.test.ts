/**
 * Provider binding tests. Cover the INPA → IEdiabas glue layer only —
 * the underlying `@emdzej/ediabasx-client` / `@emdzej/ediabasx-ediabas`
 * runtime is faked so the suite stays fast and deterministic. The real
 * packages have their own VM-level tests for opcode semantics and
 * client/server lifecycle.
 *
 * The provider is now `IEdiabas`-only (no more `Ediabas` direct
 * coupling). All tests construct the provider with `{ instance: fake }`
 * where `fake` implements the IEdiabas surface; SGBD lookup happens
 * inside the IEdiabas, so the provider no longer makes separate
 * `loadSgbd` calls — the per-ECU caching tests that used to check that
 * are gone (moved to ediabasx's own test suites for EmbeddedEdiabas).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import type {
  EdiabasJobResponse,
  EdiabasResultEntry,
  EdiabasResultSet,
  EdiabasResultType,
  EdiabasState,
  IEdiabas,
} from '@emdzej/ediabasx-core';
import type { EdiabasJobResult } from '@emdzej/ediabasx-ediabas';
import { EdiabasXProvider } from './ediabasx-provider.js';

/**
 * Controllable IEdiabas stand-in. Tests pre-seed `nextDataSets`
 * (the bytecode-emitted data sets) and `systemResults` (the system
 * set at sets[0]); `job()` assembles them into an `EdiabasJobResponse`
 * matching what `EmbeddedEdiabas` / `EdiabasClient` would return.
 *
 * Tracks call-shapes the tests assert on:
 *   • `initCalls` / `endCalls` — lifecycle counters
 *   • `jobCalls` — `{ ecu, jobName, params }` per call; params is
 *     the raw string (semi-colon delimited per INPA convention), the
 *     exact shape `IEdiabas.job(ecu, name, params?)` expects.
 */
class FakeIEdiabas implements IEdiabas {
  initCalls = 0;
  endCalls = 0;
  jobCalls: Array<{ ecu: string; jobName: string; params: string | undefined }> = [];
  nextDataSets: EdiabasJobResult[][] = [];
  nextError: Error | null = null;
  /* System set entries — keyed by uppercase name, materialised into
     sets[0] of the EdiabasJobResponse on every job() call. Mirrors
     Ediabas.buildSystemSet's output without re-implementing it. */
  systemResults: Map<string, EdiabasJobResult> = new Map();

  async init(): Promise<void> {
    this.initCalls++;
  }
  async end(): Promise<void> {
    this.endCalls++;
  }
  async job(ecu: string, jobName: string, params?: string): Promise<EdiabasJobResponse> {
    this.jobCalls.push({ ecu, jobName, params });
    if (this.nextError) {
      const err = this.nextError;
      this.nextError = null;
      throw err;
    }
    const dataSets = this.nextDataSets;
    this.nextDataSets = [];

    /* Materialise the IEdiabas response shape: sets[0] = system set,
       sets[1..N] = data sets. Same shape EmbeddedEdiabas /
       EdiabasClient produce. */
    const systemSet: EdiabasResultSet = {};
    for (const [, entry] of this.systemResults) {
      systemSet[entry.name] = jobResultToEntry(entry);
    }
    /* Seed the always-present fields so the provider's set=0 lookups
       for JOBNAME / SAETZE / VARIANTE work like they would against
       real ediabasx. */
    if (!systemSet.JOBNAME) {
      systemSet.JOBNAME = { name: 'JOBNAME', type: 'text', value: jobName };
    }
    if (!systemSet.SAETZE) {
      systemSet.SAETZE = { name: 'SAETZE', type: 'integer', value: dataSets.length };
    }
    return {
      sets: [
        systemSet,
        ...dataSets.map((set): EdiabasResultSet => {
          const obj: EdiabasResultSet = {};
          for (const r of set) obj[r.name] = jobResultToEntry(r);
          return obj;
        }),
      ],
    };
  }

  /* IEdiabas surface stubs — the provider doesn't invoke these on the
     underlying instance (it has its own accessors built on
     lastResults / systemResults), so trivial defaults suffice. */
  resultSets(): number { return 0; }
  resultText(): string { return ''; }
  resultInt(): number { return 0; }
  resultReal(): number { return 0; }
  resultBinary(): number[] { return []; }
  resultFormat(): EdiabasResultType | undefined { return undefined; }
  state(): EdiabasState { return 'ready'; }
  async break(): Promise<void> {}
  errorCode(): number { return 0; }
  errorText(): string { return ''; }
}

function jobResultToEntry(r: EdiabasJobResult): EdiabasResultEntry {
  const entry: EdiabasResultEntry = {
    name: r.name,
    type: localTypeToWire(r.type),
    value: r.value instanceof Uint8Array ? Array.from(r.value) : (r.value as EdiabasResultEntry['value']),
  };
  if (r.unit !== undefined) entry.unit = r.unit;
  if (r.comment !== undefined) entry.comment = r.comment;
  return entry;
}

function localTypeToWire(type: EdiabasJobResult['type']): EdiabasResultEntry['type'] {
  switch (type) {
    case 'int': return 'integer';
    case 'string': return 'text';
    default: return type as EdiabasResultEntry['type'];
  }
}

function makeResult(
  name: string,
  type: EdiabasJobResult['type'],
  value: unknown,
): EdiabasJobResult {
  return { name, type, value: value as EdiabasJobResult['value'] };
}

describe('EdiabasXProvider', () => {
  let fake: FakeIEdiabas;
  beforeEach(() => {
    fake = new FakeIEdiabas();
  });

  describe('lifecycle', () => {
    it('init() calls underlying IEdiabas.init() when autoConnect is the default (true)', async () => {
      const p = new EdiabasXProvider({ instance: fake });
      const restored = vi.fn();
      p.on('connection:restored', restored);
      await p.init();
      expect(fake.initCalls).toBe(1);
      expect(restored).toHaveBeenCalledTimes(1);
    });

    it('init() skips IEdiabas.init() when autoConnect=false', async () => {
      const p = new EdiabasXProvider({ instance: fake, autoConnect: false });
      await p.init();
      expect(fake.initCalls).toBe(0);
    });

    it('end() detaches without tearing down the underlying IEdiabas', async () => {
      /* The IEdiabas is owned by the caller (e.g. inpax's
         connection.svelte.ts which manages a per-session
         EdiabasClient over a Bimmerz Connect relay). The provider's
         end() must NOT call IEdiabas.end() — doing so would close
         the shared WebSocket and break the next runtime mount that
         tries to reuse the connection. */
      const p = new EdiabasXProvider({ instance: fake, autoConnect: false });
      const lost = vi.fn();
      p.on('connection:lost', lost);
      await p.init();
      await p.end();
      expect(fake.endCalls).toBe(0);
      expect(lost).toHaveBeenCalledTimes(1);
      expect(p.resultSets()).toBe(0);
      expect(p.checkJobStatus('OKAY')).toBe(false);
    });

    it('end() is idempotent', async () => {
      const p = new EdiabasXProvider({ instance: fake, autoConnect: false });
      await p.init();
      await p.end();
      await p.end();
      expect(fake.endCalls).toBe(0);
    });
  });

  describe('job() — INPA → IEdiabas mapping', () => {
    it('forwards arg1 verbatim as the params string (no client-side split)', async () => {
      /* INPA's `apiJob(ECU, JOB, PARAMS, RESULTS)` already passes
         PARAMS as a semicolon-delimited string; IEdiabas.job's
         third arg accepts that exact shape. EmbeddedEdiabas /
         EdiabasClient split internally — provider doesn't. */
      const p = new EdiabasXProvider({ instance: fake, autoConnect: false });
      await p.init();
      await p.job('DME', 'READ_DATA', 'foo', 'bar');
      expect(fake.jobCalls).toEqual([
        { ecu: 'DME', jobName: 'READ_DATA', params: 'foo' },
      ]);
    });

    it('passes multi-param strings through unchanged (RESULTS / arg2 dropped)', async () => {
      const p = new EdiabasXProvider({ instance: fake, autoConnect: false });
      await p.init();
      await p.job('KOMBI46R', 'STEUERN_LEUCHTE', '0xFF;0xFF;0xFF;0xFF;0xFF;0xFF', '');
      expect(fake.jobCalls).toEqual([
        {
          ecu: 'KOMBI46R',
          jobName: 'STEUERN_LEUCHTE',
          params: '0xFF;0xFF;0xFF;0xFF;0xFF;0xFF',
        },
      ]);
    });

    it('passes undefined for empty arg1 (no phantom par(0) = "")', async () => {
      const p = new EdiabasXProvider({ instance: fake, autoConnect: false });
      await p.init();
      await p.job('DME', 'IDENT', '', '');
      expect(fake.jobCalls).toEqual([
        { ecu: 'DME', jobName: 'IDENT', params: undefined },
      ]);
    });

    it('emits job:complete with the data-set count (system set at index 0 is not counted)', async () => {
      const p = new EdiabasXProvider({ instance: fake, autoConnect: false });
      const complete = vi.fn();
      p.on('job:complete', complete);
      fake.nextDataSets = [
        [makeResult('F_ORT_NR', 'int', 215)],
        [makeResult('F_ORT_NR', 'int', 152)],
        [makeResult('F_ORT_NR', 'int', 112)],
      ];
      await p.init();
      await p.job('DME', 'FS_LESEN', '', '');
      expect(complete).toHaveBeenCalledWith({ ecu: 'DME', job: 'FS_LESEN', sets: 3 });
    });

    it('emits job:error when not initialised', async () => {
      const p = new EdiabasXProvider({ instance: fake, autoConnect: false });
      const error = vi.fn();
      p.on('job:error', error);
      await p.job('DME', 'IDENT', '', '');
      expect(error).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('Not initialized'),
      }));
    });

    it('emits job:error when the underlying call throws', async () => {
      const p = new EdiabasXProvider({ instance: fake, autoConnect: false });
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
      const p = new EdiabasXProvider({ instance: fake, autoConnect: false });
      await p.init();
      expect(p.resultSets()).toBe(0);
    });

    it('returns N data sets for multi-record jobs (sets[0] system set excluded)', async () => {
      const p = new EdiabasXProvider({ instance: fake, autoConnect: false });
      await p.init();
      fake.nextDataSets = [
        [makeResult('F_ORT_NR', 'int', 215)],
        [makeResult('F_ORT_NR', 'int', 152)],
        [makeResult('F_ORT_NR', 'int', 112)],
      ];
      await p.job('DME', 'FS_LESEN', '', '');
      expect(p.resultSets()).toBe(3);
    });
  });

  describe('result lookups — indexing', () => {
    it('uses 1-based set indexing on DATA sets (preserved across the sets[0] slice)', async () => {
      const p = new EdiabasXProvider({ instance: fake, autoConnect: false });
      await p.init();
      fake.nextDataSets = [
        [makeResult('CODE', 'int', 1)],
        [makeResult('CODE', 'int', 2)],
        [makeResult('CODE', 'int', 3)],
      ];
      await p.job('DME', 'FS_LESEN', '', '');
      expect(p.resultInt('CODE', 1)).toBe(1);
      expect(p.resultInt('CODE', 2)).toBe(2);
      expect(p.resultInt('CODE', 3)).toBe(3);
    });

    it('set=0 falls through to systemResults (native EDIABAS metadata idiom)', async () => {
      const p = new EdiabasXProvider({ instance: fake, autoConnect: false });
      await p.init();
      fake.systemResults.set('VARIANTE', makeResult('VARIANTE', 'string', 'KOMBI46R'));
      fake.nextDataSets = [[makeResult('SOMETHING', 'int', 1)]];
      await p.job('DME', 'IDENT', '', '');
      expect(p.resultText('VARIANTE', 0, '')).toBe('KOMBI46R');
    });

    it('out-of-range set falls back to systemResults', async () => {
      const p = new EdiabasXProvider({ instance: fake, autoConnect: false });
      await p.init();
      fake.systemResults.set('ECU', makeResult('ECU', 'string', 'KOMBI E46'));
      fake.nextDataSets = [[makeResult('A', 'int', 42)]];
      await p.job('DME', 'IDENT', '', '');
      expect(p.resultText('ECU', 99, '')).toBe('KOMBI E46');
    });

    it('matches names case-insensitively', async () => {
      const p = new EdiabasXProvider({ instance: fake, autoConnect: false });
      await p.init();
      fake.nextDataSets = [[makeResult('Job_Status', 'string', 'OKAY')]];
      await p.job('DME', 'IDENT', '', '');
      expect(p.resultText('job_status', 1, '')).toBe('OKAY');
      expect(p.resultText('JOB_STATUS', 1, '')).toBe('OKAY');
    });

    it('returns sensible defaults for missing names', async () => {
      const p = new EdiabasXProvider({ instance: fake, autoConnect: false });
      await p.init();
      fake.nextDataSets = [[makeResult('A', 'int', 42)]];
      await p.job('DME', 'IDENT', '', '');
      expect(p.resultInt('MISSING', 1)).toBe(0);
      expect(p.resultText('MISSING', 1, '')).toBe('');
      expect(p.resultAnalog('MISSING', 1)).toBe(0);
      expect(p.resultDigital('MISSING', 1)).toBe(false);
      expect(p.resultBinary('MISSING', 1)).toEqual(new Uint8Array());
    });
  });

  describe('resultText() — format spec', () => {
    let p: InstanceType<typeof EdiabasXProvider>;
    beforeEach(async () => {
      p = new EdiabasXProvider({ instance: fake, autoConnect: false });
      await p.init();
    });

    async function loadValue(name: string, value: EdiabasJobResult['value']): Promise<void> {
      fake.nextDataSets = [[makeResult(name, 'real', value)]];
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
      fake.nextDataSets = [[makeResult('S', 'string', 'hello')]];
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
      p = new EdiabasXProvider({ instance: fake, autoConnect: false });
      await p.init();
    });

    async function loadValue(value: unknown): Promise<void> {
      fake.nextDataSets = [[makeResult('X', 'real', value)]];
      await p.job('DME', 'IDENT', '', '');
    }

    it('truncates toward zero for positive floats', async () => {
      await loadValue(1.9);
      expect(p.resultInt('X', 1)).toBe(1);
    });

    it('truncates toward zero for negative floats (not floor)', async () => {
      await loadValue(-1.5);
      expect(p.resultInt('X', 1)).toBe(-1);
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
      p = new EdiabasXProvider({ instance: fake, autoConnect: false });
      await p.init();
    });

    it('passes through numeric values', async () => {
      fake.nextDataSets = [[makeResult('V', 'real', 13.42)]];
      await p.job('DME', 'IDENT', '', '');
      expect(p.resultAnalog('V', 1)).toBe(13.42);
    });

    it('parses numeric strings via parseFloat', async () => {
      fake.nextDataSets = [[makeResult('V', 'string', '13.42 V')]];
      await p.job('DME', 'IDENT', '', '');
      expect(p.resultAnalog('V', 1)).toBe(13.42);
    });

    it('returns 0 for unparseable strings', async () => {
      fake.nextDataSets = [[makeResult('V', 'string', 'n/a')]];
      await p.job('DME', 'IDENT', '', '');
      expect(p.resultAnalog('V', 1)).toBe(0);
    });
  });

  describe('resultBinary()', () => {
    let p: InstanceType<typeof EdiabasXProvider>;
    beforeEach(async () => {
      p = new EdiabasXProvider({ instance: fake, autoConnect: false });
      await p.init();
    });

    it('passes Uint8Array through (converted via wire round-trip)', async () => {
      const bytes = new Uint8Array([0x12, 0x34, 0x56]);
      fake.nextDataSets = [[makeResult('B', 'binary', bytes)]];
      await p.job('DME', 'IDENT', '', '');
      expect(Array.from(p.resultBinary('B', 1))).toEqual([0x12, 0x34, 0x56]);
    });

    it('encodes string values as UTF-8 bytes', async () => {
      fake.nextDataSets = [[makeResult('B', 'string', 'AB')]];
      await p.job('DME', 'IDENT', '', '');
      expect(Array.from(p.resultBinary('B', 1))).toEqual([0x41, 0x42]);
    });
  });

  describe('resultDigital()', () => {
    let p: InstanceType<typeof EdiabasXProvider>;
    beforeEach(async () => {
      p = new EdiabasXProvider({ instance: fake, autoConnect: false });
      await p.init();
    });

    async function loadValue(value: unknown): Promise<void> {
      fake.nextDataSets = [[makeResult('FLAG', 'string', value)]];
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
      p = new EdiabasXProvider({ instance: fake, autoConnect: false });
      await p.init();
    });

    it('returns false before any job runs', () => {
      expect(p.checkJobStatus('OKAY')).toBe(false);
    });

    it('matches when the system set carries JOB_STATUS = ref', async () => {
      /* In the IEdiabas-shape world, JOB_STATUS lives on sets[0]
         (the system set), populated by `Ediabas.buildSystemSet`
         from the persistent accumulator. The fake mirrors that:
         systemResults entries land at sets[0]. */
      fake.systemResults.set('JOB_STATUS', makeResult('JOB_STATUS', 'string', 'OKAY'));
      await p.job('DME', 'IDENT', '', '');
      expect(p.checkJobStatus('OKAY')).toBe(true);
      expect(p.checkJobStatus('ERROR')).toBe(false);
    });

    it('resets when a subsequent job clears the system JOB_STATUS', async () => {
      fake.systemResults.set('JOB_STATUS', makeResult('JOB_STATUS', 'string', 'OKAY'));
      await p.job('DME', 'IDENT', '', '');
      expect(p.checkJobStatus('OKAY')).toBe(true);
      /* Next job runs with no JOB_STATUS in the system set — the
         provider's per-job snapshot replaces the previous one. */
      fake.systemResults.delete('JOB_STATUS');
      await p.job('DME', 'OTHER_JOB', '', '');
      expect(p.checkJobStatus('OKAY')).toBe(false);
    });
  });

  describe('fault storage', () => {
    it('fsLesen() runs the configured job and emits fs:complete', async () => {
      const p = new EdiabasXProvider({ instance: fake, autoConnect: false });
      await p.init();
      const fsComplete = vi.fn();
      p.on('fs:complete', fsComplete);
      fake.nextDataSets = [
        [makeResult('F_ORT_NR', 'int', 1)],
        [makeResult('F_ORT_NR', 'int', 2)],
      ];
      await p.fsLesen('DME', '/tmp/faults.log');
      expect(fake.jobCalls).toEqual([
        { ecu: 'DME', jobName: 'FS_LESEN', params: '/tmp/faults.log' },
      ]);
      expect(fsComplete).toHaveBeenCalledWith({
        ecu: 'DME',
        fileName: '/tmp/faults.log',
        faultCount: 2,
      });
    });

    it('fsMode() overrides the job name used by fsLesen', async () => {
      const p = new EdiabasXProvider({ instance: fake, autoConnect: false });
      await p.init();
      p.fsMode(1, '', '', '', 'FS_LESEN_DETAIL');
      await p.fsLesen('DME', '/tmp/faults.log');
      expect(fake.jobCalls[0].jobName).toBe('FS_LESEN_DETAIL');
    });

    it('fsMode() with empty jobName falls back to FS_LESEN', async () => {
      const p = new EdiabasXProvider({ instance: fake, autoConnect: false });
      await p.init();
      p.fsMode(1, '', '', '', 'CUSTOM');
      p.fsMode(0, '', '', '', '');
      await p.fsLesen('DME', '');
      expect(fake.jobCalls[0].jobName).toBe('FS_LESEN');
    });

    it('fsLesen2() delegates to fsLesen', async () => {
      const p = new EdiabasXProvider({ instance: fake, autoConnect: false });
      await p.init();
      await p.fsLesen2('DME', '/tmp/x');
      expect(fake.jobCalls).toEqual([
        { ecu: 'DME', jobName: 'FS_LESEN', params: '/tmp/x' },
      ]);
    });
  });
});
