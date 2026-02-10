# INPA Language Guide

This document describes the INPA scripting language syntax, including variables, operators, control flow, and data types.

## Overview

INPA (Interpreter for Test Procedures) uses a **C-like programming language** designed for:
- Easy learning curve
- Interactive test development
- Screen-based output
- ECU communication via EDIABAS
- Pseudo-parallel state machine execution

## Script Structure

### File Types

| Extension | Description |
|-----------|-------------|
| `.ips` | Source file (interpreted or compiled) |
| `.ipo` | Compiled object file (faster loading) |

### Basic Structure

```c
// Preprocessor directives
#pragma winedit
#include "inpa.h"

// Global variables
int global_var;
string global_string;

// External declarations (forward declarations)
extern my_function();

// User-defined functions
my_function()
{
    // Function body
}

// Structures (SCREEN, MENU, STATEMACHINE, LOGTABLE)
SCREEN s_main()
{
    // Screen definition
}

MENU m_main()
{
    // Menu definition
}

// Entry points (required)
inpainit()
{
    // Script initialization
}

inpaexit()
{
    // Script cleanup
}
```

### Required Entry Points

Every INPA script must define:

#### inpainit()
Called when the script starts:
```c
inpainit()
{
    settitle("My Script");
    setmenu(m_main);
    setscreen(s_main, TRUE);
}
```

#### inpaexit()
Called when the script exits:
```c
inpaexit()
{
    INPAapiEnd();  // Clean up EDIABAS
}
```

## Preprocessor Directives

### #include
Includes header files:
```c
#include "inpa.h"     // Standard INPA functions
#include "bmwlib.h"   // BMW-specific functions
#include "commlib.h"  // COM port functions
```

### #pragma
Compiler directives:
```c
#pragma winedit  // Enable Windows editor for source editing
```

## Data Types

### Primitive Types

| Type | Size | Description | Range |
|------|------|-------------|-------|
| `byte` | 8 bits | Unsigned integer | 0 to 255 |
| `int` | 16 bits | Signed integer | -32,768 to 32,767 |
| `long` | 32 bits | Signed integer | -2,147,483,648 to 2,147,483,647 |
| `real` | 64 bits | Floating point | ±3.4E-38 to ±3.4E+38 |
| `bool` | - | Boolean | TRUE or FALSE |
| `string` | - | Null-terminated | Variable length |

### Variable Declaration

```c
// Simple declarations
int counter;
real temperature;
bool flag;
string message;
byte data_byte;
long big_number;

// With initialization
int counter = 0;
real temperature = 25.5;
bool flag = FALSE;
string message = "Hello";

// Multiple declarations
int a, b, c;
```

### Scope

Variables can be:
- **Global**: Declared outside any function, accessible everywhere
- **Local**: Declared inside a function or block, accessible only within that scope

```c
// Global variable
int global_counter = 0;

my_function()
{
    // Local variable
    int local_counter = 0;
    
    global_counter = global_counter + 1;  // OK
    local_counter = local_counter + 1;    // OK
}

another_function()
{
    global_counter = 5;  // OK
    // local_counter = 5;  // ERROR - not in scope
}
```

## Constants

### Numeric Constants

```c
// Decimal
int dec = 123;
int negative = -456;

// Hexadecimal (prefix 0x)
int hex = 0x1A3F;
int hex2 = 0xFFFF;

// Binary (prefix 0y)
int bin = 0y11110000;
int bin2 = 0y10101010;

// Real numbers
real r1 = 3.14159;
real r2 = -273.15;
real r3 = 1.5e10;  // Scientific notation
```

### String Constants

```c
string s1 = "Hello World";
string s2 = "Line1\nLine2";  // With newline (limited support)
string empty = "";
```

### Boolean Constants

```c
bool t = TRUE;
bool f = FALSE;
```

### Logic Table Constants

