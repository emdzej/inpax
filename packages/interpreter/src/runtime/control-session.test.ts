import { describe, it, expect } from 'vitest';
import { ControlSession } from './control-session.js';
import type { ToggleItem } from '@emdzej/inpax-interfaces';

const ITEMS: ToggleItem[] = [
    { name: 'Lampe 1', mask: '0x01;0x00;0x00;0x00;0x00;0x00;0x00;0x00;0x00' },
    { name: 'Lampe 2', mask: '0x02;0x00;0x00;0x00;0x00;0x00;0x00;0x00;0x00' },
    { name: 'Lampe 3', mask: '0x04;0x00;0x00;0x00;0x00;0x00;0x00;0x00;0x00' },
];

describe('ControlSession', () => {
    it('defaults to idle', () => {
        const s = new ControlSession();
        expect(s.active).toBe(false);
        expect(s.applied).toBe(false);
        expect(s.selected).toEqual([]);
        expect(s.cycleTicks).toBe(0);
        expect(s.cancelled).toBe(false);
    });

    it('start sets active + cycle when registered list non-empty', () => {
        const s = new ControlSession();
        s.start(ITEMS);
        expect(s.active).toBe(true);
        expect(s.cycleTicks).toBe(60);
    });

    it('start is a no-op when registered list empty (INPA IsEmpty guard)', () => {
        const s = new ControlSession();
        s.start([]);
        expect(s.active).toBe(false);
        expect(s.cycleTicks).toBe(0);
    });

    it('stop clears active + cycle', () => {
        const s = new ControlSession();
        s.start(ITEMS);
        s.stop();
        expect(s.active).toBe(false);
        expect(s.cycleTicks).toBe(0);
    });

    it('applySelection commits picks and flips applied', () => {
        const s = new ControlSession();
        s.applySelection([ITEMS[0], ITEMS[2]]);
        expect(s.selected).toEqual([ITEMS[0], ITEMS[2]]);
        expect(s.applied).toBe(true);
        expect(s.cancelled).toBe(false);
    });

    it('applySelection clears any prior cancel signal', () => {
        const s = new ControlSession();
        s.cancel();
        s.applySelection([ITEMS[0]]);
        expect(s.cancelled).toBe(false);
    });

    it('deselect clears subset and flips applied back to false', () => {
        const s = new ControlSession();
        s.applySelection([ITEMS[0]]);
        s.deselect();
        expect(s.selected).toEqual([]);
        expect(s.applied).toBe(false);
    });

    it('activeItems returns registered when applied=false', () => {
        const s = new ControlSession();
        expect(s.activeItems(ITEMS)).toEqual(ITEMS);
    });

    it('activeItems returns the picked subset when applied=true', () => {
        const s = new ControlSession();
        s.applySelection([ITEMS[1]]);
        expect(s.activeItems(ITEMS)).toEqual([ITEMS[1]]);
    });

    it('reset restores the idle defaults', () => {
        const s = new ControlSession();
        s.start(ITEMS);
        s.applySelection([ITEMS[0]]);
        s.reset();
        expect(s.active).toBe(false);
        expect(s.applied).toBe(false);
        expect(s.selected).toEqual([]);
        expect(s.cycleTicks).toBe(0);
        expect(s.cancelled).toBe(false);
    });
});
