import pino from "pino";

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "silent";

export interface LoggerOptions {
  level?: LogLevel;
  name?: string;
  pretty?: boolean;
  destination?: string; // File path for TUI mode
}

// Env-driven defaults are Node-side conveniences; in a browser bundle
// `process` may not exist (or be a stub without `env`). Guard so this
// module imports cleanly in any host.
const envLevel =
  typeof process !== "undefined" && process.env?.INPAX_LOG_LEVEL
    ? (process.env.INPAX_LOG_LEVEL as LogLevel)
    : undefined;
const envIsProd =
  typeof process !== "undefined" && process.env?.NODE_ENV === "production";
const defaultLevel: LogLevel = envLevel ?? "info";
const isPretty = !envIsProd;

export function createLogger(options: LoggerOptions = {}): pino.Logger {
  const level = options.level ?? defaultLevel;

  const transport = options.destination
    ? { target: "pino/file", options: { destination: options.destination } }
    : options.pretty ?? isPretty
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined;

  return pino({
    level,
    name: options.name,
    transport,
  });
}

// Root logger
export const logger = createLogger({ name: "inpax" });

// Child logger factory
export function getLogger(module: string): pino.Logger {
  return logger.child({ module });
}

export type { Logger } from "pino";
