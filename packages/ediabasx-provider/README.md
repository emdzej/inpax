# @emdzej/inpax-ediabasx-provider

EdiabasX provider for the INPA interpreter. Binds the 13 `INPAapi*` system functions to [`@emdzej/ediabasx-ediabas`](https://www.npmjs.com/package/@emdzej/ediabasx-ediabas) so INPA scripts run against real BMW ECUs (or its simulation transport).

## Installation

```bash
npm install @emdzej/inpax-ediabasx-provider
```

`@emdzej/ediabasx-ediabas` is a runtime dependency and gets pulled in automatically.

## Usage

```typescript
import { EdiabasXProvider } from '@emdzej/inpax-ediabasx-provider';

// Load from an `ediabas.config.json` (interface + ecu path + timeouts).
const provider = new EdiabasXProvider({
  configFile: './ediabas.config.json',
});

// Or pass an EdiabasX config directly.
const provider = new EdiabasXProvider({
  config: {
    ecuPath: './ecu',
    simulation: false,
  },
});

await provider.init();              // connects according to the config

await provider.job('D_MOTOR', 'IDENT', '', '');
const sets = provider.resultSets();
const ecu  = provider.resultText('ECU', 1, '');
const ok   = provider.checkJobStatus('OKAY');

await provider.end();
```

## INPA → EdiabasX bindings

The provider implements every method `@emdzej/inpax-interfaces`'s `IEdiabasProvider` requires, mapped to the EdiabasX `Ediabas` class as follows:

| INPA system function | EdiabasX call |
|---|---|
| `INPAapiInit` | `new Ediabas(...)` / `createFromConfigFile(...)` + `connect()` |
| `INPAapiEnd` | `disconnect()` |
| `INPAapiJob(ecu, job, arg1, arg2)` | `loadSgbd(<ecu>.prg)` (cached) + `executeJob(job, { params: [arg1, arg2] })` |
| `INPAapiResultSets` | length of the last `executeJob` set array |
| `INPAapiResultText(name, set, format)` | result by `name` from the 1-based `set`; `format` honoured for numeric values via a `printf`-compatible subset (`%d %i %u %o %x %X %f %e %g`) |
| `INPAapiResultInt(name, set)` | C-style truncation toward zero |
| `INPAapiResultAnalog(name, set)` | float; parses strings via `parseFloat` |
| `INPAapiResultBinary(name, set)` | passes `Uint8Array` through; strings encoded as UTF-8 bytes |
| `INPAapiResultDigital(name, set)` | true for `1`, `"true"`, `"1"`, `"OKAY"`, `"JA"`, `"YES"` |
| `INPAapiCheckJobStatus(ref)` | compares against the captured `JOB_STATUS` system result from the most recent job |
| `INPAapiFsLesen(ecu, fileName)` | runs the configured fault-storage job (default `FS_LESEN`), emits `fs:complete` with the multi-set count |
| `INPAapiFsLesen2(ecu, fileName)` | alias for `FsLesen` |
| `INPAapiFsMode(mode, fileMode, preInfo, postInfo, jobName)` | overrides the configured fault-storage job name |

Multi-set results (e.g. `FS_LESEN` with N fault records emitted via the BEST2 `enewset` opcode, one set per record) are preserved — `resultSets()` returns N and `result*(name, k)` reads from the k-th record (1-based).

## Configuration

### From `ediabas.config.json`

```json
{
  "version": 1,
  "interface": {
    "type": "kdcan",
    "kdcan": {
      "port": "/dev/cu.usbserial-A50285BI",
      "baudRate": 9600,
      "protocol": "isotp"
    }
  },
  "paths": { "sgbd": "./ecu" }
}
```

Loaded via `@emdzej/ediabasx-ediabas/node`'s `createFromConfigFile()`.

### Direct configuration

```typescript
const provider = new EdiabasXProvider({
  config: {
    ecuPath: './ecu',     // directory containing .prg / .grp files
    simulation: false,    // pass true for in-memory canned responses
    timeout: 5000,        // ms
    logging: false,
  },
  autoConnect: true,      // false to defer connect() until first job
});
```

## Events

Mirrors the `EdiabasEvents` map from `@emdzej/inpax-interfaces`:

- `job:complete` — `{ ecu, job, sets }`
- `job:error` — `{ code, message }`
- `fs:complete` — `{ ecu, fileName, faultCount }`
- `connection:lost` / `connection:restored`
- `busy:changed` — `{ busy, inFlight }` — fired every time the in-flight
  async-call counter (init / end / job / fsLesen / fsLesen2)
  transitions. `busy === inFlight > 0`. Pair with `isBusy()` for the
  current snapshot. Used by `@emdzej/inpax-web-provider`'s
  `<EdiabasBusyIndicator />` to drive a background-processing UI signal.

## Requirements

- Node.js 18+
- SGBD/GRP files for the target ECUs in `ecuPath`
- Hardware interface (K-line / K+DCAN / ENET) or simulation mode

## License

MIT
