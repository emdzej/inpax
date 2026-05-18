<script lang="ts">
  /**
   * Page navigation overlay for SCREEN blocks whose LINE-block count
   * exceeds the visible viewport. Sits in the bottom-right corner of
   * the canvas (mirroring the LiveIndicator on the top-right) and
   * surfaces two stacked chevron buttons:
   *
   *   ▲  scroll one LINE block up  (active when firstVisibleLine > 0)
   *   ▼  scroll one LINE block down (active when there's more below)
   *
   * Mirrors real INPA's green ▲/▼ glyphs but as proper clickable
   * controls — the keymap (↑/↓/PgUp/PgDn/Home/End in IpoRunner) still
   * handles the keyboard path so power users don't need to reach for
   * the mouse. See `docs/research/screen-line-pagination.md`.
   *
   * Buttons stay rendered (rather than being conditionally hidden) so
   * the layout doesn't jump when you reach the top or bottom — the
   * unreachable direction goes disabled / dim instead.
   */

  import type { UIProvider } from "@emdzej/inpax-ui-provider-core";

  type Props = { ui: UIProvider };
  const { ui }: Props = $props();

  let firstVisible = $state(0);
  let visibleCount = $state(0);
  let totalLines = $state(0);

  $effect(() => {
    const provider = ui;
    const refresh = () => {
      firstVisible = provider.state.firstVisibleLine;
      visibleCount = provider.state.visibleLineCount;
      totalLines = provider.state.totalLines;
    };
    refresh();
    return provider.onStateChange(refresh);
  });

  const overflowing = $derived(totalLines > visibleCount && visibleCount > 0);
  const canScrollUp = $derived(overflowing && firstVisible > 0);
  const canScrollDown = $derived(
    overflowing && firstVisible + visibleCount < totalLines,
  );

  // Page indicator: 1-based current position / total positions. INPA
  // scrolls by ONE LINE per arrow press (not by `visibleCount` lines),
  // so the count of distinct firstVisible values is
  // `totalLines - visibleCount + 1`, not `ceil(totalLines /
  // visibleCount)`. Example: 7 lines, 5 visible → max firstVisible
  // = 2, so 3 distinct positions (1/3, 2/3, 3/3), not 2.
  const totalPages = $derived(
    overflowing ? Math.max(1, totalLines - visibleCount + 1) : 1,
  );
  const currentPage = $derived(overflowing ? firstVisible + 1 : 1);

  function up() {
    ui.scrollLines(-1);
  }
  function down() {
    ui.scrollLines(1);
  }
</script>

{#if overflowing}
  <!-- pointer-events-auto so the buttons remain clickable even if the
       parent stack uses pointer-events-none. Small green-bordered
       chip in the bottom-right corner mirroring INPA's own page hint;
       the ▲ disables at the top, ▼ at the bottom — the layout stays
       fixed (no jumping) but the unreachable direction goes muted /
       not-allowed cursor. -->
  <div
    class="pointer-events-auto absolute bottom-2 right-2 z-10 flex flex-col items-center gap-1 rounded border border-green-600/60 bg-base/80 p-1 shadow-sm"
    aria-label="Page navigation — {currentPage} of {totalPages}"
    data-testid="scroll-indicator"
  >
    <button
      type="button"
      class="rounded p-1 text-xs leading-none transition"
      class:text-green-600={canScrollUp}
      class:hover:bg-green-100={canScrollUp}
      class:dark:hover:bg-green-900={canScrollUp}
      class:text-faint={!canScrollUp}
      class:opacity-40={!canScrollUp}
      class:cursor-not-allowed={!canScrollUp}
      disabled={!canScrollUp}
      onclick={up}
      title={canScrollUp
        ? `Previous line (page ${currentPage} of ${totalPages}) — keyboard: ↑ / PgUp`
        : "Already at first line"}
      aria-label="Scroll up one line"
    >▲</button>
    <span
      class="font-mono text-[10px] leading-none text-faint"
      aria-hidden="true"
    >{currentPage}/{totalPages}</span>
    <button
      type="button"
      class="rounded p-1 text-xs leading-none transition"
      class:text-green-600={canScrollDown}
      class:hover:bg-green-100={canScrollDown}
      class:dark:hover:bg-green-900={canScrollDown}
      class:text-faint={!canScrollDown}
      class:opacity-40={!canScrollDown}
      class:cursor-not-allowed={!canScrollDown}
      disabled={!canScrollDown}
      onclick={down}
      title={canScrollDown
        ? `Next line (page ${currentPage} of ${totalPages}) — keyboard: ↓ / PgDn`
        : "Already at last line"}
      aria-label="Scroll down one line"
    >▼</button>
  </div>
{/if}
