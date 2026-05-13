# SCREEN LINE-block pagination

INPA screens with more LINE blocks than fit vertically on the canvas
get **paginated automatically** — the user steps between pages with
the arrow keys, and a small green ▲/▼ glyph in the bottom-right
indicates when there's more content above / below.

Today, our `screen-executor.ts` just stacks all LINE blocks linearly
via `setLineBaseRow((lineIndex + 1) * LINE_HEIGHT)` and lines past
the visible viewport paint off-canvas (unreachable). This note
records what we learned from the disassembly + Ghidra so we have a
single reference when implementing the missing pager.

## Concrete example — MS43 → Status → Digital → Digitalwerte 1

User-visible behaviour (from screenshots):

- **Page 1** shows LINE blocks 1–5: Status Leerlauf/Teillast/Vollast,
  Schub/Schubabschaltung/Fahrstufe, Eingang Klimaanlage/…, Eingang
  Kupplung/BLS/BLTS, Fehlerlampe MIL/EML/Status CAN. Bottom-right:
  green ▼ only.
- **Page 2** shows LINE blocks 2–6: starts at Schub, ends at
  Lambdaregelung Bank 1/Bank 2/Status Katheizen. Bottom-right: green
  ▲▼ (both, since there's content above and below).

So pagination is **per-line-block**, not per-fixed-height-window, and
the step is **one LINE block per arrow press**, not a full page.

## What the bytecode actually contains

Pulled from `disasm/ms430.txt` for `S: [0x000B] s_digital1`:

| # | LINE block label                                                                                  |
| -- | ------------------------------------------------------------------------------------------------ |
| 1  | Status Leerlauf, Vollast : STAT_LL_EIN;STAT_TL_EIN;STAT_VL_EIN                                   |
| 2  | Status Schub, Schubabschaltung, Fahrstufe : STAT_SCHUB_EIN;STAT_SCHUB_AB_EIN;STAT_FAHRSTUFE_EIN  |
| 3  | Eingang Klimaanlage, Klimakompressor : STAT_AC_EIN;STAT_KO_EIN;STAT_KO_ANSTEUERUNG_EIN           |
| 4  | Eingang Kupplung, BLS, BLTS : STAT_KUP_EIN;STAT_BLS_EIN;STAT_BLTS_EIN                            |
| 5  | Eingang FGR, Start, CAN : STAT_FEHLERLAMPE_EIN;STAT_FEHLERLAMPE_EML_EIN;STAT_CAN_EIN             |
| 6  | L-Regler 1, L-Regler 2, Adapt.-Sperre : STAT_LAMBDAREGELUNG_EIN;… ;STAT_KATHEIZEN_EIN            |
| 7  | Status ASC-Eingriff, EGS-Eingriff : STAT_ASC_EINGRIFF_EIN;STAT_EGS_EINGRIFF_EIN                  |
| 8  | DISA-Relais, EKP-Relais : STAT_DISA_ANSTEUERUNG_EIN;STAT_EKP_AMSTEUERUNG_EIN;STAT_TEV_EIN        |
| 9  | SLP 1, SLV : STAT_SLV_EIN;STAT_SLP_EIN                                                            |
| 10 | Leckdiagnose Funktion, DMTL - VENTIL : STAT_LDP_EIN;STAT_REEDSWITCH_EIN                          |

Crucially, **none of these blocks carry pagination metadata**.
There's no "page 1 of 2" field, no `setpage` opcode, no LINE-level
visibility flag. The script just declares 10 blocks and trusts
INPA's runtime to deal with overflow.

## Where the pagination lives (Ghidra findings)

### INPAGER.DLL — red herring

Despite the name, `~/Downloads/inpa/EC-APPS/INPA/BIN/INPAGER.DLL`
(114 KB, dated Feb 2010) is **not** a pager. Loaded into Ghidra, it
only exports:

```
Ordinal_1 -> __GetLocalFileVersion@12   @ 10001107
Ordinal_2 -> __GetLocalProductVersion@12 @ 10001168
entry                                    @ 100012af  (DllMain)
```

Its strings are CRT runtime-error text and standard Windows API
names it links against. INPA.exe loads it dynamically (the string
`"inpager.dll"` appears in INPA.exe's table, but no static imports
from it). Best guess: version-info utility used by the About box.

### INPA.exe — the real pager

INPA.exe statically imports the Win32 scroll API:

- `SetScrollRange` / `GetScrollRange` (user32 ordinals 0x8d / 0xcd)
- `SetScrollPos` / `GetScrollPos` (0xce / 0xcb)

The string table contains `"Bad Seek in OnVScroll\n"` at `0x48fba0`,
referenced from an exception handler inside `FUN_00426626`
(callee of `FUN_0042625c` at `0x42625c`). Decompiling that:

```c
void __thiscall FUN_0042625c(void *this, undefined4 sbCode, int pos) {
  ...
  switch (sbCode) {
  case 0: /* SB_LINEUP   */    seek back one line
  case 1: /* SB_LINEDOWN */    seek forward one line
  case 2: /* SB_PAGEUP   */    seek by page
  case 3: /* SB_PAGEDOWN */    seek by page
  case 4/5: /* SB_THUMB*  */   seek to absolute offset
  case 6: /* SB_TOP      */    pos = 0;     fallthrough to thumb
  case 7: /* SB_BOTTOM   */    pos = 1000;  fallthrough to thumb
  default: error("Bad Seek in OnVScroll")
  }
  ...
}
```

That's an MFC `OnVScroll(UINT nSBCode, UINT nPos, CScrollBar*)`
override with standard `SB_*` constants. But the operations on
`*(int *)((int)this + 0x48)` look like `CFile`-style seeks — so this
particular `OnVScroll` is the **file viewer**'s (the modal that
`viewopen` pops up), **not the screen view's**.

