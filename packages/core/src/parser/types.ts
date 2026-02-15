import { getKeyByValue } from "./utils.js";

export const SEPARATOR = 0x0A;

export const DataTypeMarkers = {
    VOID: 0x00,
    BOOL: 0x01,
    BYTE: 0x02,
    INT: 0x03,
    LONG: 0x04,
    REAL: 0x05,
    STRING: 0x06
} as const;

export type DataTypeMarker = (typeof DataTypeMarkers)[keyof typeof DataTypeMarkers];

export function getDataTypeName(marker: DataTypeMarker): string {
    return getKeyByValue(DataTypeMarkers, marker)?.toLowerCase()
        ?? `Unknown(0x${marker.toString(16)})`;
}

export const SectionTypeMarkers = {
    SCREEN: 0x01,
    MENU: 0x02,
    STATE_MACHINE: 0x03,
    LOGIC_TABLE: 0x04,
    FUNCTION: 0x05,
    GLOBAL_VARIABLES: 0x11,
    CONSTANTS: 0x12,
    SCREEN_FUNCTION: 0x21,
    SCREEN_LINE_FUNCTION: 0x22,
    SCREEN_LINE_CONTROL_FUNCTION: 0x23,
    MENU_ITEM: 0x24,
    STATE_MACHINE_STATE_FUNCTION: 0x25
};

export type SectionTypeMarker = (typeof SectionTypeMarkers)[keyof typeof SectionTypeMarkers];

export function getSectionTypeName(marker: SectionTypeMarker): string {
    return getKeyByValue(SectionTypeMarkers, marker)?.toLowerCase()
        ?? `Unknown(0x${marker.toString(16)})`;
}

export type FileSection = {
    readonly offset: number;
}

export type FileHeader = FileSection & {
    readonly version: readonly [number, number];
    readonly magic: string;
};

export type SectionHeader = FileSection & {
    readonly type: SectionTypeMarker;
    readonly name?: string;
    readonly id: number;
    readonly flags: number;
    readonly size: number;
    readonly arg1?: string;
    readonly arg2?: string;
}

export type GlobalData = SectionHeader & {
    readonly variables: readonly DataTypeMarker[];
};

export type Constant =
    | { readonly type: 0x00; readonly value: void; readonly offset: number }
    | { readonly type: 0x01; readonly value: boolean; readonly offset: number }
    | { readonly type: 0x02; readonly value: number; readonly offset: number }
    | { readonly type: 0x03; readonly value: number; readonly offset: number }
    | { readonly type: 0x04; readonly value: number; readonly offset: number }
    | { readonly type: 0x05; readonly value: number; readonly offset: number }
    | { readonly type: 0x06; readonly value: string; readonly offset: number }

export type ConstantData = SectionHeader & {
    readonly constants: readonly Constant[];
};

export type Instruction = {
    readonly offset: number;
    readonly raw: Uint8Array<ArrayBuffer>;
};

export type UserFunction = SectionHeader & {
    readonly instructions: readonly Instruction[];
}

export type ScreenFunction = UserFunction;

export type ScreenLineControlFunction = UserFunction;

export type ScreenLine = UserFunction & {
    readonly selectName?: string;
    readonly apiResultParameters?: string;
    readonly control?: ScreenLineControlFunction;
}

export type Screen = UserFunction & {
    readonly function: ScreenFunction;
    readonly lines: readonly ScreenLine[];
}

export const MenuKeys = {
    F1: 1,
    F2: 2,
    F3: 3,
    F4: 4,
    F5: 5,
    F6: 6,
    F7: 7,
    F8: 8,
    F9: 9,
    F10: 10,
    SHIFT_F1: 11,
    SHIFT_F2: 12,
    SHIFT_F3: 13,
    SHIFT_F4: 14,
    SHIFT_F5: 15,
    SHIFT_F6: 16,
    SHIFT_F7: 17,
    SHIFT_F8: 18,
    SHIFT_F9: 19,
    SHIFT_F10: 20
} as const;

export type MenuKey = (typeof MenuKeys)[keyof typeof MenuKeys];

export function getMenuKeyName(key: MenuKey): string {
    return getKeyByValue(MenuKeys, key) ?? `Unknown(0x${key.toString(16)})`;
}

export type MenuItem = UserFunction & {
    readonly key: MenuKey;
    label: string;
}

export type Menu = UserFunction & {
    readonly items: readonly MenuItem[];
};

export type LogicTableEntry = {
    readonly input: number;
    readonly mask: number;
    readonly output: number;
};

export type LogicTable = SectionHeader & {
    readonly entries: readonly LogicTableEntry[];
};

export type State = UserFunction & {
}

export type StateMachine = UserFunction & {
    readonly states: readonly State[];
}


export type Opcode =
    | "PUSH_VAR_ADDR"
    | "PUSH_VAR_VAL"
    | "PUSH_CONST"
    | "STORE"
    | "ALU_OP"
    | "JMP_FALSE"
    | "JMP"
    | "CALL_USER"
    | "CALL_API"
    | "PUSH_UI_HANDLE"
    | "SCREEN_START"
    | "LINE"
    | "CONTROL" // Confirmed: 0x23 - CONTROL block marker (issue #60)
    | "ITEM"
    | "STATE"
    | "FUNC_PROLOGUE" // 08 51 00 00 - function entry marker (issue #67)
    | "UNKNOWN";

export type VariableScope = "global" | "local" | "param";

export type InpaFile = {
    readonly buffer: Uint8Array;
    readonly header: FileHeader;
    readonly functions: readonly UserFunction[];
    readonly screens?: readonly Screen[];
    readonly menus?: readonly Menu[];
    readonly stateMachines?: readonly StateMachine[];
    readonly logicTables?: readonly LogicTable[];
    readonly globals: GlobalData;
    readonly constants: ConstantData;
};

export type ParseResult<T> = {
    readonly result: T;
    readonly offset: number;
};

export type ParseFunction<T extends SectionHeader> = (buffer: Uint8Array, startOffset: number) => ParseResult<T>;
export const OpCodes = {
    PUSHV: 0x01,
    STOR: 0x05,
    PUSHT: 0x06,
    ALLOC: 0x08,
    ALU: 0x09,
    CALL: 0x0C,
    CALLE: 0x0D,
    RET: 0x0E,
    FRAME: 0x0F,
} as const;

export type OpCode = typeof OpCodes[keyof typeof OpCodes];

export const AluOpCode = {
    ADD: 0x60,
    SUB: 0x61,
    MUL: 0x62,
    DIV: 0x63,
    LT: 0x64,
    GT: 0x65,
    LE: 0x66,
    GE: 0x67,
    EQ: 0x68,
    NE: 0x69,
    AND: 0x6A,
    OR: 0x6B,
    NOT: 0x6E,
} as const;

export type AluOpCode = typeof AluOpCode[keyof typeof AluOpCode];

export function getOpCodeName(opcode: OpCode): string {
    return getKeyByValue(OpCodes, opcode) ?? `Unknown(0x${opcode.toString(16)})`;
}
