import { describe, it, expect } from "vitest";
import { parseStateMachine } from "../state-machine.js";
import { SectionTypeMarkers } from "../types.js";

describe("parseStateMachine", () => {
    it("should correctly parse state machine with no states", () => {
        const data = new Uint8Array([
            0x03, 0x73, 0x6D, 0x5F, 0x6E, 0x61, 0x6D, 0x65, 0x0A, 0x00, 0x00, 0x00, 0x00, 0x0A, 0x0A, 0x00,
            0x02, 0x00, 0x0F, 0x00, 0x00, 0x00, 0x08, 0x51, 0x00, 0x00
        ]);

        const result = parseStateMachine(data, 0);
        expect(result.result.type).toBe(SectionTypeMarkers.STATE_MACHINE);
        expect(result.result.name).toBe("sm_name");
        expect(result.result.id).toBe(0);
        expect(result.result.flags).toBe(0);
        expect(result.result.arg1).toBeUndefined();
        expect(result.result.arg2).toBeUndefined();
        expect(result.result.size).toBe(2);
        expect(result.offset).toBe(data.length);
        expect(result.result.instructions).toEqual([
            {
                raw: new Uint8Array([0x0F, 0x00, 0x00, 0x00]),
                offset: 18,
            }, {
                raw: new Uint8Array([0x08, 0x51, 0x00, 0x00]),
                offset: 22,
            },
        ]);
    });

    it("should correctly parse state machine with 2 states", () => {
        const data = new Uint8Array([
            0x03, 0x73, 0x6D, 0x5F, 0x6E, 0x61, 0x6D, 0x65, 0x0A, 0x00, 0x00, 0x00, 0x00, 0x0A, 0x0A, 0x00,
            0x02, 0x00, 0x0F, 0x00, 0x00, 0x00, 0x08, 0x51, 0x00, 0x00, 0x25, 0x73, 0x74, 0x61, 0x74, 0x65,
            0x31, 0x0A, 0x00, 0x00, 0x00, 0x00, 0x0A, 0x0A, 0x00, 0x00, 0x00, 0x25, 0x73, 0x74, 0x61, 0x74,
            0x65, 0x32, 0x0A, 0x01, 0x00, 0x00, 0x00, 0x0A, 0x0A, 0x00, 0x00, 0x00,
        ]);

        const result = parseStateMachine(data, 0);
        expect(result.result.type).toBe(SectionTypeMarkers.STATE_MACHINE);
        expect(result.result.name).toBe("sm_name");
        expect(result.result.id).toBe(0);
        expect(result.result.flags).toBe(0);
        expect(result.result.arg1).toBeUndefined();
        expect(result.result.arg2).toBeUndefined();
        expect(result.result.size).toBe(2);
        expect(result.offset).toBe(data.length);
        expect(result.result.states.length).toBe(2);

        const s1 = result.result.states[0];
        expect(s1.type).toBe(SectionTypeMarkers.STATE_MACHINE_STATE_FUNCTION);
        expect(s1.name).toBe("state1");
        expect(s1.id).toBe(0);
        expect(s1.flags).toBe(0);
        expect(s1.arg1).toBeUndefined();
        expect(s1.arg2).toBeUndefined();
        expect(s1.size).toBe(0);
        expect(s1.instructions).toEqual([]);

        const s2 = result.result.states[1];
        expect(s2.type).toBe(SectionTypeMarkers.STATE_MACHINE_STATE_FUNCTION);
        expect(s2.name).toBe("state2");
        expect(s2.id).toBe(1);
        expect(s2.flags).toBe(0);
        expect(s2.arg1).toBeUndefined();
        expect(s2.arg2).toBeUndefined();
        expect(s2.size).toBe(0);
    });

});