For use in LOGTABLE:
```c
0y00    // Binary: both FALSE
0y01    // Binary: first FALSE, second TRUE
0y10    // Binary: first TRUE, second FALSE
0y11    // Binary: both TRUE
0yX0    // X = don't care
0y0X
OTHER   // Catch-all for unmatched cases
```

## Operators

### Arithmetic Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `+` | Addition | `a + b` |
| `-` | Subtraction | `a - b` |
| `*` | Multiplication | `a * b` |
| `/` | Division | `a / b` |

**Note:** No modulo operator (%). Use functions or compute manually.

### Comparison Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `==` | Equal to | `a == b` |
| `!=` | Not equal to | `a != b` |
| `<` | Less than | `a < b` |
| `>` | Greater than | `a > b` |
| `<=` | Less than or equal | `a <= b` |
| `>=` | Greater than or equal | `a >= b` |

### Logical Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `&&` | Logical AND | `a && b` |
| `||` | Logical OR | `a || b` |
| `!` | Logical NOT | `!a` |

### String Concatenation

```c
string s1 = "Hello";
string s2 = " World";
string result = s1 + s2;  // "Hello World"

// With other types (converted to string)
int num = 42;
string msg = "Value: " + num;  // May require inttostring()
```

### Assignment

```c
int a;
a = 5;           // Simple assignment
a = a + 1;       // Increment (no ++ operator)
a = a - 1;       // Decrement (no -- operator)
```

**Note:** INPA does not support compound assignment operators (`+=`, `-=`, etc.) or increment/decrement operators (`++`, `--`).

## Control Structures

### if-else

```c
if (condition) {
    // Statements
}

if (condition) {
    // True branch
} else {
    // False branch
}

// Nested if-else
if (condition1) {
    // ...
} else {
    if (condition2) {
        // ...
    } else {
        // ...
    }
}
```

**Examples:**
```c
if (temperature > 100.0) {
    messagebox("Warning", "Overheating!");
}

if (connected == TRUE) {
    INPAapiJob("ecu", "status", "", "");
} else {
    messagebox("Error", "Not connected");
}

// Comparison with boolean
if (flag == TRUE) {  // Explicit comparison preferred
    // ...
}
```

### while Loop

```c
while (condition) {
    // Loop body
}
```

**Examples:**
```c
int i = 0;
while (i < 10) {
    // Process item i
    i = i + 1;
}

// Wait loop with timeout
bool done = FALSE;
settimer(0, 5000);
while (done == FALSE) {
    testtimer(0, done);
    // Check condition
    if (/* condition met */) {
        done = TRUE;
    }
}
```

### No for Loop

INPA does not have a `for` loop. Use `while` instead:

```c
// Equivalent of: for (i = 0; i < 10; i++)
int i = 0;
while (i < 10) {
    // Loop body
    i = i + 1;
}
```

### No switch/case

INPA does not have `switch/case`. Use if-else chains:

```c
// Instead of switch(value)
if (value == 1) {
    // Case 1
} else {
    if (value == 2) {
        // Case 2
    } else {
        if (value == 3) {
            // Case 3
        } else {
            // Default
        }
    }
}
```

For boolean mapping, consider LOGTABLE.

### No break/continue

Loops cannot be exited early with `break`. Structure your logic to avoid the need:

```c
// Instead of break, use a flag
bool found = FALSE;
int i = 0;
while (i < 100 && found == FALSE) {
    if (/* found condition */) {
        found = TRUE;
    } else {
        i = i + 1;
    }
}
```

## Functions

### User-Defined Functions

```c
function_name(direction: type param1, direction: type param2)
{
    // Local variables
    int local_var;
    
    // Statements
    
    // No explicit return value (use out parameters)
}
```

### Parameter Directions

| Direction | Description |
|-----------|-------------|
| `in:` | Read-only parameter (value passed in) |
| `out:` | Write-only parameter (value returned) |
| `inout:` | Read-write parameter (value passed and returned) |

