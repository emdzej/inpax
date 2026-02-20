import { ParseResult, Menu, SectionTypeMarkers, MenuItem, MenuKey } from "@inpax/core";
import { parseFunction } from "./function.js";

export function parseMenu(buffer: Uint8Array, startOffset: number): ParseResult<Menu> {
    var offset = startOffset;
    const sectionResult = parseFunction(buffer, offset, SectionTypeMarkers.MENU);
    offset = sectionResult.offset;
    const items: MenuItem[] = [];

    while (buffer[offset] === SectionTypeMarkers.MENU_ITEM) {
        const itemResult = parseFunction(buffer, offset, SectionTypeMarkers.MENU_ITEM);
        offset = itemResult.offset;
        const item: MenuItem = {
            ...itemResult.result,
            key: itemResult.result.flags as MenuKey,
            label: itemResult.result.arg1!
        }
        items.push(item);
    }
    const result: Menu =  {
        ...sectionResult.result,
        items
    };
    return {
        result,
        offset
    }
}
