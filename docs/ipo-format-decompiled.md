# IPO File Format - Decompilation Analysis

Technical documentation of the IPO binary format based on INPA.exe decompilation analysis.

## File Structure Overview

```
┌─────────────────────────────────────┐
│           File Header               │
│  [version:2] [magic:14] [0x0A]      │
├─────────────────────────────────────┤
│         Block Sequence              │
│  ┌─────────────────────────────┐   │
│  │ Block Header                │   │
│  │ Block Data                  │   │
│  └─────────────────────────────┘   │
│  ... (more blocks) ...              │
└─────────────────────────────────────┘
```

Files are parsed **sequentially** - there is no lookup table or block index.

---

## File Header

### Binary Layout

| Offset | Size | Field | Description |
|--------|------|-------|-------------|
| 0x00 | 1 | version_hi | Version byte 1 |
| 0x01 | 1 | version_lo | Version byte 2 |
| 0x02 | 14 | magic | `TEST-Infotext` |
| 0x10 | 1 | separator | `0x0A` (newline) |

### Validation (from `FUN_00463162`)

```c
void validate_header(void* ctx, char* magic_str) {
    // Read version bytes into ctx+0x404, ctx+0x405
    if (DAT_0049b8c4 == 0) {
        ctx->version_hi = DAT_0049f694;  // From config
        ctx->version_lo = DAT_0049f698;
    } else {
        ctx->version_hi = 4;
        ctx->version_lo = 4;
    }
    
    // Store magic string at ctx+0x406
    strcpy(ctx + 0x406, magic_str);
}
```

### Write Header (from `FUN_004631dd`)

```c
int write_header(void* ctx, char* header) {
    buffer[0] = header[0];           // version_hi
    buffer[1] = header[1];           // version_lo
    strcpy(buffer + 2, header + 2);  // magic string
    
    int len = strlen(header + 2);
    buffer[len + 2] = 0x0A;          // terminator
    
    return fwrite(buffer, 1, len + 3, file);
}
```

### Known Version Combinations

| version_hi | version_lo | Notes |
|------------|------------|-------|
| 0x05 | 0x00 | Common in newer files |
| 0x01 | 0x02 | Older format |
| 0x01 | 0x03 | Alternative format |
| 0x04 | 0x04 | Debug/test mode |

---

## Block Header

### Binary Layout (from `FUN_0046332b`, `FUN_004634d1`)

```c
struct BlockHeader {
    uint8_t  type;           // Block type ID
    char     name[];         // Variable-length, 0x0A terminated
    uint16_t block_id;       // Unique ID within type
    uint16_t flags;          // Block-specific flags
    char     arg1[];         // Optional argument 1, 0x0A terminated
    char     arg2[];         // Optional argument 2, 0x0A terminated  
    uint8_t  marker;         // Usually 0x00, sometimes 0x01
    uint16_t size;           // Data size (interpretation varies)
};
```

### Internal Structure (offset in IPO parser context at `0x4a4688`)

| Offset | Field | Set by |
|--------|-------|--------|
| +0x400 | file_handle | `FUN_0046230c` |
| +0x404 | version_hi | `FUN_00463162` |
| +0x405 | version_lo | `FUN_00463162` |
| +0x406 | magic_string | `FUN_00463162` |
| +0x458 | block_type | `FUN_00463274` |
| +0x45a | block_id | `FUN_00463274` |
| +0x45c | block_name | `FUN_00463274` |
| +0x460 | flags | `FUN_00463274` |
| +0x464 | arg1 | `FUN_00463274` |
| +0x468 | arg2 | `FUN_00463274` |
| +0x46c | marker | `FUN_00463274` |
| +0x470 | size | `FUN_004632eb` |
| +0x474 | filename | `FUN_0046230c` |

### Block Header Write (from `FUN_0046332b`)

```c
int write_block_header(void* ctx) {
    char buffer[512];
    int pos = 0;
    
    buffer[pos++] = ctx->block_type;         // +0x458
    strcpy(buffer + pos, ctx->block_name);   // +0x45c
    pos += strlen(ctx->block_name);
    buffer[pos++] = 0x0A;                    // name terminator
    
    *(uint16_t*)(buffer + pos) = ctx->block_id;   // +0x45a
    pos += 2;
    *(uint16_t*)(buffer + pos) = ctx->flags;      // +0x460
    pos += 2;
    
    strcpy(buffer + pos, ctx->arg1);         // +0x464
    pos += strlen(ctx->arg1);
    buffer[pos++] = 0x0A;                    // arg1 terminator
    
    strcpy(buffer + pos, ctx->arg2);         // +0x468
    pos += strlen(ctx->arg2);
    buffer[pos++] = 0x0A;                    // arg2 terminator
    
    buffer[pos++] = (ctx->marker == 1);      // +0x46c
    *(uint16_t*)(buffer + pos) = ctx->size;  // +0x470
    pos += 2;
    
    return fwrite(buffer, 1, pos, file);
}
```

