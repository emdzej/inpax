# INPA .ipo File Format Specification

This document is the specification for the `.ipo` binary format based on reverse-engineering research.

## Table of Contents

- [Overview](#overview)
- [File Header](#file-header)
  - [Structure](#structure)
  - [Header Variants](#header-variants)
- [Blocks](#blocks)
  - [Block Structure](#block-structure)
  - [Known Block Types](#known-block-types)
  - [Variable Types](#variable-types)
  - [Global Variables](#global-variables)
  - [Constants](#constants)
  - [Functions](#functions)
  - [Screen](#screen)
  - [Menu](#menu)
  - [State Machine](#state-machine)
  - [Logic Table](#logic-table)
- [Opcode Reference](#opcode-reference)
  - [Core Opcodes](#core-opcodes)
  - [Function Call Opcodes](#function-call-opcodes)
  - [ALU Operations](#alu-operations-00-09-op)
  - [Index Encoding](#index-encoding)
  - [Handle Format](#handle-format-opcode-0x02)
- [System Functions](#system-functions)
  - [Complete Mapping](#complete-mapping-159-functions)
- [Import32 / DLL Calls](#import32--dll-calls)
  - [Source Syntax](#source-syntax)
  - [Binary Format](#binary-format)
  - [16-bit vs 32-bit Differences](#16-bit-vs-32-bit-differences)
  - [Examples from Production Files](#examples-from-production-files)
  - [Signature Decoding](#signature-decoding)
  - [Key DLLs](#key-dlls)
- [Control Flow](#control-flow)
  - [If Statement](#if-statement)
  - [While Loop](#while-loop)
  - [Jump Offsets](#jump-offsets)
- [Examples](#examples)

## Overview

The `.ipo` format is a compiled bytecode format for INPA scripts (`.ips` source files). It contains:

- **Header** with version info and signature and version info
- **Blocks** representing language constructs of the scripting language used in the `.ips` files
  - **Functions**
  - **Screens**
    - **Lines**
      - **Controls**
  - **Menus**
    - **Menu Items**
  - **Global Variables Definitions**
  - **Constants Definitions**

**Important**: `.ipo` files are read section by section, there is no lookup table at fixed position in the file.

File structure definitions are available in the [ImHex](https://github.com/WerWolv/ImHex) patterns file [`inpa.hexpat`](inpa.hexpat) should yo wish to take a look.

## File Header

### Structure

| Segment | Data Type | Notes |
|---------|-----------|---------|
| Version byte 1 | `u8` | Unconfirmed |
| Version byte 2 | `u8` | Unconfirmed |
| Magic string | `char[]` | Always `TEST-Infotext` |
| Separator | `u8` | `0x0A` |


> New line character (`\n` or `0x0A`) is often used as data separator

### Header Variants

| Variant | Hex Signature | Version Bytes | Notes |
|---------|---------------|---------------|-------|
| **A** | `05 00 54 45 53 54...` | `05 00` | Common in newer files |
| **B** | `01 02 54 45 53 54...` | `01 02` | Older format |
| **C** | `01 03 54 45 53 54...` | `01 03` | Alternative format |

**Full header hex (Variant A):**

```
05 00 54 45 53 54 2d 49 6e 66 6f 74 65 78 74 0a
      T  E  S  T  -  I  n  f  o  t  e  x  t \n
```

## Blocks

### Block Structure

| Segment | Data Type | Notes |
|---------|-----------|---------|
| Type | `u8` | |
| Name | `char[]` | Optional |
| Separator | `u8` | `0x0A` |
| Block ID | `u16` | Unique within block type, or within parent block |
| Flags | `u16` | Usually `00 00` except for menu items - used for specifying key shortcut |
| Argument 1 | `char[]` | Optional, used in `LINE` or `MENU` |
| Separator | `u8` | `0x0A` |
| Argument 2 | `char[]` | Optional, used in `LINE` |
| Separator | `u8` | `0x0A` |
| Marker | `u8` | `0x00` |
| Size | `u16` | Size means different things depending on block type |
| Data | `...` | Depends on section Type |

> **Note:** While all blocks have same header format, each block is interpreted differently based on the block type.

### Known Block Types

| Type | Purpose | Notes | 
|---------|---------|-----|
| `0x01` | Screen | |
| `0x02` | Menu | |
| `0x03` | State Machine | |
| `0x04` | Logic Table | |
| `0x05` | Function | |
| `0x11` | Global Variables | |
| `0x12` | Constants | |
| `0x21` | Screen Function | |
| `0x22` | Screen Line Function | |
| `0x24` | Menu Item Function  | |
| `0x23` | Screen Line Control Function | |
| `0x25` | State Machine State Function | |

### Variable Types

Variable types appear in Global Variables and in Constants blocks.

| Type | Byte | Data Type | Description |
|------|------|------|-------------|
| **Void** | `0x00` | `u8` | found in globals? |
| **Bool** | `0x01` | `u8` | Boolean (TRUE=1, FALSE=0) |
| **Byte** | `0x02` | `u8` | 8-bit unsigned integer (0-255) |
| **Int** | `0x03` | `s16` | 16-bit signed integer |
| **Long** | `0x04` | `s32` | 32-bit signed integer |
| **Real** | `0x05` | `double` | IEEE-754 double (64-bit float, little-endian) |
| **String** | `0x06` | `char[]]` | Terminated with`0x0A` (TBC - newline encoding) |

Variable **names are not stored** — they are referenced by index. Both for variables and constants.

### Global Variables

Global Variables block is always named `Global Data`.

#### Block Data

| Segment | Data Type | Notes |
|---------|-----------|---------|
| Globals | `u8[]` | An array size is determined by the `size` in the block header |

Value of each byte represents variable type.

> **Note:** There is **always** one `void` global varaible declared.

> **Note:** It seems that local function variables are always stored in global variable table. Since variable names are not preserved, scoping of variables is done at compilation stage.

#### Examples

No global variables declared

```c
inpainit() {}
inaexit() {}
```

```
11 ; Type ID
47 6C 6F 62 61 6C 20 44 61 74 61 ; "Global Data"
0A 
00 00 
00 00 
0A 
0A 00 
01 00 ; Length = 1
00 
```

Only 1 int declared

```c
int i;
inpainit() {}
inaexit() {}
```

```
11 47 6C 6F 62 61 6C 20 44 61 74 61 0A 00 00 00 00 0A 0A 00
02 00 
00 03
```

Two int declared

```c
int i;
int j;
inpainit() {}
inaexit() {}
```

```
11 47 6C 6F 62 61 6C 20 44 61 74 61 0A 00 00 00 00 0A 0A 00 
03 00 
00 03 03
```

### Constants

Constants block is always named `Constant Data`.

#### Block Data

| Segment | Data Type | Notes |
|---------|-----------|---------|
| Constants | constant[] | An array size is determined by the `size` in the block header |

The `constant` type is variable length, depending on tye variable type

| Type | Format | Example |
|------|--------|---------|
| Bool | `01 [u8 value]` | `01 01` (TRUE), `01 00` (FALSE) |
| Byte | `02 [u8 value]` | `02 ff` (255) |
| Int | `03 [le u16 value]` | `03 e8 03` (1000 = 0x03E8) |
| Long | `04 [le u32 value]` | `04 40 0d 03 00` (200000 = 0x00030D40) |
| Real | `05 [le double IEEE-754]` | `05 1f 85 eb 51 b8 1e 09 40` (3.14) |
| String | `06 char[] 0a` | `06 74 65 73 74 0a` ("test") |

#### Examples

No constants definition

```c
inpainit() {}
inaexit() {}
```

```
12 ; Type ID
43 6F 6E 73 74 61 6E 74 20 44 61 74 61 ; Constant Data
0A 00 00 00 00 0A 0A 00
00 00 ; Length
```

```c
int i = 1;
inpainit() {}
inaexit() {}
```

```
12 43 6F 6E 73 74 61 6E 74 20 44 61 74 61 0A 00 00 00 00 0A 0A 00 01 00
03 01 00
```

```c
int i = 1;
int j = 2;
inpainit() {}
inaexit() {}
```

```
12 43  6F 6E 73 74 61 6E 74 20 44 61 74 61 0A 00 00 00  00 0A 0A 00 
02 00 
03 01 00 
03 02 00
```

### Functions

#### Block Data

| Segment | Data Type | Notes |
|---------|-----------|---------|
| Instructions | `instruction[]` | An array size is determined by the `size` in the block header |

The `instruction` type always 4 bytes long.

Format of the instruction is not 100% confirmed yet.

Each file always contains these functions

| Function ID | Function Name | Notes |
| --- | --- | --- |
| `0x00` | `__inpa_startup__` | Compiler always generates it |
| `0x01` |  `__inpa_shutdown__` | Compiler always generates it |
| `0x02` | `inpainit` | Required by compiler to be defined |
| `0x03` | `inpaexit` | Required by compiler ro be defined |

Other block types use this format as well (screen body, menu body, menu item, screen line, screen line control). The difference is that in other block types if there is no body defined in the source code, there are no instructions stored.

For regular functions theres always at least one instruction. See [Return Mechanism](#return-mechanism) for details.

Function IDs (block IDs) are 0-indexed section numbers within the IPO file.

#### Return Mechanism

**`0E 00 00 00` appears to act as RET / function end.**

From `tests/windows-samples/test_empty.ipo`, empty function bodies consist of a single `0E 00 00 00` instruction.

`0F 00 00 00` appears immediately before `CALL_USER` and likely serves as a call prologue / marker (exact semantics TBD).

#### Parameter Passing

Parameters are passed via the stack. Arguments are pushed before `CALL_USER`:

**Source:**

```c
add(in: int a, in: int b, out: int c)
{
    c = a + b;
}

// Call
int result;
add(1, 2, result);
```

**Bytecode (conceptual):**

```hex
00 06 [const_1]    ; PUSH_CONST (1)
00 06 [const_2]    ; PUSH_CONST (2)
01 [result_idx]    ; PUSH_VAR_ADDR (result - for out param)
0C 80 [funcID] 00  ; CALL_USER (add function)
```

### Screen

Screen is a 0-length block of ID `0x01`, it's name corresponds to the name of the screen block given in the source code. It is a function like block.
If there are definitions of variables it has lenght and bytecode. in addition to the following `0x21` block.

```c
SCREEN s1() {}
```

```
01 73 31 0A 00 00 00 00 0A 0A 00 00 00 
   s  1
```

If the `SCREEN` block in source code contains local variables, or constants there instructions present in the block.

```c
SCREEN s_main() {    
    int i;
    
}
```

```
01 
73 5F 6D 61 69 6E 
0A 
00 00 00 00 
0A 0A 00 
01 00 ; length = 1
08 51 00 00 ; instructions
21 0A 00 00 00 00 0A 0A 00 00 00
```



Screen block is always followed by a Screen Function (`0x21`). This is function like block and follows the same structore as function block (`0x05`).

If there is no code in the `SCREEN` block source, the screen function block is empty.

```
21 0A 00 00 00 00 0A 0A 00 00 00 
```

If there are `LINE` blocks in the source code, there are corresponding Screen Line Function blocks (`0x22`) following block `0x21`. This is function like block and follows the same structore as function block (`0x05`).
The block "arguments" are passed in the block header.

```c
LINE("","") { foo()}
```
```
22 0A 00 00 00 00 0A 0A 00 02 00 0F 00 00 00 0C 80 04 00
```

```c
LINE("a", "b") { foo() }
```
```
22 0A 00 00 00 00 61 0A 62 0A 00 02 00 0F 00 00 00 0C 80 04 00
                  a     b
```

```c
LINE("abc", "def") {
    foo();
}
```

```
22 0A 00 00 00 00 61 62 63 0A 64 65 66 0A 00 02 00 0F 00 00 00 0C 80 04 00
                  a  b  c     d  e  f
```

If a `LINE` block contains a `CONTROL` block, there is a Screen Line Control Function block (`0x22`) following block `0x22`.  This is function like block and follows the same structore as function block (`0x05`).

```c
LINE("l1", "") {
    CONTROL {}
}
```
```
21 0A 00 00 00 00 0A 0A 00 00 00 
22 0A 00 00 00 00 6C 31 0A 0A 00 00 00 
```

```c
SCREEN s1() {
    foo();
    LINE("l1", "") {
        foo();
        CONTROL {
            foo();
        }
    }
    LINE("l2", "") {
        foo();
        CONTROL {
            foo();
        }
    }
    LINE("l3", "") {
        foo();
    }
}
```

```
01 73 31 0A 00 00 00 00 0A 0A 00 00 00 
21 0A 00 00 00 00 0A 0A 00 02 00 0F 00 00 00 0C 80 04 00 
22 0A 00 00 00 00 6C 31 0A 0A 00 02 00 0F 00 00 00 0C 80 04 00 
23 0A 00 00 00 00 0A 0A 00 02 00 0F 00 00 00 0C 80 04 00 
22 0A 00 00 00 00 6C 32 0A 0A 00 02 00 0F 00 00 00 0C 80 04 00 
23 0A 00 00 00 00 0A 0A 00 02 00 0F 00 00 00 0C 80 04 00 
22 0A 00 00 00 00 6C 33 0A 0A 00 02 00 0F 00 00 00 0C 80 04 00
```

### Menu

Menu is a function like block with id `0x02`. It contains instructions that are present in the `MENU` block's `INIT` block in the source code.

```c
MENU m_main() {
    INIT {
        foo();
    }
}
```

```
02 ; ID
6D 5F 6D 61 69 6E ; "m_main"
0A 
00 00 00 00 0A 0A 00 
02 00 ; lenght 2 - 2 instructions
0F 00 00 00 
0C 80 04 00
```

If the `MENU` block in the source code contains one or more `ITEM` blocks, the block `0x02` is followed by Menu Item Functions blocks (`0x24`). This is function like block and follows the same structore as function block (`0x05`).

```c
ITEM(1, "F1 Label") {
    foo();
}
```

The first argument of the block (`1`) is stored in the `flags` field of the header. The second is stored in the `argument 1` field of the header.

```
24 ; Type ID
0A 
00 00 ; 
01 00 ; Flags = 1
46 31 20 4C 61 62 65 6C ; "F1 Label"
0A 
0A 
00 02 ; Instruction count
00 
0F 00 00 00 
0C 80 04 00
```

### State Machine

State machine block (`0x03`) is a function like block that represents the `STATEMACHINE` code block's `INIT` block in the source code.

```c
STATEMACHINE sm_name()
{
    INIT { }
}

```

```
03 ; Type ID
73 6D 5F 6E 61 6D 65 ; "sm_name"
0A 
00 00 
00 00 
0A 
0A 
00 01 ; Instruction count
00 
0F 00 00 00
```

If state machine declares state blocks, each block is represented by a block with type `0x25` which follows block `0x03`. Block `0x25` is a function line block;

```c
STATEMACHINE sm_name()
{
         INIT {
        
        }
        
        s1 {

        }
}
```

```
03 73 6D 5F 6E 61 6D 65 0A 00 00 00 00 0A 0A 00 01 00 0F 00 00 00 
25 ; Type ID
73 31 ; "s1"
0A 
00 00 
00 00 
0A 
0A 
00 00 ; Instruction count
00
```

```c
STATEMACHINE sm_name()
{
    INIT {}
    s1 {}
    s2 {
        foo();
    }
}
```

```
03 73 6D 5F 6E 61 6D 65 0A 00 00 00 00 0A 0A 00 01 00 0F 00 00 00 
25 73 31 0A 00 00 00 00 0A 0A 00 00 00 
25 73 32 0A 01 00 00 00 0A 0A 00 02 00 0F 00 00 00 0C 80 04 00
```

### Logic Table

Logic tables per manual are a way of implementing switch statements.
Each `LOGTABLE` source code block generates a function block (type `0x05`) with code that uses lookup table data stored in a block with type `0x04` that follows the function block.

```c
LOGTABLE log1(out: bool out1 out2, in: bool in1 in2 in3)
{ 
    0y00: 0y000;  // Exact match
    0y01: 0y10X;  // X = don't care
    0y10: 0y010;
    0y11: OTHER;  // All other cases
}
```

The generated function is named as `lt_<log table block name>` and the data block is named as `LT_lt_<log table blockname>`.

```
05 6C 6F 67 31 0A 04 00 00 00 0A 0A 00 04 00 11 51 03 00 11 51 02 00 10 44 00 00 0E 00 00 00 
04 20 4C 54 5F 6C 6F 67 31 0A 00 00 00 00 0A 0A 00 04 00 00 00 00 00 FF FF FF FF 00 00 00 00 04 00 00 00 06 00 00 00 01 00 00 00 02 00 00 00 FF FF FF FF 02 00 00 00 00 00 00 00 00 00 00 00 03 00 00 00
```

#### Lookup Table Block

The data of this block has the following format

| Segment | Data Type | Notes |
|---------|-----------|---------|
| Entry | entry[] | An array size is determined by the `size` in the block header |

Entry is defined as

```c
struct LogtableEntry {
    u32 input_value;    // Input bit pattern to match
    u32 input_mask;     // Bitmask for comparison
    u32 output_value;   // Output bit pattern
}
```

#### Mask Encoding

| Pattern | Mask Value | Meaning |
|---------|------------|---------|
| Exact match | `0xFFFFFFFF` | All bits must match |
| Don't care (X) | Partial mask | Only masked bits checked |
| OTHER | `0x00000000` | Matches any input (default) |

#### Runtime Evaluation

```
for entry in table:
    if (input & entry.mask) == (entry.input_value & entry.mask):
        return entry.output_value
```

#### Example: Don't Care (X)

**Source:**

```c
LOGTABLE lt_test(out: bool o1, in: bool i1 i2 i3)
{
    0y0: 0y00X;   // output=0 when i1=0, i2=0, i3=any
    0y1: 0yX1X;   // output=1 when i2=1 (i1,i3=any)
    0y0: OTHER;
}
```

**Compiled entries:**

```
Entry 0: input=0b000, mask=0b110 (0x06), output=0  ; 0y00X
Entry 1: input=0b010, mask=0b010 (0x02), output=1  ; 0yX1X  
Entry 2: input=0,     mask=0 (OTHER),    output=0  ; default
```

#### Multiple Outputs

Multiple output bits are packed into a single integer:

```c
LOGTABLE lt_multi(out: bool o1 o2, in: bool i1 i2)
{
    0y00: 0y00;  // o1=0, o2=0 → output=0b00
    0y01: 0y01;  // o1=0, o2=1 → output=0b01
    0y10: 0y10;  // o1=1, o2=0 → output=0b10
    0y11: 0y11;  // o1=1, o2=1 → output=0b11
}
```

## Opcode Reference

The INPA VM is stack-based.

### Core Opcodes



**Partially confirmed from `tests/windows-samples/*`** (see `docs/research/opcode-mappings.md`).

| Opcode | Arguments | Mnemonic | Description |
|--------|-----------|----------|-------------|
| `01 [u16] [u8]` | index ? | Push const at index? |
| `02 [u16] 00` | index | Push variable at index? |
| `05 [u8] [u8] 00` |  | Unknown (appears after addr+value push in assignments) |
| `06 [u8] [u8] 00 ` | | Unknown (appears before assignments; likely PUSH_CONST) |
| `08 51 00 00` | - | ? | Appears only when local variables declared (likely local alloc / frame setup) |
| `09 [u8] 00 00` | Op | `ALU_OP` | Binary arithmetic/comparison operation |
| `0B 00 [u16] ` | pop? | `JMP_FALSE` | Pop condition; if false, jump by offset |
| `0C 80 [u16]` | FuncID | `CALL_USER` | Call user-defined function (**confirmed**) |
| `0C 81 [u16]` | FuncID | `CALL_API` | Call system/API function |
| `0E 00 00 00` |  | `RET` | Function end / return (**confirmed from empty bodies**) |
| `0F 00 00 00` | - | ? | Call prologue / marker (appears immediately before `CALL_USER`) |

### ALU Operations (`09 [op]`)

| Sub-Op | Symbol | Operation |
|--------|--------|-----------|
| `0x60` | `+` | Addition |
| `0x61` | `-` | Subtraction |
| `0x62` | `*` | Multiplication |
| `0x64` | `<` | Less than |
| `0x65` | `>` | Greater than |
| `0x68` | `==` | Equality |

### Index Encoding

All indices are **16-bit little-endian unsigned integers**.

---

## System Functions

System functions represent the ones defined in `inpa.h` header file. They have their own IDs range. The ids overlap with user functions therefore there is a different instruction to call a system function.

System functions are called via `0C 81 [ID] 00`.

IDs are **hardcoded** in the VM, not sequential.

### Complete Mapping (159 functions)

| ID (hex) | Function | Signature |
|----------|----------|-----------|
| `0x00` | `setmenutitle` | `(in: string title)` |
| `0x01` | `setmenu` | `(in: MENU handle)` |
| `0x02` | `setitem` | `(in: int ItemNum, in: string ItemText, in: bool Enabled)` |
| `0x03` | `settitle` | `(in: string title)` |
| `0x04` | `setscreen` | `(in: SCREEN handle, in: bool cyclic)` |
| `0x05` | `setstatemachine` | `(in: STATEMACHINE handle)` |
| `0x06` | `setstate` | `(in: STATE handle)` |
| `0x07` | `callstatemachine` | `(in: STATEMACHINE handle)` |
| `0x08` | `returnstatemachine` | `()` |
| `0x09` | `settimer` | `(in: int timernum, in: int timeval)` |
| `0x0A` | `testtimer` | `(in: int timernum, out: bool expiredflag)` |
| `0x0B` | `setjobstatus` | `(in: int JobStatus)` |
| `0x0C` | `exit` | `()` |
| `0x0D` | `exitwindows` | `()` |
| `0x0E` | `scriptselect` | `(in: string ScriptSelectIniFile)` |
| `0x0F` | `scriptchange` | `(in: string NewScriptFile)` |
| `0x10` | `select` | `(in: bool MultipleSelectFlag)` |
| `0x11` | `deselect` | `()` |
| `0x12` | `control` | `()` |
| `0x13` | `start` | `()` |
| `0x14` | `stop` | `()` |
| `0x15` | `getapistring` | `(in: bool ArgNumFlag, in: bool FullScreenFlag, out: string ApiString)` |
| `0x16` | `togglelist` | `(in: bool MultipleSelectFlag, in: bool ArgNumFlag, out: string ApiToggleString)` |
| `0x17` | `printscreen` | `()` |
| `0x18` | `printfile` | `(out: int ErrorCode, in: string FileName, in: string PrinterName, in: string PrinterPort, in: bool ErrorMsgFlag)` |
| `0x1A` | `setcolor` | `(in: int ForeColor, in: int BackColor)` |
| `0x1B` | `delay` | `(in: int Time)` |
| `0x1C` | `getdate` | `(out: string date)` |
| `0x1D` | `gettime` | `(out: string time)` |
| `0x1E` | `realtostring` | `(in: real value, in: string format, out: string result)` |
| `0x1F` | `stringtoreal` | `(in: string value, out: real result)` |
| `0x20` | `inttostring` | `(in: int value, out: string result)` |
| `0x21` | `stringtoint` | `(in: string value, out: int result)` |
| `0x22` | `hexconvert` | `(in: string HexString, out: int high, out: int mid, out: int low, out: int seg)` |
| `0x23` | `strcat` | `(out: string dest, in: string left, in: string right)` |
| `0x24` | `strlen` | `(out: int length, in: string str)` |
| `0x25` | `midstr` | `(out: string result, in: string str, in: int start, in: int length)` |
| `0x26` | `realtoint` | `(in: real value, out: int result)` |
| `0x27` | `inttoreal` | `(in: int value, out: real result)` |
| `0x28` | `bytetoint` | `(in: byte value, out: int result)` |
| `0x29` | `inttolong` | `(in: int value, out: long result)` |
| `0x2A` | `longtoreal` | `(in: long value, out: real result)` |
| `0x2B` | `PEMInitialisiere` | `(out: bool Result)` |
| `0x2C` | `PEMProtokollKopf` | `(out: bool Result)` |
| `0x2D` | `PEMProtokollZeile` | `(out: bool Result)` |
| `0x2E` | `PEMSGZ_Kopfzeile` | `(out: bool Result)` |
| `0x2F` | `PEMTrennLinie` | `(out: bool Result)` |
| `0x30` | `PEMEndLinie` | `(out: bool Result)` |
| `0x31` | `PEMLoescheTabZeilenPuffer` | `(out: bool Result)` |
| `0x32` | `PEMUebertrageTabZeilenPuffer` | `(out: bool Result)` |
| `0x33` | `PEMProtokollAusgabe` | `(out: bool Result)` |
| `0x34` | `PEMDruckeEtikett` | `(out: bool Result)` |
| `0x36` | `PEMPrintFormular` | `(out: bool Result)` |
| `0x37` | `PEMPrinter_ff` | `(out: bool Result)` |
| `0x38` | `PEMFree_mem` | `(out: bool Result)` |
| `0x39` | `PEMLoad_formular` | `(out: bool Result)` |
| `0x3A` | `PEMDefault_druckfeld` | `(out: bool Result)` |
| `0x3B` | `PEMDefault_besetzen` | `(out: bool Result)` |
| `0x3C` | `PEMForget_formular` | `(out: bool Result)` |
| `0x3D` | `PEMWrite_druckfeld` | `(out: bool Result)` |
| `0x3E` | `getinputstate` | `(out: int InputState)` |
| `0x3F` | `inputtext` | `(out: string text, in: string Title, in: string Text)` |
| `0x40` | `inputnum` | `(out: real val, in: string BoxTitle, in: string BoxText, in: real minval, in: real maxval)` |
| `0x41` | `inputhex` | `(out: string hex, in: string Title, in: string Text, in: string Min, in: string Max)` |
| `0x42` | `inputdigital` | `(out: int value, in: string Title, in: string Text, in: string OffText, in: string OnText)` |
| `0x43` | `input2text` | `(out: string str1, out: string str2, in: string BoxTitle, in: string BoxText, in: string BoxStr1, in: string BoxStr2)` |
| `0x44` | `input2hexnum` | `(out: string hexstr, out: int num, in: string BoxTitle, in: string BoxText, in: string BoxStr1, in: string BoxStr2, in: string MinHexStr, in: string MaxHexStr, in: int minnum, in: int maxnum)` |
| `0x45` | `input2hex` | `(out: string hexstr1, out: string hexstr2, in: string BoxTitle, in: string BoxText, in: string BoxStr1, in: string BoxStr2, in: string MinHexStr1, in: string MaxHexStr1, in: string MinHexStr2, in: string MaxHexStr2)` |
| `0x46` | `inputint` | `(out: int value, in: string Title, in: string Text, in: int Min, in: int Max)` |
| `0x47` | `input2int` | `(out: int val1, out: int val2, in: string BoxTitle, in: string BoxText, in: string BoxStr1, in: string BoxStr2, in: int min1, in: int max1, in: int min2, in: int max2)` |
| `0x48` | `text` | `(in: int row, in: int col, in: string text)` |
| `0x49` | `textout` | `(in: string text, in: int row, in: int col)` |
| `0x4A` | `ftextout` | `(in: string text, in: int row, in: int col, in: int fgcolor, in: int bgcolor, in: int fontsize, in: int fontattr)` |
| `0x4B` | `digitalout` | `(in: bool val, in: int row, in: int col, in: string TrueText, in: string FalseText)` |
| `0x4C` | `analogout` | `(in: real val, in: int row, in: int col, in: real min, in: real max, in: real minvalid, in: real maxvalid, in: string format)` |
| `0x4D` | `multianalogout` | `(in: int row, in: int col, ...)` |
| `0x4E` | `hexdump` | `(in: int row, in: int col, in: string data, in: int len)` |
| `0x4F` | `ftextclear` | `(in: string text, in: int row, in: int col, in: int textsize, in: int textattr)` |
| `0x50` | `clearrect` | `(in: int row, in: int col, in: int width, in: int height)` |
| `0x51` | `blankscreen` | `()` |
| `0x52` | `messagebox` | `(in: string Title, in: string Text)` |
| `0x53` | `infobox` | `(in: string Title, in: string Text)` |
| `0x54` | `userboxopen` | `(in: int BoxNum, in: int row, in: int col, in: int height, in: int width, in: string TitleStr, in: string TextStr)` |
| `0x55` | `userboxclose` | `(in: int BoxNum)` |
| `0x56` | `userboxftextout` | `(in: int BoxNum, in: string Text, in: int Row, in: int Col, in: int ForeColor, in: int BackColor)` |
| `0x57` | `userboxclear` | `(in: int BoxNum)` |
| `0x58` | `userboxsetcolor` | `(in: int BoxNum, in: int ForeColor, in: int BackColor)` |
| `0x59` | `winhelp` | `(in: string helpfile)` |
| `0x5A` | `winhelpkey` | `(in: string helpfile, in: string key)` |
| `0x5B` | `callwin` | `(in: string cmdline)` |
| `0x5C` | `viewopen` | `(in: string FileNameStr, in: string TitleStr)` |
| `0x5D` | `viewclose` | `()` |
| `0x5E` | `simnum` | `(out: real val, in: string BoxTitle, in: string BoxText, in: real minval, in: real maxval)` |
| `0x5F` | `simdigital` | `(out: bool val, in: string BoxTitle, in: string BoxText, in: string FalseStr, in: string TrueStr)` |
| `0x60` | `INPAapiInit` | `()` |
| `0x61` | `INPAapiEnd` | `()` |
| `0x62` | `INPAapiJob` | `(in: string ecu, in: string Job, in: string Arg1, in: string Arg2)` |
| `0x63` | `INPAapiResultText` | `(out: string ResultText, in: string ApiResult, in: int ApiSet, in: string Format)` |
| `0x64` | `INPAapiResultInt` | `(out: int ResultInt, in: string ApiResult, in: int ApiSet)` |
| `0x65` | `INPAapiResultSets` | `(out: int sets)` |
| `0x66` | `INPAapiResultDigital` | `(out: bool ResultValue, in: string ApiResult, in: int ApiSet)` |
| `0x67` | `INPAapiResultAnalog` | `(out: real ResultValue, in: string ApiResult, in: int ApiSet)` |
| `0x68` | `INPAapiResultBinary` | `(in: string ApiResult, in: int ApiSet)` |
| `0x69` | `INPAapiCheckJobStatus` | `(in: string RefStr)` |
| `0x6A` | `INPAapiFsLesen2` | `(in: string ecu, in: string FileName)` |
| `0x6B` | `INPAapiFsLesen` | `(in: string ecu, in: string FileName)` |
| `0x6C` | `INPAapiFsMode` | `(in: int FsMode, in: string FsFileMode, in: string PreInfoFile, in: string PostInfoFile, in: string ApiFsJobName)` |
| `0x6D` | `INP1apiInit` | `(out: bool rc)` |
| `0x6E` | `INP1apiEnd` | `()` |
| `0x6F` | `INP1apiJob` | `(in: string ecu, in: string Job, in: string Arg1, in: string Arg2)` |
| `0x70` | `INP1apiState` | `(out: int ApiState)` |
| `0x71` | `INP1apiResultText` | `(out: bool rc, out: string ResultText, in: string ApiResult, in: int ApiSet, in: string Format)` |
| `0x72` | `INP1apiResultInt` | `(out: bool rc, out: int ResultInt, in: string ApiResult, in: int ApiSet)` |
| `0x73` | `INP1apiResultSets` | `(out: bool rc, out: int sets)` |
| `0x74` | `INP1apiResultReal` | `(out: bool rc, out: real ResultValue, in: string ApiResult, in: int ApiSet)` |
| `0x75` | `INP1apiResultBinary` | `(out: bool rc, in: string ApiResult, in: int ApiSet)` |
| `0x76` | `INP1apiErrorCode` | `(out: int ErrorCode)` |
| `0x77` | `INP1apiErrorText` | `(out: string ErrorText)` |
| `0x78` | `GetBinaryDataString` | `(out: string DataString, out: int DataStringLen)` |
| `0x79` | `fileopen` | `(in: string FileName, in: string OpenMode)` |
| `0x7A` | `fileclose` | `()` |
| `0x7B` | `filewrite` | `(in: string str)` |
| `0x7C` | `fileread` | `(out: string str, out: bool EOF)` |
| `0x7D` | `DTMFindLogUnit` | `(out: bool rc, in: string LogUnit)` |
| `0x7E` | `DTMGetSGVar` | `(out: string SGVar, in: string SGArt)` |
| `0x7F` | `DTMGetSGArt` | `(out: string SGArt, in: string SGVar)` |
| `0x80` | `DTMGetVarWert` | `(out: string VarWert, in: string VarName)` |
| `0x81` | `DTMSetupGetVarWert` | `(out: string VarWert, in: string VarName)` |
| `0x82` | `DTMSetupGetStartPosition` | `()` |
| `0x83` | `DTMSetupGetNextAssoc` | `(out: bool rc, inout: string VarName, inout: string VarWert)` |
| `0x84` | `DTMLogUnitEintragen` | `(in: string LogUnit)` |
| `0x85` | `DTMSGEintragen` | `(in: string SGArt, in: string SGVar)` |
| `0x86` | `DTMLoescheAuftrag` | `()` |
| `0x87` | `DTMVariableEintragen` | `(in: string VarName, in: string VarWert)` |
| `0x88` | `DTMVariableLoeschen` | `(out: bool rc, in: string VarName)` |
| `0x89` | `DTMLoescheAlleVariablen` | `()` |
| `0x8A` | `DTMSetupVariableEintragen` | `(in: string VarName, in: string VarWert)` |
| `0x8B` | `DTMSetupVariableLoeschen` | `(out: bool rc, in: string VarName)` |
| `0x8C` | `StrArrayCreate` | `(out: bool rc, out: int hStrArray)` |
| `0x8D` | `StrArrayDestroy` | `(in: int hStrArray)` |
| `0x8E` | `StrArrayWrite` | `(in: int hStrArray, in: int index, in: string str)` |
| `0x8F` | `StrArrayRead` | `(in: int hStrArray, in: int index, out: string str)` |
| `0x90` | `StrArrayGetElementCount` | `(in: int hStrArray, out: int ElementCount)` |
| `0x91` | `StrArrayDelete` | `(in: int hStrArray)` |
| `0x92` | `SPSInit` | `()` |
| `0x93` | `SPSEnd` | `()` |
| `0x94` | `SPSLeseVonSPS` | `(...)` |
| `0x95` | `SPSSendeAnSPS` | `(...)` |
| `0x96` | `SPSLeseVakWerte` | `(...)` |
| `0x97` | `ApiJobFsLesenFAB` | `(out: int rc, in: string sgvar, out: int edifehler, out: string jobstatus, out: int fehler, out: int saetze)` |
| `0x98` | `ApiResultFsLesenFAB` | `(out: int rc, out: int ausgeblendet, in: int satz)` |
| `0x99` | `ELDIOpenStartDialog` | `(in: string CommandParameter, out: int ResultCode)` |
| `0x9A` | `CreateStructure` | `(out: long handle, in: int length)` |
| `0x9B` | `SetStructureMode` | `(in: int ReadWrite)` |
| `0x9C` | `StructureByte` | `(in: long handle, in: int Offset, inout: byte value)` |
| `0x9D` | `StructureInt` | `(in: long handle, in: int Offset, inout: int value)` |
| `0x9E` | `StructureLong` | `(in: long handle, in: int Offset, inout: long value)` |
| `0x9F` | `StructureString` | `(in: long handle, in: int Offset, in: int length, inout: string value)` |
| `0xA1` | `setitemrepeat` | `(in: int ItemNum, in: bool Enabled)` |

**Notes:**

- `setjobstatus` (0x0B) inferred from sequential IDs — INPACOMP reports "no longer supported"
- DTM functions (0x7D-0x8B) — WinEldi-only, "no longer supported"
- SPS functions (0x92-0x96) — IDs inferred from sequential range
- API/ELDI functions (0x97-0x99) — "no longer supported"

## Import32 / DLL Calls

External DLL functions are imported using `import32` (32-bit) or `import` (16-bit) syntax and stored as signature strings in the IPO.

### Source Syntax

```c
// 32-bit DLLs
import32 "Convention" lib "DLL::Function" Alias(parameters);

// 16-bit DLLs (legacy, same bytecode format)
import "Convention" lib "DLL::Function" Alias(parameters);
```

### Binary Format

Both `import` and `import32` produce **identical bytecode format**. The IPO contains import strings in format:

```
DLL::Function:convention.signature
```

### 16-bit vs 32-bit Differences

The only difference between `import` and `import32` is the **case of the calling convention letter**:

| Convention | 16-bit (`import`) | 32-bit (`import32`) |
|------------|-------------------|---------------------|
| Pascal | `P` | `p` |
| C/cdecl | `C` | `c` |
| Stdcall | `S` | `s` |

**Parser recommendation:** Treat calling convention case-insensitively.

**Research:** See `docs/research/import16-research.md` for detailed analysis (issue #65).

### Examples from Production Files

```
kernel32::GetPrivateProfileStringA:c.sssSis%I
api32.DLL::__apiGetConfig:c.lsS%I
INPA_LIB32.DLL::SaveAsDialogBox:c.sSi%I
XTRACT32.DLL::XTRACT:c.siSl%I
kernel32::OpenFile:c.stLi%I
user.exe::MessageBox:P.issi%I          (16-bit example)
```

### Signature Decoding

| Char | Meaning | Direction |
|------|---------|-----------|
| `c`/`C` | Calling convention: cdecl | — |
| `p`/`P` | Calling convention: pascal | — |
| `s`/`S` (in params) | string (LPCSTR) | input |
| `S` (in params) | String buffer (LPSTR) | output |
| `i` | int (32-bit) | input |
| `l` | long (32-bit) | input |
| `%I` | Returns int | return value |
| `t` | ⚠️ Unknown (struct?) | — |
| `L` | ⚠️ Unknown (LPARAM?) | — |

### Key DLLs

| DLL | Purpose |
|-----|---------|
| `api32.DLL` | EDIABAS bridge (`__apiGetConfig`, `__apiSetConfig`) |
| `INPA_LIB32.DLL` | INPA utilities (dialogs, file ops) |
| `kernel32` | Windows system calls |
| `XTRACT32.DLL` | Data extraction utilities |


## Control Flow

### If Statement

**Source:**

```c
if (x > 5) {
    // body
}
```

**Bytecode pattern:**

```
00 01 [x_idx]      ; PUSH_VAR_VAL (x)
00 06 [const_5]    ; PUSH_CONST (5)
00 09 65           ; ALU_OP (>)
00 0B [offset]     ; JMP_FALSE (skip body if false)
[body bytecode]
```

### While Loop

**Source:**

```c
while (i < 5) {
    // body
}
```

**Bytecode pattern:**

```
[LOOP_START:]
00 01 [i_idx]      ; PUSH_VAR_VAL (i)
00 06 [const_5]    ; PUSH_CONST (5)
00 09 64           ; ALU_OP (<)
00 0B [exit_offset]; JMP_FALSE (exit loop)
[body bytecode]
00 0E [back_offset]; JMP (negative, to LOOP_START)
```

### Jump Offsets

- `s16` signed little-endian
- Relative to **next instruction** after the jump opcode
- Negative values for backward jumps (loops)


## Examples

### Example 1: Variable Assignment

**Source:** `x = 10;`

**Bytecode:**

```hex
01 01 00           ; PUSH_VAR_ADDR (Variable #1 = x)
00 06 00 00        ; PUSH_CONST (Constant #0 = 10)
00 05              ; STORE
```

### Example 2: Conditional Branch

**Source:** `if (x > 5) { ... }`

**Bytecode:**

```hex
00 01 01 00        ; PUSH_VAR_VAL (x at index 1)
00 06 01 00        ; PUSH_CONST (5 at index 1)
00 09 65           ; ALU_OP (> = 0x65)
00 0B 0E 00        ; JMP_FALSE +14 bytes (skip body)
[body: 14 bytes]
```

### Example 3: System Function Call

**Source:** `text(0, 0, "Hello");`

**Bytecode:**

```hex
00 06 00 00        ; PUSH_CONST (0)
00 06 00 00        ; PUSH_CONST (0)  
00 06 02 00        ; PUSH_CONST ("Hello" at index 2)
0C 81 48 00        ; CALL_API (text, ID=0x48)
```


### Example 5: Import32 Signature

**Source:**

```c
import32 "c" lib "kernel32::GetPrivateProfileStringA"  GetIniString(in: string Section, in: string Key, in: string Default,
                 out: string Buffer, in: int BufSize, in: string FileName,
                 out: int Result);

inpainit()
{    
    int res;
    string buff;
    GetIniString("a", "b", "c", buff, 12, "foo", res);
}

inpaexit()
{
  
}
```

**Binary string:**


Call is made with instruction `0D 01 01 00` with arguments from constant data pushed to the stack

Constant data contains entries for the calling convention and the dll and signature information

```
12 
43 6F 6E 73 74 61 6E 74 20 44 61 74 61 
0A 
00 00 00 00 
0A 
0A 
00 
07 00 
06 63 0A ; string "c"
06 6B 65 72 6E 65 6C 33 32 3A 3A 47 65 74 50 72 69 76 61 74 65 50 72 6F 66 69 6C 65 53 74 72 69 6E 67 41 3A 63 2E 73 73 73 53 69 73 49 25 0A 06 61 0A ; string "kernel32::GetPrivateProfileStringA:c.sssSisI%"
06 62 0A 06 63 0A 03 0C 00 06 66 6F 6F 0A
```
