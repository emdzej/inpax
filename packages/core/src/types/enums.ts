/**
 * IPO Value Types
 */
export enum ValueType {
    Void = 0x00,
    Bool = 0x01,
    Byte = 0x02,
    Int = 0x03, // s16
    Long = 0x04, // s32
    Real = 0x05, // f64
    String = 0x06,
    Handle1 = 0x07,
    Handle2 = 0x08,
    Handle3 = 0x09,
}

/**
 * IPO Block Types
 */
export enum BlockType {
    Screen = 0x01,
    Menu = 0x02,
    StateMachine = 0x03,
    LogicTable = 0x04,
    Function = 0x05,
    GlobalData = 0x11,
    ConstantData = 0x12,
    ScreenFunc = 0x21,
    LineFunc = 0x22,
    ControlFunc = 0x23,
    MenuItemFunc = 0x24,
    StateFunc = 0x25,
}

/**
 * VM Opcodes
 * Based on docs/opcode-reference.md and research/opcode-mappings.md
 */
export enum Opcode {
    LOAD = 0x01,
    PUSHREF = 0x02,
    LOADINOUTREF = 0x03,
    NOP = 0x04,          // was CAST
    MOVE = 0x05,
    PUSHR = 0x06,
    PUSHREFSTORE = 0x07,
    ALLOC = 0x08,        // was JMP - allocate local variable
    ALU = 0x09,          // was JMPZ - arithmetic/logic operations
    JMP = 0x0a,          // was JMPNZ - unconditional jump
    JMPNZ = 0x0b,        // was ALU - conditional jump (if not zero)
    CALL = 0x0c,
    CALLE = 0x0d,        // was IMPORT32 - external DLL call
    RET = 0x0e,
    FRAME = 0x0f,
    LOGTABLE = 0x10,     // was POP - logic table lookup
    PUSHIMM = 0x11,      // was PUSHCONST - push immediate value
}

/**
 * ALU Operations
 */
export enum AluOp {
   ADD = 0x60,
    SUB = 0x61,
    MUL = 0x62,
    DIV = 0x63,
    LT = 0x64,
    GT = 0x65,
    LE = 0x66,
    GE = 0x67,
    EQ = 0x68,
    NE = 0x69,
    AND = 0x6A,
    OR = 0x6B,
    XOR = 0x6C,
    NEG = 0x6D,
    NOT = 0x6E,
    BAND = 0x6F,
    BOR = 0x70,
    BXOR = 0x71
}



/**
 * Variable Scope
 */
export enum Scope {
    Global = 0x00,
    Const = 0x01,
    Local = 0x02,
    Screen = 0x40,
    Menu = 0x41,
    StateMachine = 0x42
}

/**
 * Call Target Type
 */
export enum CallTarget {
    UserFunction = 0x80,
    SystemFunction = 0x81,
}

/**
 * Type markers in bytecode (for CAST)
 */
export enum TypeMarker {
    Bool = 0x50,
    Int = 0x51,
    Byte = 0x52,
    Long = 0x53,
    Real = 0x54,
    String = 0x55,
    Handle1 = 0x56,
    Handle2 = 0x57,
}