---

## Block Types

### Known Block Types (from case statements)

| Type | Name | Purpose | Data Format |
|------|------|---------|-------------|
| 0x01 | SCREEN | Screen definition | Children blocks |
| 0x02 | MENU | Menu definition | Children blocks |
| 0x03 | STATEMACHINE | State machine | Children blocks |
| 0x04 | LOGICTABLE | Logic table | Unknown |
| 0x05 | FUNCTION | User function | Instruction array |
| 0x11 | GLOBALDATA | Global variables | Type array |
| 0x12 | CONSTANTDATA | Constants | Typed value array |
| 0x21 | SCREEN_FUNC | Screen init function | Instruction array |
| 0x22 | LINE_FUNC | Line function | Instruction array |
| 0x23 | CONTROL_FUNC | Control function | Instruction array |
| 0x24 | MENUITEM_FUNC | Menu item function | Instruction array |
| 0x25 | STATE_FUNC | State function | Instruction array |

### Required Blocks

Every IPO file contains:

| Block ID | Name | Required |
|----------|------|----------|
| 0x00 | `__inpa_startup__` | Auto-generated |
| 0x01 | `__inpa_shutdown__` | Auto-generated |
| 0x02 | `inpainit` | User-defined |
| 0x03 | `inpaexit` | User-defined |
| — | `Global Data` (0x11) | Always present |
| — | `Constant Data` (0x12) | Always present |

---

## Variable Types

### Type IDs (from `FUN_004627a4`, `FUN_0046365a`)

| ID | Type | Storage Size | Description |
|----|------|--------------|-------------|
| 0 | void | 1 byte | Placeholder (globals only) |
| 1 | bool | 1 byte | Boolean (0/1) |
| 2 | byte | 1 byte | Unsigned 8-bit |
| 3 | int | 2 bytes | Signed 16-bit (little-endian) |
| 4 | long | 4 bytes | Signed 32-bit (little-endian) |
| 5 | real | 8 bytes | IEEE-754 double (little-endian) |
| 6 | string | variable | 0x0A terminated |
| 7 | handle | 4 bytes | UI handle type 1 |
| 8 | handle2 | 4 bytes | UI handle type 2 |
| 9 | handle3 | 4 bytes | UI handle type 3 |

### Stack Entry Structure (from `FUN_0045dac6`)

```c
struct StackEntry {
    int32_t type;       // +0x00: Type ID (1-9)
    int32_t flags;      // +0x04: 1=value, 2=reference
    union {             // +0x08: Value storage
        int8_t   bool_val;
        uint8_t  byte_val;
        int16_t  int_val;
        int32_t  long_val;
        double   real_val;   // Uses +0x08 and +0x0C
        char*    string_ptr;
    };
    int32_t ref_info;   // +0x10: Reference info
};
```

---

## Global Variables Block (0x11)

### Format

```
[block_header]
[type_1:u8] [type_2:u8] ... [type_n:u8]
```

**Size** in header = number of variables (including implicit void at index 0).

### Parsing (from `FUN_004627a4` with param_1=0)

```c
void parse_globals(void* ctx, int count) {
    for (int i = 0; i < count; i++) {
        uint8_t type;
        fread(&type, 1, 1, file);
        
        // Initialize variable with default value
        StackEntry entry;
        entry.type = type;
        entry.flags = 1;  // by-value
        
        switch (type) {
            case 1: entry.value.bool_val = 0; break;
            case 2: entry.value.byte_val = 0; break;
            case 3: entry.value.int_val = 0; break;
            case 4: entry.value.long_val = 0; break;
            case 5: entry.value.real_val = 0.0; break;
            case 6: entry.value.string_ptr = ""; break;
            case 7:
            case 8:
            case 9: entry.value.long_val = 0; break;
        }
        
        add_to_global_pool(entry);
    }
}
```

### Example

