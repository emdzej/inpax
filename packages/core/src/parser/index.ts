import {
    ConstantData, GlobalData, LogicTable, Menu, Screen,
    SectionTypeMarkers, StateMachine, UserFunction, type InpaFile
} from "./types.js";
import { parseFileHeader } from "./file-header.js";
import { parseSections } from "./sections.js";

export type {
    Constant,
    ConstantData,
    GlobalData,
    VariableScope
} from "./types.js";

export const parseInpaFile = (buffer: Buffer): InpaFile => {
    const header = parseFileHeader(buffer);
    const sections = parseSections(buffer, header.result.offset);

    const globalData = sections.find(s => s.type === SectionTypeMarkers.GLOBAL_VARIABLES);
    const constants = sections.find(s => s.type === SectionTypeMarkers.CONSTANTS);
    const functions = sections.filter(s => s.type === SectionTypeMarkers.FUNCTION);
    const screens = sections.filter(s => s.type === SectionTypeMarkers.SCREEN);
    const menus = sections.filter(s => s.type === SectionTypeMarkers.MENU);
    const stateMachines = sections.filter(s => s.type === SectionTypeMarkers.STATE_MACHINE);
    const logicTables = sections.filter(s => s.type === SectionTypeMarkers.LOGIC_TABLE);

    return {
        header: header.result,
        globals: globalData as GlobalData,
        functions: functions as UserFunction[] || [],
        screens: screens as Screen[] || [],
        menus: menus as Menu[] || [],
        stateMachines: stateMachines as StateMachine[] || [],
        logicTables: logicTables as LogicTable[] || [],
        constants: constants as ConstantData
    };
};
