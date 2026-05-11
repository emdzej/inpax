/**
 * Native Import (CALLE) Provider
 *
 * INPA scripts use the BEST2 CALLE opcode (0x0D) to call into Windows
 * DLLs — typically `kernel32::GetPrivateProfileStringA` for INI lookups
 * and `api32.DLL::__apiGetConfig` / `__apiSetConfig` for EDIABAS
 * configuration. The interpreter parses the import signature and
 * routes each call here; the host implements just the imports it needs
 * and lets the rest fall through to a no-op default.
 */

/**
 * Parsed CALLE parameter. Direction reflects the upper/lowercase
 * convention in INPA's signature strings — `s` is an in-string, `S`
 * an out-string ref. `%X` at the tail of the signature is the
 * function's return value, also treated as an out arg.
 */
export interface NativeImportParam {
  direction: 'in' | 'out';
  type: 'string' | 'int' | 'long' | 'real' | 'byte' | 'bool' | 'opaque';
  /** True if this slot is the return value of the C function. */
  isReturn: boolean;
}

export interface NativeImportCall {
  /** Full import name, e.g. "kernel32::GetPrivateProfileStringA". */
  importName: string;
  /** Optional raw signature suffix, e.g. "c.sssSis%I". */
  signature?: string;
  /** Resolved parameter list. */
  params: NativeImportParam[];
  /** Values of the in/inout slots, in declaration order. */
  inputs: unknown[];
}

export interface INativeImportProvider {
  /**
   * Invoke a Windows-style DLL import. Returns an array of out values
   * to be written back through the out-arg refs, in declaration order
   * — provider should emit `undefined` (or skip) for in-only slots.
   * Throwing here surfaces as a runtime error in the script.
   */
  call(invocation: NativeImportCall): unknown[];
}
