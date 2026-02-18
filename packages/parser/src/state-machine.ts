import { ParseResult, StateMachine, SectionTypeMarkers, State } from "@inpax/core";
import { parseFunction } from "./function.js";

export function parseStateMachine(buffer: Uint8Array, startOffset: number): ParseResult<StateMachine> {
    var offset = startOffset;
    const sectionResult = parseFunction(buffer, offset, SectionTypeMarkers.STATE_MACHINE);
    offset = sectionResult.offset;
    const stateFunctions: State[] = [];
    while (buffer[offset] === SectionTypeMarkers.STATE_MACHINE_STATE_FUNCTION) {
        const stateFunctionResult = parseFunction(buffer, offset, SectionTypeMarkers.STATE_MACHINE_STATE_FUNCTION);
        offset = stateFunctionResult.offset;
        stateFunctions.push(stateFunctionResult.result);
    }

    return {
        result: {
            ...sectionResult.result,
            states: stateFunctions
        },
        offset
    };
}
