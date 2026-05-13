<script lang="ts">
  /**
   * Tiny corner pulse that signals "this screen is refreshing" —
   * shown only when the script set a cyclic screen (i.e. INPA's
   * `setscreen(handle, true)` semantics, captured on the provider as
   * `state.screenCyclic`). Real INPA blinked per-LINE dots on the
   * left margin; we collapse that into a single corner indicator
   * since the question users want answered is "is the data live?"
   * not "did this specific row just refresh?"
   *
   * Animation: a green dot that pulses at ~1Hz. Pure CSS keyframe;
   * no per-frame JS so it doesn't fight the canvas paint loop.
   */

  import type { TuiProvider } from "@emdzej/inpax-tui-provider";

  type Props = { ui: TuiProvider };
  const { ui }: Props = $props();

  let cyclic = $state(false);

  $effect(() => {
    const provider = ui;
    const refresh = () => {
      cyclic = provider.state.screenCyclic === true;
    };
    refresh();
    return provider.onStateChange(refresh);
  });
</script>

{#if cyclic}
  <!-- Just the dot — text label was visual noise since cyclic is
       the default for nearly every BMW INPA screen. The tooltip
       carries the explanation for anyone wondering what the dot
       means; `pointer-events-auto` so it's hoverable even though
       its container is `pointer-events-none`. -->
  <span
    class="pointer-events-auto absolute right-2 top-2 block h-2 w-2 animate-pulse rounded-full bg-green-500 shadow-sm"
    title="Live screen — the script is fetching fresh ECU data on every cycle and re-rendering the values you see. Most BMW diagnostic screens run in this mode."
    aria-label="Live screen — data is refreshing"
    role="status"
  ></span>
{/if}
