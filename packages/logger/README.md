# @emdzej/inpax-logger

Pino-backed structured logger for the INPAX workspace. Wraps `pino`
with a tiny adapter so every package writes through the same
namespaced logger, with log level controlled by `INPAX_LOG_LEVEL`.

## Usage

```typescript
import { getLogger } from "@emdzej/inpax-logger";

const log = getLogger("interpreter");

log.info("VM started");
log.warn({ pc: 42, opcode: 0x07 }, "Unknown opcode");
log.error({ err }, "Bytecode decode failed");
```

## Log levels

Controlled by the `INPAX_LOG_LEVEL` environment variable, with the
usual pino levels:

| Level | Use for |
|---|---|
| `trace` | Per-instruction VM traces |
| `debug` | Per-syscall, per-tick |
| `info` | Lifecycle events (mount, swap) |
| `warn` | Recoverable issues |
| `error` | Unrecoverable failures |
| `silent` | Tests |

Default level is `info`. In the browser the logger writes through
`pino`'s browser transport (which routes to `console.*`); the env
var still applies if injected at build time via Vite's `define`.

## Namespaces

Every consumer calls `getLogger(name)` once at module scope. The name
appears as a `pkg:` field on every record, so DevTools / log
aggregation can filter by package without parsing the message:

```typescript
const log = getLogger("interpreter");        // pkg: "interpreter"
const log = getLogger("ediabasx-provider");  // pkg: "ediabasx-provider"
```

## See also

- [`pino`](https://github.com/pinojs/pino) — the underlying logger.