**Examples:**
```c
// Input only
print_value(in: int value)
{
    string s;
    inttostring(value, s);
    messagebox("Value", s);
}

// Output only
get_current_time(out: string time_str)
{
    gettime(time_str);
}

// Input and output
increment(inout: int value)
{
    value = value + 1;
}

// Multiple parameters
add_values(in: int a, in: int b, out: int result)
{
    result = a + b;
}
```

### Calling Functions

```c
// Input parameters
print_value(42);

// Output parameters - variable receives value
string time;
get_current_time(time);

// Inout parameters - variable modified in place
int counter = 0;
increment(counter);  // counter is now 1

// Multiple parameters
int sum;
add_values(5, 3, sum);  // sum is now 8
```

### Forward Declarations

When a function is called before its definition:

```c
// Forward declaration
extern helper_function();

main_function()
{
    helper_function();  // OK - declared above
}

// Actual definition
helper_function()
{
    // Implementation
}
```

## Special Structures

### SCREEN

Defines a display screen:

```c
SCREEN screen_name()
{
    // Global screen code (runs every cycle)
    
    LINE("LineName", "APIString") {
        // Line-specific code (runs when visible)
        
        CONTROL {
            // Control code (runs on control() call)
        }
    }
}
```

### MENU

Defines function key handlers:

```c
MENU menu_name()
{
    INIT {
        // Runs once when menu activated
        setmenutitle("Title");
    }
    
    ITEM(1, "F1 Label") {
        // F1 handler
    }
    
    ITEM(10, "F10 Label") {
        // F10 handler
    }
    
    ITEM(11, "SF1 Label") {
        // Shift+F1 handler
    }
    
    ITEM(20, "SF10 Label") {
        // Shift+F10 handler
    }
}
```

### STATEMACHINE

Defines a state machine for pseudo-parallel execution:

```c
STATEMACHINE sm_name()
{
    // Local variables
    int counter;
    
    INIT {
        // Required - runs first
        counter = 0;
        setstate(FIRST_STATE);
    }
    
    FIRST_STATE {
        // State code
        if (condition) {
            setstate(SECOND_STATE);
        }
    }
    
    SECOND_STATE {
        // More state code
        callstatemachine(sm_other);  // Call sub-machine
    }
    
    FINAL_STATE {
        returnstatemachine();  // Return to caller
    }
}
```

### LOGTABLE

Defines a boolean logic mapping table:

```c
LOGTABLE table_name(out: bool out1 out2, in: bool in1 in2 in3)
{
    // Output : Input
    0y00: 0y000;  // Exact match
    0y01: 0y10X;  // X = don't care
    0y10: 0y010;
    0y11: OTHER;  // All other cases
}
```

Usage:
```c
bool o1, o2;
table_name(o1, o2, TRUE, FALSE, TRUE);
```

## Imported Functions

Functions from external DLLs:

### 16-bit DLLs
```c
import [CallConv] lib "LibName[::InternalName]" FunctionName(
    direction: type param1,
    ...
    [, returns: type retval]
);
```

### 32-bit DLLs
```c
import32 [CallConv] lib "LibName[::InternalName]" FunctionName(
    direction: type param1,
    ...
    [, returns: type retval]
);
```

### Calling Conventions

| Convention | Description |
|------------|-------------|
| `pascal` | Pascal calling convention (default) |
| `"C"` | C calling convention |

### Examples

```c
// Windows MessageBox
import pascal lib "user.exe::MessageBox" MyMsgBox(
    in: int hwnd,
    in: string text,
    in: string caption,
    in: int type,
    returns: int result
);

// Custom DLL with C convention
import "C" lib "mylib.dll" ProcessData(
    in: string input,
    out: string output,
    returns: int status
);

// 32-bit DLL
import32 pascal lib "mylib32.dll" DoWork(
    in: long value,
    out: long result
);
```

### Structure Parameters

For passing binary data to DLLs:

```c
import pascal lib "kernel" SomeFunc(
    in: structure buffer,
    returns: int result
);

// Usage
long Buffer;
CreateStructure(Buffer, 1024);
SetStructureMode(0);  // Write mode
StructureInt(Buffer, 0, value);
SomeFunc(Buffer, result);
```

