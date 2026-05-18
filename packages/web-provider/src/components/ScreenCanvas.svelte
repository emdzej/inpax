<script lang="ts">
  /**
   * Canvas-based renderer for the INPA ScreenBuffer.
   *
   * INPA scripts paint into a 2D character grid (`(row, col) → { char, fg, bg }`)
   * which is the *exact* model a canvas with a fixed monospace font
   * expects. Two passes per frame:
   *
   *   1. Background — fill rects for cells whose bg differs from the
   *      theme's default. Skips default cells to keep the fill count
   *      low for mostly-empty screens.
   *   2. Glyphs — `fillText` per cell. Bunched by colour run so we pay
   *      the `fillStyle` setter cost once per visible-text run instead
   *      of per cell.
   *
   * Sizing model: the canvas fills its parent. A ResizeObserver pumps
   * the container's pixel size into reactive state; each paint derives
   * a cell width / height that fits the buffer's grid (80×25) into
   * those bounds while preserving the monospace aspect ratio (~0.6
   * wide as it is tall). DPR scaling for crisp retina glyphs.
   */

  import {
    formatAnalogValue,
    type ScreenBuffer,
    type UIProvider,
  } from "@emdzej/inpax-ui-provider-core";
  import { paletteColor } from "../lib/theme.js";
  import { getLibTheme } from "../lib/theme-context.svelte.js";

  type Props = {
    screen: ScreenBuffer;
    /**
     * Provider snapshot — used for the graphical overlays the cell
     * grid can't represent: variable-size text from `fTextOut`, the
     * analog-bar gauge from `analogout`, and the LED indicator from
     * `digitalout`. Optional so the canvas still works in test /
     * preview contexts that only render the screen buffer.
     */
    ui?: UIProvider;
    /**
     * Optional frame-ready subscription — when supplied, paints fire
     * on the runtime's `cycle:complete` boundary (one paint per full
     * SCREEN cycle) instead of running a free RAF loop. This is the
     * fix for the "Battery/Ignition flicker" symptom: state changes
     * fire per cell write and span many event loop ticks while a
     * LINE block awaits INPAapiJob, so painting on each one shows a
     * partially-rewritten line. Cycles are atomic.
     *
     * Falls back to a free RAF loop when not supplied — used for
     * tests / standalone canvas previews where no runtime exists.
     */
    onFrameReady?: (cb: () => void) => () => void;
    /**
     * Optional callback fired once when the underlying `<canvas>`
     * element is bound (and again with `null` on unmount). Lets the
     * host wire up things that need the raw canvas — the screenshot
     * button in `IpoRunner.svelte` uses it for `toBlob`.
     */
    bindCanvas?: (el: HTMLCanvasElement | null) => void;
  };
  const { screen, ui, onFrameReady, bindCanvas }: Props = $props();

  // Pass the canvas ref up to the host as soon as it's bound, and
  // again with null on unmount so the host can drop its reference.
  $effect(() => {
    bindCanvas?.(canvas);
    return () => bindCanvas?.(null);
  });

  // Active palette comes from the lib's theme context. The host calls
  // `setLibTheme(...)` once at the root (typically inside an $effect
  // that tracks Light/Dark/System); a `$derived` here re-runs on every
  // change so the next paint picks the new palette + background up.
  const theme = $derived(getLibTheme());

  // Cell aspect ratio (width / height) for the chosen monospace font.
  // A bit smaller than 1.0 — typical monospace glyphs are ~0.55-0.6×
  // their height.
  const CELL_ASPECT = 0.6;

  let container = $state<HTMLDivElement | null>(null);
  let canvas = $state<HTMLCanvasElement | null>(null);
  let containerSize = $state({ w: 0, h: 0 });

  // Off-screen back buffer. All rendering happens here; the visible
  // canvas only ever receives a single `drawImage` blit at the end
  // of paint(). The browser can't show partial state because the
  // visible canvas is touched exactly once per frame, atomically.
  // Lazily created on first paint so SSR / pre-mount $effect runs
  // don't try to construct a canvas in an environment without
  // `document`.
  let backBuffer: HTMLCanvasElement | null = null;

  // Resize observer pumps container size into reactive state; the RAF
  // loop picks it up on the next paint, so we don't need to redraw
  // synchronously on resize events.
  $effect(() => {
    if (!container) return;
    const update = () => {
      containerSize = { w: container!.clientWidth, h: container!.clientHeight };
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(container);
    return () => ro.disconnect();
  });

  /**
   * Fit the buffer grid into the container while preserving the
   * monospace aspect ratio. Returns the pixel dimensions of one cell.
   */
  function fitCellSize(
    cols: number,
    rows: number,
    cw: number,
    ch: number
  ): { w: number; h: number } {
    if (cols <= 0 || rows <= 0 || cw <= 0 || ch <= 0) return { w: 0, h: 0 };
    // Cell height bounded by either the container's height-per-row,
    // or the container's width-per-col after the aspect adjustment.
    const hFromHeight = ch / rows;
    const hFromWidth = cw / cols / CELL_ASPECT;
    const cellH = Math.floor(Math.min(hFromHeight, hFromWidth));
    const cellW = Math.floor(cellH * CELL_ASPECT);
    return { w: Math.max(1, cellW), h: Math.max(1, cellH) };
  }

  function paint() {
    if (!canvas || !container) return;

    const cols = screen.width;
    const rows = screen.height;
    const cell = fitCellSize(cols, rows, containerSize.w, containerSize.h);
    if (cell.w === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const cssWidth = cols * cell.w;
    const cssHeight = rows * cell.h;

    const targetBackingW = Math.floor(cssWidth * dpr);
    const targetBackingH = Math.floor(cssHeight * dpr);

    // Keep visible + back buffers in sync. The visible canvas's CSS
    // size drives layout; the back buffer is invisible and only needs
    // matching backing-pixel dimensions for the final drawImage.
    if (canvas.width !== targetBackingW || canvas.height !== targetBackingH) {
      canvas.width = targetBackingW;
      canvas.height = targetBackingH;
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
    }
    if (!backBuffer) {
      backBuffer = document.createElement("canvas");
    }
    if (backBuffer.width !== targetBackingW || backBuffer.height !== targetBackingH) {
      backBuffer.width = targetBackingW;
      backBuffer.height = targetBackingH;
    }

    const offCtx = backBuffer.getContext("2d");
    const visCtx = canvas.getContext("2d");
    if (!offCtx || !visCtx) return;

    // Identity-reset then apply DPR scale so backing pixels and CSS
    // pixels stay decoupled. (Setting `width` already clears the
    // canvas; setTransform is for the multi-paint case where size
    // didn't change.)
    offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Font sized to cell height with a small inset so descenders
    // don't crash into the next row. textBaseline=top makes y math
    // straightforward.
    offCtx.font = `${Math.max(8, cell.h - 2)}px ${theme.font.family}`;
    offCtx.textBaseline = "top";

    // Background base layer covers any sub-cell gaps from rounding.
    offCtx.fillStyle = theme.background;
    offCtx.fillRect(0, 0, cssWidth, cssHeight);

    const spans = screen.renderSpans();

    // Pass 1: bg fills (skip default-bg cells).
    for (let r = 0; r < spans.length; r++) {
      const y = r * cell.h;
      let cursor = 0;
      for (const span of spans[r]) {
        if (span.bg !== 0) {
          offCtx.fillStyle = theme.palette[span.bg] ?? theme.background;
          offCtx.fillRect(cursor * cell.w, y, span.text.length * cell.w, cell.h);
        }
        cursor += span.text.length;
      }
    }

    // Pass 2: glyphs (skip whitespace-only runs).
    for (let r = 0; r < spans.length; r++) {
      const y = r * cell.h + 1;
      let cursor = 0;
      for (const span of spans[r]) {
        if (span.text.trim().length > 0) {
          offCtx.fillStyle = theme.palette[span.fg] ?? "#cccccc";
          offCtx.fillText(span.text, cursor * cell.w, y);
        }
        cursor += span.text.length;
      }
    }

    // Graphical overlays — analog gauges, digital LEDs, sized text.
    // These read from the provider's typed-primitive arrays so we
    // can render them as real graphics (not character cells). Each
    // pass also fills its target region with the theme background
    // first to hide the small cell-grid text the provider also wrote
    // there (so we don't double-render the formatted numeric value
    // behind the gauge bar, the `●`/`○` LED glyph behind the proper
    // indicator, etc).
    if (ui) {
      drawAnalogGauges(offCtx, cell);
      drawDigitalLEDs(offCtx, cell);
      drawSizedTexts(offCtx, cell);
    }

    // Atomic present: single drawImage from back buffer to visible
    // canvas. Identity transform so backing pixels map 1:1 — the DPR
    // scale was already baked into the back buffer's draws.
    visCtx.setTransform(1, 0, 0, 1, 0, 0);
    visCtx.drawImage(backBuffer, 0, 0);
  }

  // ============ Graphical overlay helpers ============

  /**
   * Width of the analog bar in cells. Original INPA renders these as
   * a fixed-width gauge that takes most of the row. We approximate at
   * ~40 cells wide; if (col + GAUGE_WIDTH) overflows the screen the
   * bar clips at the right edge.
   */
  const GAUGE_WIDTH_CELLS = 40;

  /** Trailing space reserved for the formatted numeric value to the
   * right of the gauge bar. */
  const GAUGE_VALUE_CELLS = 8;

  function drawAnalogGauges(ctx: CanvasRenderingContext2D, cell: { w: number; h: number }): void {
    if (!ui) return;
    const values = ui.getAnalogValues();
    if (values.length === 0) return;

    for (const v of values) {
      const x0 = v.col * cell.w;
      const y0 = v.row * cell.h;
      const totalCells = Math.min(GAUGE_WIDTH_CELLS, screen.width - v.col);
      const barCells = Math.max(2, totalCells - GAUGE_VALUE_CELLS);
      const barW = barCells * cell.w;
      const barH = Math.max(6, cell.h - 4);
      const barY = y0 + Math.floor((cell.h - barH) / 2);

      // Hide whatever cell-grid text the provider wrote for this slot.
      ctx.fillStyle = theme.background;
      ctx.fillRect(x0, y0, totalCells * cell.w, cell.h);

      // Zone backdrop: red invalid bookends, green valid mid. Each
      // zone is mapped from the value range (`min..max`) into the bar
      // pixel range.
      const span = v.max - v.min;
      if (span > 0) {
        const px = (val: number) => x0 + Math.round(((val - v.min) / span) * barW);

        // min .. minValid (low invalid)
        const xMinValid = px(v.minValid);
        if (xMinValid > x0) {
          ctx.fillStyle = theme.gauge.invalid;
          ctx.fillRect(x0, barY, xMinValid - x0, barH);
        }
        // minValid .. maxValid (valid)
        const xMaxValid = px(v.maxValid);
        if (xMaxValid > xMinValid) {
          ctx.fillStyle = theme.gauge.valid;
          ctx.fillRect(xMinValid, barY, xMaxValid - xMinValid, barH);
        }
        // maxValid .. max (high invalid)
        const xMax = x0 + barW;
        if (xMax > xMaxValid) {
          ctx.fillStyle = theme.gauge.invalid;
          ctx.fillRect(xMaxValid, barY, xMax - xMaxValid, barH);
        }

        // Needle / fill: clamp the value into the bar range, then
        // paint the theme's gauge-needle colour from x0 to the
        // value's pixel position. Needle contrast is tuned against
        // the zone backdrop in each theme — black against vibrant
        // red/green in light mode; near-white against saturated
        // dark-red/dark-green zones in dark mode.
        const clamped = Math.min(Math.max(v.value, v.min), v.max);
        const xValue = px(clamped);
        ctx.fillStyle = theme.gauge.needle;
        ctx.fillRect(x0, barY, xValue - x0, barH);
      }

      // Outline so the bar boundary reads against the canvas
      // background even when fully red or fully green.
      ctx.strokeStyle = theme.gauge.outline;
      ctx.lineWidth = 1;
      ctx.strokeRect(x0 + 0.5, barY + 0.5, barW - 1, barH - 1);

      // Numeric value to the right of the bar. Uses the gauge
      // outline colour so label + outline stay visually paired.
      const formatted = formatAnalogValue(v.value, v.format);
      ctx.fillStyle = theme.gauge.outline;
      ctx.font = `${Math.max(8, cell.h - 2)}px ${theme.font.family}`;
      ctx.textBaseline = "top";
      ctx.fillText(formatted, x0 + barW + Math.floor(cell.w / 2), y0 + 1);
    }
  }

  function drawDigitalLEDs(ctx: CanvasRenderingContext2D, cell: { w: number; h: number }): void {
    if (!ui) return;
    const values = ui.getDigitalValues();
    if (values.length === 0) return;

    for (const v of values) {
      const x0 = v.col * cell.w;
      const y0 = v.row * cell.h;
      const label = v.value ? v.trueText : v.falseText;
      // Indicator footprint: one cell for the LED + the label width.
      const indicatorCells = 1;
      const labelCells = label.length + 1;
      const totalCells = indicatorCells + labelCells;

      // Hide the cell-grid `●/○` glyph + label the provider already
      // wrote so we don't double-draw.
      ctx.fillStyle = theme.background;
      ctx.fillRect(x0, y0, totalCells * cell.w, cell.h);

      // LED disc — green when on, dim red when off; matches the
      // green/red convention real INPA uses (and ediabasx's xignit
      // semantics — see SerialInterface.ts ignitionVoltage getter).
      const radius = Math.floor(Math.min(cell.w, cell.h) / 2) - 1;
      const cx = x0 + cell.w / 2;
      const cy = y0 + cell.h / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = v.value
        ? paletteColor(theme, 10 /* green */)
        : paletteColor(theme, 5 /* dark red */);
      ctx.fill();
      ctx.strokeStyle = paletteColor(theme, 1 /* default text colour */);
      ctx.lineWidth = 1;
      ctx.stroke();

      // Label to the right of the disc, in the theme's default text
      // colour. Empty labels (the UTILITY case where the script writes
      // its own "on"/"off" via ftextout) leave the slot blank — the
      // ftextout text still renders via the regular text pass.
      if (label) {
        ctx.fillStyle = paletteColor(theme, 1);
        ctx.font = `${Math.max(8, cell.h - 2)}px ${theme.font.family}`;
        ctx.textBaseline = "top";
        ctx.fillText(label, x0 + cell.w + Math.floor(cell.w / 4), y0 + 1);
      }
    }
  }

  /**
   * Render `fTextOut` entries whose `fontSize > 0` at the requested
   * size, on top of the small cell-grid text the buffer already holds.
   * Falls back silently when no entries carry a font size — leaves the
   * default text alone.
   *
   * INPA's `fontSize` is documented as 0..7. We don't yet know the
   * exact pt-mapping the original used; for now treat each step as a
   * multiplier over the cell-height font size.
   */
  function drawSizedTexts(ctx: CanvasRenderingContext2D, cell: { w: number; h: number }): void {
    if (!ui) return;
    const lines = ui.getTextLines();
    for (const line of lines) {
      const size = line.fontSize ?? 0;
      if (size <= 0) continue;
      const baseFontPx = Math.max(8, cell.h - 2);
      const fontPx = Math.round(baseFontPx * (1 + size * 0.25));
      const x = line.col * cell.w;
      const y = line.row * cell.h;

      // Wipe the cell-grid glyph for the area this sized text will
      // occupy so the small font doesn't bleed through.
      const approxW = line.text.length * cell.w;
      ctx.fillStyle = theme.background;
      ctx.fillRect(x, y, approxW, cell.h);

      ctx.fillStyle = paletteColor(theme, line.fg);
      ctx.font = `${fontPx}px ${theme.font.family}`;
      ctx.textBaseline = "top";
      ctx.fillText(line.text, x, y);
    }
  }

  // Paint coalescing: cycle:complete from the runtime is the only
  // atomic boundary that fires after a full SCREEN cycle has settled,
  // so we drive paints from that when available. Each cycle event
  // schedules a single RAF; multiple events within a vsync coalesce
  // into one paint.
  //
  // Without a frame source (preview / no runtime yet), fall back to
  // a regular RAF loop so the canvas is at least always live.
  $effect(() => {
    void screen;
    let scheduled = false;
    let cancelled = false;
    const schedule = () => {
      if (cancelled || scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        if (!cancelled) paint();
      });
    };
    let unsubscribe: (() => void) | undefined;
    if (onFrameReady) {
      unsubscribe = onFrameReady(schedule);
      schedule(); // initial paint
    } else {
      const loop = () => {
        if (cancelled) return;
        paint();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
    // Repaint when the container resizes or the theme changes — the
    // ResizeObserver and the theme `$derived` both update reactive
    // state, but neither fires a paint by itself when we're driven by
    // `onFrameReady`. Without this watcher, toggling Light/Dark with
    // no active cycle (paused script, no cable connected, …) leaves
    // the canvas displaying its pre-toggle frame with the wrong
    // colours until the next runtime cycle.
    const sizeWatcher = $effect.root(() => {
      $effect(() => {
        void containerSize;
        void theme;
        schedule();
      });
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
      sizeWatcher();
    };
  });
</script>

<!-- Background lives on the container, NOT on the canvas. Svelte 5
     replaces the canvas's whole `style` attribute when `theme` changes;
     that wipes out the `style.width`/`style.height` that `paint()` sets
     imperatively, and the canvas snaps to its native backing-pixel
     resolution (visible as a sudden zoom-in on theme toggle). Putting
     the background on the wrapper avoids the conflict — the wrapper
     has no imperative sizing to lose. -->
<div
  bind:this={container}
  class="flex h-full w-full items-center justify-center"
  style="background: {theme.background};"
>
  <canvas bind:this={canvas}></canvas>
</div>
