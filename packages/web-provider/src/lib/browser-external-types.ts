/**
 * Type-only declarations for `BrowserExternalProvider`.
 *
 * Lives in a regular `.ts` file (not `.svelte.ts`) because Svelte's
 * module parser doesn't accept TypeScript-specific syntax like
 * `interface` declarations. The class itself stays in
 * `browser-external.svelte.ts` so it can use `$state` for the
 * reactive viewer slot.
 */

export interface ViewerState {
  fileName: string;
  title: string;
  content: string;
}
