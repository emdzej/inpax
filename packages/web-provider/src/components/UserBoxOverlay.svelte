<script lang="ts">
  /**
   * Visual layer for `userboxopen` / `userboxftextout` / `userboxclose`.
   *
   * The provider stores user boxes in `state.userBoxes` (Map<boxNum,
   * UserBox>). Scripts use them as progress dialogs during long jobs
   * (e.g. "Fehlerspeicher lesen" while INPAapiFsLesen runs). Without
   * rendering them here those operations look like nothing is
   * happening at all.
   *
   * Positioning: INPA scripts pass `(row, col, height, width)` in the
   * original DOS terminal grid (80×25-ish), but our canvas is
   * letterboxed inside its parent container by aspect-ratio math —
   * mapping grid percentages onto the container puts the box in the
   * wrong physical area. Real INPA uses these progress boxes as
   * centered modals during long jobs, so we just centre them and use
   * the script's width as a relative hint (clamped sensibly).
   */

  import type { UIProvider, UserBox } from "@emdzej/inpax-ui-provider-core";
  import { paletteColor } from "../lib/theme.js";
  import { getLibTheme } from "../lib/theme-context.svelte.js";

  type Props = { ui: UIProvider };
  const { ui }: Props = $props();

  // Active palette comes from the lib theme context — see
  // `ScreenCanvas` for the contract. The host installs the theme once
  // at the root via `setLibTheme(...)`; this `$derived` picks up the
  // current value reactively.
  const theme = $derived(getLibTheme());

  let boxes = $state<UserBox[]>([]);

  $effect(() => {
    const provider = ui;
    const refresh = () => {
      boxes = Array.from(provider.getUserBoxes().values()).filter((b) => b.visible);
    };
    refresh();
    return provider.onStateChange(refresh);
  });

  function boxStyle(box: UserBox): string {
    const fg = paletteColor(theme, box.fg);
    const bg = paletteColor(theme, box.bg);
    return [`color:${fg}`, `background:${bg}`].join(";");
  }
</script>

{#if boxes.length > 0}
  <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
    {#each boxes as box (box.boxNum)}
      <div
        class="flex min-w-[20rem] max-w-[80%] flex-col rounded border border-rule shadow-lg"
        style={boxStyle(box)}
      >
        {#if box.title}
          <header class="border-b border-rule px-2 py-1 text-xs font-semibold">
            {box.title}
          </header>
        {/if}
        <div class="relative flex-1 overflow-hidden p-2 font-mono text-xs">
          {#each box.lines as line, i (i)}
            <div>{line.text}</div>
          {/each}
        </div>
      </div>
    {/each}
  </div>
{/if}
