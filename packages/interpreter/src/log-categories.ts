/**
 * Logger-category catalogue for the inpax subsystem.
 *
 * Consumer apps (inpax-web Settings, future ncsx-web that bundles
 * inpax) iterate this array to build per-category controls without
 * hardcoding category names. Hints surface as tooltips / sublabels.
 *
 * Add an entry here whenever a new `getLogger("INPAX.*")` call site
 * lands that's worth exposing to end users. Internal-only categories
 * (test fixtures, dev scripts) stay out — they'd just clutter the
 * Settings UI.
 *
 * The hint must be one sentence; longer copy belongs in docs.
 */

import type { LogCategory } from "@emdzej/bimmerz-logger";

export const LOG_CATEGORIES: readonly LogCategory[] = [
  {
    name: "INPAX",
    hint: "Catch-all for the inpax subsystem — overrides any unmatched subtree below.",
  },
  {
    name: "INPAX.vm",
    hint: "VM dispatch loop — opcode fetch / decode / execute.",
  },
  {
    name: "INPAX.dispatcher",
    hint: "System-function dispatcher (the table of CALLE syscalls).",
  },
  {
    name: "INPAX.internal-functions",
    hint: "IPO-side internal helpers (string ops, math, etc.).",
  },
  {
    name: "INPAX.main-scheduler",
    hint: "Top-level scheduler — inpainit / SCREEN / MENU lifecycle.",
  },
  {
    name: "INPAX.screen-executor",
    hint: "SCREEN block execution + cell-grid paints.",
  },
  {
    name: "INPAX.state-machine-executor",
    hint: "State-machine opcode block evaluator.",
  },
  {
    name: "INPAX.signature-handler",
    hint: "Function-signature resolution (FFI descriptors, callee binding).",
  },
  {
    name: "INPAX.ui-provider",
    hint: "UI provider — terminal TUI / web canvas / mock rendering decisions.",
  },
  {
    name: "INPAX.interpreter-cli",
    hint: "CLI-side interpreter wrapper — config + invocation glue.",
  },
];
