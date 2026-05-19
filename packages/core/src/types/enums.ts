/**
 * IPO Value Types — canonical v5.x / v4.4 vocabulary.
 *
 * Verified against INPA.exe's type-name table at `FUN_0046456b` and
 * its constants reader at `FUN_00463bd7`. See
 * `docs/ipo-format-versions.md` for the reverse-engineering notes.
 *
 * Older `Handle1` / `Handle2` / `Handle3` names (used for slots
 * `0x07` / `0x08` / `0x09` before 2026-05) were wrong — the actual
 * type names INPA uses internally are `ULONG`, `NUMERIC`, `OBJECT`.
 * They are not opaque handles.
 *
 * `Numeric` is special: it's a 4-byte numeric value the runtime can
 * coerce through ASCII-LONG conversion (see `TryConversion from both
 * ASCII-LONG` MessageBoxA path at `INPA.exe!FUN_0045ffdc`).
 *
 * v1.x scripts (NCSEXPERT) use a different, smaller type-byte
 * vocabulary that doesn't map cleanly onto this enum — those are
 * decoded via a version-conditional parser path. Don't reuse this
 * enum for v1.x type bytes.
 */
export enum ValueType {
    Void = 0x00,
    Bool = 0x01,
    Byte = 0x02,
    Int = 0x03,     // s16 LE
    Long = 0x04,    // s32 LE
    Real = 0x05,    // f64 LE
    String = 0x06,  // newline-terminated, max 1023 bytes
    ULong = 0x07,   // u32 LE
    Numeric = 0x08, // 4 bytes, ASCII-LONG coercible
    Object = 0x09,
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
 * Type markers in bytecode (for ALLOC/PUSHIMM opcodes).
 *
 * Verified against INPA.exe's TypeMarker→ValueType mapper at
 * `FUN_00460f29`. Used by:
 *   - ALLOC (opcode 0x08): all eight markers initialize a local var
 *   - PUSHIMM (opcode 0x11): only 0x50–0x53 (the inline-byte forms)
 *
 * Note: there is no marker for `Numeric` (ValueType 8). NUMERIC values
 * arrive from constants/loads and are coerced to BOOL/BYTE/INT/LONG
 * via `FUN_0045ffdc` → `FUN_0046014a` at load time, before the ALU
 * dispatcher sees them. INPA.exe's CAST opcode (originally 0x04) is a
 * no-op — type coercion happens through these markers and the
 * load-time NUMERIC path, not via an explicit CAST opcode.
 */
export enum TypeMarker {
    Bool = 0x50,
    Int = 0x51,
    Byte = 0x52,
    Long = 0x53,
    Real = 0x54,
    String = 0x55,
    Object = 0x56,
    ULong = 0x57,
}