```
; 2 globals: void (implicit) + int
11                              ; Block type
47 6C 6F 62 61 6C 20 44 61 74 61 ; "Global Data"
0A                              ; Separator
00 00                           ; Block ID = 0
00 00                           ; Flags = 0
0A                              ; Arg1 (empty)
0A                              ; Arg2 (empty)
00                              ; Marker
02 00                           ; Size = 2 (variables)
00 03                           ; Types: void, int
```

---

## Constants Block (0x12)

### Format

```
[block_header]
[constant_1] [constant_2] ... [constant_n]
```

Each constant is:
```
[type:u8] [value:variable]
```

**Size** in header = number of constants.

### Parsing (from `FUN_004627a4` with param_1=1)

```c
void parse_constants(void* ctx, int count) {
    for (int i = 0; i < count; i++) {
        uint8_t type;
        fread(&type, 1, 1, file);
        
        StackEntry entry;
        entry.type = type;
        
        switch (type) {
            case 1:  // bool
                fread(&entry.value.bool_val, 1, 1, file);
                break;
            case 2:  // byte
                fread(&entry.value.byte_val, 1, 1, file);
                break;
            case 3:  // int (s16)
                fread(&entry.value.int_val, 2, 1, file);
                break;
            case 4:  // long (s32)
                fread(&entry.value.long_val, 4, 1, file);
                break;
            case 5:  // real (f64)
                fread(&entry.value.real_val, 8, 1, file);
                break;
            case 6:  // string
                read_until_0A(file, &entry.value.string_ptr);
                break;
            case 7:
            case 8:
            case 9:  // handles
                fread(&entry.value.long_val, 4, 1, file);
                break;
        }
        
        add_to_constant_pool(entry);
    }
}
```

### Writing Constants (from `FUN_0046365a`)

```c
void write_constant(void* ctx, StackEntry* entry) {
    uint8_t buffer[256];
    uint32_t size = 0;
    
    buffer[0] = (uint8_t)entry->type;
    
    switch (entry->type) {
        case 1:  // bool
            buffer[1] = (entry->value.long_val == 1);
            size = 2;
            break;
        case 2:  // byte
            buffer[1] = (uint8_t)entry->value.long_val;
            size = 2;
            break;
        case 3:  // int
            *(int16_t*)(buffer + 1) = (int16_t)entry->value.long_val;
            size = 3;
            break;
        case 4:  // long
            *(int32_t*)(buffer + 1) = entry->value.long_val;
            size = 5;
            break;
        case 5:  // real
            *(double*)(buffer + 1) = entry->value.real_val;
            size = 9;
            break;
        case 6:  // string
            strcpy((char*)(buffer + 1), entry->value.string_ptr);
            int len = strlen(entry->value.string_ptr);
            buffer[1 + len] = 0x0A;
            size = len + 2;
            break;
        case 7:  // handle
            *(int32_t*)(buffer + 1) = entry->value.long_val;
            size = 5;
            break;
    }
    
    fwrite(buffer, 1, size, file);
}
```

### Example

```
; Constants: int 1000, string "test"
12                                    ; Block type
43 6F 6E 73 74 61 6E 74 20 44 61 74 61 ; "Constant Data"
0A 00 00 00 00 0A 0A 00
02 00                                 ; Size = 2 constants
03 E8 03                              ; int: 0x03E8 = 1000
06 74 65 73 74 0A                     ; string: "test" + 0x0A
```

---

## Function Blocks (0x05, 0x21-0x25)

### Format

```
[block_header]
[instruction_1:4] [instruction_2:4] ... [instruction_n:4]
```

**Size** in header = number of 4-byte instructions.

### Block Type Specifics

| Type | Name Field | Arg1 | Arg2 |
|------|------------|------|------|
| 0x05 | Function name | — | — |
| 0x21 | Parent screen | — | — |
| 0x22 | Parent line | Line name | — |
| 0x23 | Parent control | Control ID | — |
| 0x24 | Parent menu | Item name | — |
| 0x25 | Parent state | State name | — |

### Instruction Format

```
[opcode:u8] [operand1:u8] [operand2:u16 LE]
```

See `opcode-reference.md` for complete instruction set.

### Minimum Function

Empty functions contain single RET instruction:
```
0E 00 00 00    ; RET
```

---

## Screen Block (0x01)

### Format

```
[block_header]
[line_block_1]
[line_block_2]
...
[screen_function_block]  ; Type 0x21
```

### Args

- **name**: Screen identifier
- **arg1**: Empty
- **arg2**: Empty

### Children

- LINE blocks (nested)
- SCREEN_FUNC block (0x21) with init code

---

## Menu Block (0x02)

### Format

