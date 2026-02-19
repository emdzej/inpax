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
    readonly dataOffset?: number;
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
    readonly raw: Buffer;
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

export const VariableScopes = {
    GLOBAL : 0x00,
    CONST: 0x01,
    LOCAL: 0x02,
    SCREEN_HANDLE: 0x40,
    MENU_HANDLE: 0x41,
    STATE_MACHINE_HANDLE: 0x42,
} as const;

export type VariableScope = (typeof VariableScopes)[keyof typeof VariableScopes];

export type InpaFile = {
    readonly buffer: Buffer;
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
    STOREREF: 0x02,
    LOADINOUTREF: 0x03,
    MOV: 0x05,
    LOADREF: 0x06,
    LOADOUTREF: 0x07,
    ALLOC: 0x08,
    ALU: 0x09,
    JMP: 0x0A,
    CALL: 0x0C,
    JMPNZ: 0x0B,
    CALLEXT: 0x0D,
    RET: 0x0E,
    FRAME: 0x0F, // cllear stack?
} as const;

export type OpCode = typeof OpCodes[keyof typeof OpCodes];

export const AluOpCodes = {
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
    XOR: 0x6C,
    NEG: 0x6D,
    NOT: 0x6E,
    BAND: 0x6F,
    BOR: 0x70,
    BXOR: 0x71
} as const;

export type AluOpCode = typeof AluOpCodes[keyof typeof AluOpCodes];

export const CallScopes = {
    USER: 0x80,
    SYSTEM: 0x81
} as const;

export type CallScope = typeof CallScopes[keyof typeof CallScopes];

export const AllocTypes = {
    BOOL : 0x50,
    INT: 0x51,
    BYTE: 0x52,
    LONG: 0x53,
    REAL: 0x54,
    STRING: 0x55
} as const;

export type AllocType = typeof AllocTypes[keyof typeof AllocTypes];

export const varSymbol = Symbol("variable");

export type Variable =
    { [varSymbol]: true, readonly type: 0x01; value?: boolean}
    | { [varSymbol]: true, readonly type: 0x02; value?: number }
    | { [varSymbol]: true, readonly type: 0x03; value?: number }
    | { [varSymbol]: true, readonly type: 0x04; value?: number }
    | { [varSymbol]: true, readonly type: 0x05; value?: number }
    | { [varSymbol]: true, readonly type: 0x06; value?: string }

export function newVariable(type: DataTypeMarker, value?: boolean | number | string): Variable {
    return { [varSymbol]: true, type, value } as Variable;
}

export function isVariable(obj: unknown): obj is Variable {
  return typeof obj === "object" && obj !== null && varSymbol in obj;
}

export function isVariableOfType<T extends Variable>(obj: Variable, type: DataTypeMarker) {
    return obj.type === type;
}


