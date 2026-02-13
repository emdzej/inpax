import std.io;
import std.mem;

enum Terminator: u8 {
    Terminator = 0x0a
};

enum BlockType: u8 {
    Screen = 0x01,
    Menu = 0x02,
    StateMachine = 0x03,
    LogTable = 0x04,
    Function = 0x05,
    Globals  = 0x11,
    Constants = 0x12,
    ScreenBody = 0x21,
    ScreenLine = 0x22,
    Control = 0x23,
    StateBody = 0x25
};

enum VarType: u8 {
    Void = 0x00,
    Bool = 0x01,
    Byte = 0x02,
    Int = 0x03,
    Long = 0x04,
    Real = 0x05,
    String = 0x06
};

struct FileHeader {
    u16 version;
    char name[while(std::mem::read_unsigned($, 1) != 0x0a)];
    Terminator marker; 
};



struct GlobVar {
    VarType type;
};

using VoidConst;
using BoolConst;
using ByteConst;
using IntConst;
using LongConst;
using RealConst;
using StringConst;

struct Const {
    VarType type;
    if (type == 0x00) {
        VoidConst value;
    }
    if (type == 0x01) {
        BoolConst value;
    }
    if (type == 0x02) {
        ByteConst value;
    }
    if (type == 0x03) {
        IntConst value;
    }
    if (type == 0x04) {
        LongConst value;
    }
    if (type == 0x05) {
        RealConst value;
    }
    if (type == 0x06) {
        StringConst value;
    }
};

enum Void: u8 {
    Void = 0x00
};

struct VoidConst {
    Void value; 
};

struct BoolConst {
    u8 value;
};

struct ByteConst {
    u8 value;
};

struct IntConst {
    s16 value;
};

struct LongConst {
    s32 value;
};

struct RealConst {
    double value;
};

struct StringConst {
    char value[while(std::mem::read_unsigned($, 1) != 0x0a)];
    Terminator terminator;
};

struct Block {
    BlockType type;
    char name[while(std::mem::read_unsigned($, 1) != 0x0a)];
    u8 marker_1; // 0x0a
    u16 block_id;
    u16 flags;
    char arg1[while(std::mem::read_unsigned($, 1) != 0x0a)];
    u8 argseparator1; // = 0x0a;
    char arg2[while(std::mem::read_unsigned($, 1) != 0x0a)];
    u8 argseparator2; // = 0x0a;
    u8 marker_2; // = 0x00
    u16 size;
};

struct Instr {
    u8 b1;
    u8 b2;
    u8 b3;
    u8 b4;
};



struct Function : Block {
    // type = 0x05  
    Instr code[size];    
};

struct Constants : Block {
    // type = 0x12
    Const values[size];
};

struct Globals : Block {
    // type = 0x11
    GlobVar vars[size];
};

struct LogTabEntry {
    u32 input;
    u32 mask;
    u32 value;
};

struct LogTab: Block {
// type = 0x04
LogTabEntry entries[size];
};

struct Control: Function {
    // type = 0x23;    
};

struct ScreenLine {
    //type 0x22
    if (std::mem::read_unsigned($, 1) != 0x22) {
        break;
    } 
    Function body;
    if (std::mem::read_unsigned($, 1) == 0x23) {
        Control control;
    }      
};



struct ScreenBody: Function {
    // type -0x21    
};

struct Screen : Block {
// type = 0x01
   ScreenBody body;
   ScreenLine lines[while(true)];    
};

struct MenuItem {
    // type = 0x24
    if (std::mem::read_unsigned($, 1) != 0x24) {
        break;
    }
    Function body;
};

struct Menu: Function {
    // type = 0x02
    MenuItem items[while(true)];
};

struct File {
    FileHeader header;
    //Block blocks[];
};

Screen s2 @ 0x50;

Screen s1 @ 0x70;

File file @ 0x00;File file @ 0x00;