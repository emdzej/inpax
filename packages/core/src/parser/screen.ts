import { parseSectionHeader } from "./common.js";
import { parseFunction } from "./function.js";
import { ParseResult, Screen, ScreenLine, ScreenLineControlFunction, SectionTypeMarkers } from "./types.js";
import { messageWithOffset } from "./utils.js";

export function parseScreen(buffer: Uint8Array, startOffset: number): ParseResult<Screen> {
    var offset = startOffset;
    const sectionResult = parseFunction(buffer, offset, SectionTypeMarkers.SCREEN);
    offset = sectionResult.offset;
    const screenFunctionCandidate = buffer[offset];
    if (screenFunctionCandidate !== SectionTypeMarkers.SCREEN_FUNCTION) {
        throw new Error(messageWithOffset(`Expected screen function marker after screen header, but found 0x${screenFunctionCandidate.toString(16)}`, offset));
    }
    const screenFunctionResult = parseFunction(buffer, offset, SectionTypeMarkers.SCREEN_FUNCTION);
    offset = screenFunctionResult.offset;
    const screenLines: ScreenLine[] = [];
    while (buffer[offset] === SectionTypeMarkers.SCREEN_LINE_FUNCTION) {
        const screenLineFunctionResult = parseFunction(buffer, offset, SectionTypeMarkers.SCREEN_LINE_FUNCTION);
        offset = screenLineFunctionResult.offset;
        var screenLineControl: ScreenLineControlFunction | undefined = undefined;
        if (buffer[offset] === SectionTypeMarkers.SCREEN_LINE_CONTROL_FUNCTION) {
            const screenLineControlFunctionResult = parseFunction(buffer, offset, SectionTypeMarkers.SCREEN_LINE_CONTROL_FUNCTION);
            offset = screenLineControlFunctionResult.offset;
            screenLineControl = screenLineControlFunctionResult.result;
        }
        screenLines.push({
            ...screenLineFunctionResult.result,
            control: screenLineControl
        });
    }

    return {
        result: {
            ...sectionResult.result,
            function: screenFunctionResult.result,
            lines: screenLines,
        },
        offset
    };
}
