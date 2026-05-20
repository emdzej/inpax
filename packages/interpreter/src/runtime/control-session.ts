import type { ToggleItem } from '@emdzej/inpax-interfaces';

/**
 * Mirror of INPA's STEUERN (control/activation) session state.
 *
 * Maps to `DAT_004a0008` in INPA.exe — the singleton object that
 * tracks which controllable items the user has picked, whether a
 * cyclic control campaign is running, and the iteration cursor over
 * the picked subset. See `docs/ipo-format-versions.md` and
 * `docs/system-functions-reference.md` for the reverse-engineering
 * trail.
 *
 * Field mapping (offsets are the INPA struct anchors):
 *
 *   +0x38  active        — operation in flight (`start` sets, `stop` clears)
 *   +0x44  applied       — has user picked at least once via `select()`?
 *                          When false, the cycle iterates the SCREEN's
 *                          full registered list (`+0x7c`); when true,
 *                          it iterates the user's picked subset (`+0x98`).
 *   +0x98  selected      — user's subset chosen via the picker
 *   bec0   cycleTicks    — INPA cycle counter; 60 on start, 0 on stop
 *   e960   cancelled     — user closed picker via Cancel (1=cancel, 0=OK)
 *
 * Driven by these BEST2 system functions (handler anchors in INPA.exe):
 *
 *   0x10  select(MultipleSelectFlag)  → 0x004138a9  (FUN_0041a646)
 *   0x11  deselect()                  → 0x00413916  (FUN_0041b080)
 *   0x12  control()                   → legacy, only 8 E36/E38 IPOs use it
 *   0x13  start()                     → 0x004138ee  (FUN_0041aba9 — IsEmpty guard)
 *   0x14  stop()                      → 0x00413916  (FUN_0041b080)
 *
 * Empirically (across the E46 SGDAT install) `start` is the heaviest
 * verb — it's used idempotently to "refresh the cycle" rather than
 * strictly paired with `stop`. KOMBI.IPO calls it 30 times with zero
 * `stop` calls and works fine. Treat `start` as "make sure the
 * cycle is alive" rather than "begin a new campaign".
 */
export class ControlSession {
    active = false;
    applied = false;
    selected: ToggleItem[] = [];
    cycleTicks = 0;
    cancelled = false;

    /**
     * `start` — only meaningful when the SCREEN has registered items.
     * INPA guards with `IsEmpty(+0x1f)` and silently returns if empty.
     * Sets cycle counter to 60 (matches `DAT_0049bec0 = 0x3c`).
     */
    start(registeredItems: ToggleItem[]): void {
        if (registeredItems.length === 0) return;
        this.active = true;
        this.cycleTicks = 60;
    }

    stop(): void {
        this.active = false;
        this.cycleTicks = 0;
    }

    applySelection(picked: ToggleItem[]): void {
        this.selected = picked;
        this.applied = true;
        this.cancelled = false;
    }

    /**
     * `deselect` — clears the user's subset. Subsequent iteration
     * falls back to the SCREEN's full registered list (because
     * `applied` flips back to false).
     */
    deselect(): void {
        this.selected = [];
        this.applied = false;
    }

    cancel(): void {
        this.cancelled = true;
    }

    /**
     * Which list the cycle should iterate this tick. Mirrors INPA's
     * `*(int*)(ctx + 0x44) == 0 ? +0x7c : +0x98` branch.
     */
    activeItems(registeredItems: ToggleItem[]): ToggleItem[] {
        return this.applied ? this.selected : registeredItems;
    }

    reset(): void {
        this.active = false;
        this.applied = false;
        this.selected = [];
        this.cycleTicks = 0;
        this.cancelled = false;
    }
}