The main-screen `OnVScroll` exists too — it'd be reached through the
same Win32 mechanism (arrow keys → scroll bar → WM_VSCROLL → MFC
message map → handler) — but it lives behind MFC's `DECLARE_
MESSAGE_MAP` dispatch tables that Ghidra's analyzer doesn't expand,
so finding its exact byte address requires manually walking the
window class's vtable. We didn't pursue that further: knowing INPA
goes through `SetScrollRange` + Win32 `SB_*` codes is enough to
reproduce the behaviour faithfully.

## The algorithm we need to replicate

This is a classic Win32 scroll-window pattern:

```
firstVisibleLine ∈ [0, max(0, totalLines − visibleLines)]
visibleLines    = floor(screenHeight / LINE_HEIGHT) − chrome_rows
totalLines      = number of LINE blocks in the active screen
```

Input handling:

| Key            | Win32 message       | Behaviour                                  |
| -------------- | ------------------- | ------------------------------------------ |
| ↑              | WM_VSCROLL SB_LINEUP   | `firstVisibleLine = max(0, firstVisibleLine − 1)` |
| ↓              | WM_VSCROLL SB_LINEDOWN | `firstVisibleLine = min(maxFirst, firstVisibleLine + 1)` |
| PageUp         | WM_VSCROLL SB_PAGEUP   | `firstVisibleLine -= visibleLines − 1`     |
| PageDown       | WM_VSCROLL SB_PAGEDOWN | `firstVisibleLine += visibleLines − 1`     |
| Home           | WM_VSCROLL SB_TOP      | `firstVisibleLine = 0`                     |
| End            | WM_VSCROLL SB_BOTTOM   | `firstVisibleLine = maxFirst`              |

Rendering:

- Iterate the active screen's LINE blocks `i = 0..totalLines − 1`.
- Skip blocks where `i < firstVisibleLine` or
  `i ≥ firstVisibleLine + visibleLines`.
- For visible blocks, paint at row offset
  `(i − firstVisibleLine + 1) * LINE_HEIGHT` (instead of today's
  `(i + 1) * LINE_HEIGHT`).
- Show ▲ glyph in the bottom-right when `firstVisibleLine > 0`,
  ▼ when `firstVisibleLine + visibleLines < totalLines`. INPA
  draws this as a small TextOutA-style glyph in a chrome strip; we
  can render a green chevron unicode (`▲` `▼`) in the corresponding
  corner of the canvas.

## Sketch of the implementation in inpax

`packages/interpreter/src/vm/screen-executor.ts`:

- Add `this.totalLines: number` (count of LINE blocks at SCREEN
  attach time) and `this.firstVisibleLine: number` (default 0).
- Update the LINE-block run loop to skip blocks outside the
  visible window — or run them all but pass a fresh `lineBaseRow`
  derived from `(i − firstVisibleLine + 1) * LINE_HEIGHT`. Skipping
  is preferable: it avoids paying for jobs whose output won't
  display.

`packages/ui-provider-core/src/ui-provider.ts`:

- Add to state: `firstVisibleLine`, `visibleLineCount`, `totalLines`.
- Expose `setVisibleWindow(first, count, total)` and
  `scrollLines(delta)`.

`apps/inpax-web/src/components/ScreenCanvas.svelte`:

- React to `firstVisibleLine` / `totalLines` changes.
- Draw a small green ▲/▼ glyph in the bottom-right corner when
  appropriate.

`apps/inpax-web/src/components/IpoRunner.svelte` (or a new keymap
hook):

- Bind ↑/↓/PgUp/PgDn/Home/End to `provider.scrollLines(delta)` when
  the canvas (not an input) has focus. F-key shortcuts already gate
  on `isEditableTarget` — reuse the same predicate.

CLI side (`apps/cli`):

- `@emdzej/inpax-tui` will need the same treatment so the cell-grid
  CLI shows the same pagination. Same provider state changes are
  picked up there for free; the keymap/glyph rendering is the only
  extra work.

## Why we know the bytecode side is already correct

Each LINE block writes through `text(row, col, ...)` calls in its
own local coordinate space. The screen executor flips
`setLineBaseRow` between LINE blocks so each one paints inside its
own window. That means the same LINE block, run with a different
`baseRow`, paints at a different absolute row — no LINE-internal
math needs to change for pagination. We just rebase the offset.

## Why we don't need to dig deeper in Ghidra

The behaviour we need to match is fully constrained by:

- the bytecode (10 LINE blocks, no metadata), and
- the standard Win32 scroll-bar contract (`SB_*` codes,
  `SetScrollRange` / `SetScrollPos` semantics).

Finding the exact byte offset of the main-screen `OnVScroll` would
tell us nothing the standard contract doesn't already. The
"per-line-block" step size is the only INPA-specific choice, and
that's locked in by what we observe in the screenshots (one block
per arrow press, not one fixed-height window).