```
[block_header]
[menuitem_block_1]
[menuitem_block_2]
...
```

### Args

- **name**: Menu identifier
- **arg1**: Menu title (displayed)
- **arg2**: Empty

### Menu Item Flags

| Bits | Meaning |
|------|---------|
| 0x00-0xFF | Keyboard shortcut |

---

## State Machine Block (0x03)

### Format

```
[block_header]
[state_block_1]
[state_block_2]
...
```

### State Children (0x25)

Each state contains:
- on_enter function
- on_timer function
- on_exit function

---

## String Encoding

### 0x0A Terminator

All strings in IPO files are terminated with `0x0A` (newline), not `0x00`:

```c
// Reading string until 0x0A (from FUN_0044876c)
char* read_string(FILE* f, int max_len) {
    char* buffer = malloc(max_len);
    int pos = 0;
    
    while (pos < max_len - 1) {
        int c = fgetc(f);
        if (c == EOF || c == 0x0A) break;
        buffer[pos++] = c;
    }
    buffer[pos] = '\0';
    
    return buffer;
}
```

### Embedded Newlines

Real newlines within strings use escape sequences (`\n`) in source, stored as literal `0x0A` in constants causes issues - avoid.

---

## Parsing Flow

### Main Parse Loop (conceptual from `FUN_00457594`)

```c
void parse_ipo(const char* filename) {
    FILE* f = fopen(filename, "rb");
    
    // 1. Validate header
    if (!validate_magic(f, "TEST-Infotext")) {
        error("Invalid IPO file");
    }
    
    // 2. Parse blocks sequentially
    while (!feof(f)) {
        BlockHeader header;
        if (!read_block_header(f, &header)) break;
        
        switch (header.type) {
            case 0x11:  // Global Data
                parse_globals(f, header.size);
                break;
            case 0x12:  // Constant Data  
                parse_constants(f, header.size);
                break;
            case 0x05:  // Function
                parse_function(f, &header);
                break;
            case 0x01:  // Screen
                parse_screen(f, &header);
                break;
            case 0x02:  // Menu
                parse_menu(f, &header);
                break;
            case 0x03:  // State Machine
                parse_statemachine(f, &header);
                break;
            case 0x21:
            case 0x22:
            case 0x23:
            case 0x24:
            case 0x25:
                parse_sub_function(f, &header);
                break;
            default:
                skip_block(f, &header);
        }
    }
    
    fclose(f);
}
```

---

## Error Codes

From `FUN_0045d573` calls during parsing:

| Code | Meaning |
|------|---------|
| 0x12D | Invalid variable type in globals |
| 0x12E | Invalid constant type |
| 0x133 | Global data block error |
| 0x134 | Constant data block error |
| 0x135 | Invalid block type |
| 0x136 | Unexpected EOF |
| 0x194 | Invalid function reference |
| 300 | File format error |

---

## Key Functions Reference

| Address | Function | Purpose |
|---------|----------|---------|
| `FUN_0046230c` | Open IPO file | Opens file, validates extension |
| `FUN_00463162` | Setup magic | Sets version and magic string |
| `FUN_004631dd` | Write header | Writes file header |
| `FUN_00463274` | Set block params | Configures block header fields |
| `FUN_0046332b` | Write block header | Writes block header to file |
| `FUN_004624f3` | Read block header | Reads block header from file |
| `FUN_004627a4` | Parse variables | Parses globals (0) or constants (1) |
| `FUN_0046365a` | Write variables | Writes globals or constants |
| `FUN_00462436` | Check EOF | Returns EOF status |
| `FUN_004623cb` | Close file | Closes IPO file handle |

---

## Memory Layout

### Parser Context (`DAT_004a4688`)

```
+0x000 - +0x3FF: Working buffer (1024 bytes)
+0x400: FILE* handle
+0x404: version_hi
+0x405: version_lo
+0x406: magic_string[64]
+0x458: current_block_type
+0x45a: current_block_id
+0x45c: current_block_name[64]
+0x460: current_flags
+0x464: current_arg1[64]
+0x468: current_arg2[64]
+0x46c: current_marker
+0x470: current_size
+0x474: filename[260]
```

### Variable Pools

| Address | Pool | Description |
|---------|------|-------------|
| `DAT_004a42cc` | Globals | Global variable storage |
| `DAT_004a430c` | Constants | Constant value storage |
| `DAT_0049ff18` | Context | Execution context (functions, etc.) |

---

*Based on INPA.exe Ghidra decompilation analysis*