## Comments

### Single-Line Comments

```c
// This is a comment
int x = 5;  // Inline comment
```

### Multi-Line Comments

```c
/* This is a
   multi-line
   comment */

/*
 * Block comment style
 * with asterisks
 */
```

## Limitations

### Known Constraints

1. **String length**: Maximum 150 characters for constants
2. **Whitespace**: Maximum 200 whitespace characters between tokens
3. **No arrays**: Use String Arrays (`StrArrayCreate`) for collections
4. **No structs**: Use memory buffers with Structure functions
5. **No pointers**: Use handles and Structure functions
6. **No recursion**: State machines should not call themselves directly
7. **Limited standard library**: Must use INPA-specific functions

### Unsupported C Features

- `for` loops (use `while`)
- `switch/case` (use if-else or LOGTABLE)
- `break/continue` (structure code accordingly)
- `++/--` operators (use `x = x + 1`)
- `+=, -=, *=, /=` operators
- Ternary operator `?:`
- Arrays (use String Arrays)
- Structures (use memory buffers)
- Pointers (use handles)
- Function return values (use out parameters)

## Type Conversions

### Built-in Conversions

```c
// Integer to String
int i = 42;
string s;
inttostring(i, s);  // s = "42"

// String to Integer
string s = "123";
int i;
stringtoint(s, i);  // i = 123

// Real to String
real r = 3.14;
string s;
realtostring(r, "2.2", s);  // s = "3.14"

// String to Real
string s = "3.14";
real r;
stringtoreal(s, r);  // r = 3.14

// Integer to Real
int i = 42;
real r;
inttoreal(i, r);  // r = 42.0

// Real to Integer
real r = 3.7;
int i;
realtoint(r, i);  // i = 3 (truncated)

// Byte to Integer
byte b = 255;
int i;
bytetoint(b, i);  // i = 255 (or -1 if signed interpretation)

// Integer to Long
int i = 32000;
long l;
inttolong(i, l);

// Long to Real
long l = 1000000;
real r;
longtoreal(l, r);
```

## Best Practices

### 1. Initialize Variables

```c
// Good
int counter = 0;
bool flag = FALSE;
string message = "";

// Bad - undefined initial value
int counter;
bool flag;
```

### 2. Use Meaningful Names

```c
// Good
int retry_count = 0;
bool motor_running = FALSE;
string error_message;

// Bad
int x = 0;
bool f = FALSE;
string s;
```

### 3. Comment Complex Logic

```c
// Calculate checksum using XOR of all bytes
int checksum = 0;
int i = 0;
while (i < data_length) {
    // XOR each byte into checksum
    checksum = checksum + data[i];  // Simplified - actual XOR needs function
    i = i + 1;
}
```

### 4. Use Functions for Reusable Code

```c
// Good - reusable function
show_error(in: string message)
{
    messagebox("Error", message);
}

// Usage
show_error("Connection failed");
show_error("Invalid response");
```

### 5. Clean Up Resources

```c
inpainit()
{
    INPAapiInit();
    // ...
}

inpaexit()
{
    INPAapiEnd();  // Always clean up
}
```

### 6. Handle Errors

```c
// Check return values
bool rc;
INP1apiInit(rc);
if (rc == FALSE) {
    messagebox("Error", "Failed to initialize EDIABAS");
    exit();
}

// Check input state
int state;
inputint(value, "Input", "Enter value:", 0, 100);
getinputstate(state);
if (state == 1) {
    // User cancelled - handle appropriately
    return;
}
```

### 7. Use Constants for Magic Numbers

```c
// Good
int TIMEOUT_MS = 5000;
int MAX_RETRIES = 3;
int BUFFER_SIZE = 1024;

// Bad
settimer(0, 5000);
if (retries > 3) { ... }
CreateStructure(buf, 1024);
```
