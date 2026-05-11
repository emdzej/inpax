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

  import type { ScreenBuffer } from "@emdzej/inpax-tui-provider";
  import { classicInpaTheme } from "../lib/theme";

  type Props = {
    screen: ScreenBuffer;
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
  };
  const { screen, onFrameReady }: Props = $props();

  const theme = classicInpaTheme;

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

    // Atomic present: single drawImage from back buffer to visible
    // canvas. Identity transform so backing pixels map 1:1 — the DPR
    // scale was already baked into the back buffer's draws.
    visCtx.setTransform(1, 0, 0, 1, 0, 0);
    visCtx.drawImage(backBuffer, 0, 0);
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
    // Repaint when the container resizes — the ResizeObserver updates
    // `containerSize`, but that doesn't directly fire a repaint when
    // we're event-driven, so re-schedule explicitly.
    const sizeWatcher = $effect.root(() => {
      $effect(() => {
        void containerSize;
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

<div bind:this={container} class="flex h-full w-full items-center justify-center">
  <canvas bind:this={canvas} style="background: {theme.background};"></canvas>
</div>
