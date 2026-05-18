/**
 * Browser-side `external` provider — backs INPA's `viewopen` / `viewclose`
 * with a Svelte-reactive modal instead of spawning a Windows text viewer.
 *
 * The script writes a report to a virtual filename via `writeFile()`
 * (typically driven from a `fs:complete` listener on the Ediabas
 * provider) and then calls `viewopen(name, title)`. We look the file up
 * and expose it through reactive `$state` for `ViewerDialog.svelte` to
 * render. `viewClose` clears the state.
 *
 * The other surface methods (`winHelp`, `winHelpKey`, `callWin`) stay
 * no-ops — there's no shell-execute in the browser, and original INPA
 * uses them only for context-help / launching external tools.
 */
// Svelte's `.svelte.ts` module parser is JS-only — it rejects
// `interface` declarations and the `type` keyword in import
// specifiers. `ViewerState` lives in a sibling regular `.ts` file;
// imports use plain `import { X }` (TS elides the type-only ones
// since `verbatimModuleSyntax` is off in this package).
import { IExternalProvider } from "@emdzej/inpax-interfaces";
import { ViewerState } from "./browser-external-types.js";

export class BrowserExternalProvider implements IExternalProvider {
  private files = new Map<string, string>();
  // Public reactive snapshot — components read it directly. `null`
  // means "no viewer is open".
  viewer = $state<ViewerState | null>(null);

  winHelp(_helpFile: string): void {}
  winHelpKey(_helpFile: string, _key: string): void {}
  callWin(_cmdLine: string): void {}

  /** Populate a virtual file. Caller controls the lifetime. */
  writeFile(fileName: string, content: string): void {
    this.files.set(fileName, content);
  }

  viewOpen(fileName: string, title: string): void {
    const content = this.files.get(fileName) ?? `[no content for ${fileName}]`;
    this.viewer = { fileName, title, content };
  }

  viewClose(): void {
    this.viewer = null;
  }
}
