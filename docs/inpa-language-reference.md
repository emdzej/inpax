# INPA Language Reference

Based on official INPA V2.2 User Documentation (Softing GmbH / BMW AG, 2000-07-20).

**Note:** IPS uses C-like syntax with curly braces, not BASIC-like syntax.

## File Structure

```c
#pragma winedit
#include "inpa.h"

// Global variables
int g_counter;
string ecu_name = "my_ecu";

// Functions
helper() {
    int local_var;
    local_var = 42;
}

// Required entry points
inpainit() {
    settitle("My Script");
}

inpaexit() {
}

// Screens
SCREEN s_main() {
    text(1, 1, "Hello!");
    
    LINE("Label", "tag") {
        // line content
    }
}

// Menus
MENU m_main() {
    INIT {
        setmenutitle("Main");
    }
    
    ITEM(1, "Option 1") {
        // action
    }
    
    ITEM(10, "Exit") {
        exit();
    }
}
```

## Data Types

| Type | Size | Description |
|------|------|-------------|
| `bool` | 1 byte | TRUE/FALSE |
| `byte` | 1 byte | 0-255 |
| `int` | 2 bytes | -32768 to 32767 |
| `long` | 4 bytes | -2^31 to 2^31-1 |
| `real` | 8 bytes | IEEE 754 double |
| `string` | variable | Text, use `string[80]` for arrays |

## Variables

### Global
```c
int counter;
string message = "Hello";
bool flag = TRUE;
string[80] buffer;  // String array with size
```

### Local
```c
function_name() {
    int x;
    int y = 10;
    string[256] text;
}
```

## Functions

### User Functions
```c
// No return type (void)
my_function() {
    // body
}

// With parameters
process_data(int value, string name) {
    // body
}
```

### Required Entry Points
Every IPS script must define:
- `inpainit()` — Called on startup
- `inpaexit()` — Called on shutdown

## Control Structures

### if-else
```c
if (condition) {
    // then
} else if (other_condition) {
    // else if
} else {
    // else
}
```

### while
```c
while (condition) {
    // body
}
```

### for
```c
for (i = 0; i < 10; i = i + 1) {
    // body
}
```

## Operators

### Arithmetic
`+`, `-`, `*`, `/`, `%`

### Comparison
`==`, `!=`, `<`, `>`, `<=`, `>=`

### Logical
`&&` (and), `||` (or), `!` (not)

Also supported: `AND`, `OR`, `NOT` (case-insensitive)

### Bitwise
`&`, `|`, `^`

### Increment/Decrement
`++`, `--` (prefix and postfix)

## UI Elements

### SCREEN
```c
SCREEN s_name() {
    // Global screen code runs first
    text(0, 0, "Title");
    
    LINE("Row Label", "TAG") {
        // Line-specific code
        textout("Value: ");
    }
}
```

### MENU
```c
MENU m_name() {
    INIT {
        setmenutitle("Menu Title");
    }
    
    ITEM(1, "First Option") {
        // Action when selected
        setscreen(s_main, TRUE);
    }
    
    ITEM(10, "Exit") {
        exit();
    }
}
```

## Standard Library Functions

### Window/Screen
- `settitle(string title)` — Set window title
- `setscreen(screen, bool refresh)` — Switch screen
- `setmenu(menu)` — Set active menu
- `setmenutitle(string title)` — Set menu title

### Output
- `text(row, col, string)` — Print at position
- `textout(string)` — Print at current position
- `ftextout(string, row, col, size, style)` — Formatted text

### Input
- `inputint(string prompt)` — Input integer
- `inputstring(string prompt)` — Input string

### Dialog
- `messagebox(string title, string text)` — Show message

### EDIABAS
- `INPAapiInit()` — Initialize EDIABAS
- `INPAapiEnd()` — Close EDIABAS
- `INPAapiJob(ecu, job, params, results)` — Execute job
- `INPAapiCheckJobStatus(string expected)` — Check status
- `INPAapiResultText(out string, name, set, format)` — Get text result

### System
- `delay(int ms)` — Wait milliseconds
- `exit()` — Exit program
- `settimer(int ms)` — Set refresh timer

## Comments

```c
// Single line comment

/* 
   Multi-line
   comment
*/
```

## Preprocessor

```c
#include "inpa.h"      // Include file
#pragma winedit        // Editor hint
```

## Example: Complete Script

```c
#include "inpa.h"

string ecu = "DME";
bool connected = FALSE;

connect() {
    INPAapiInit();
    INPAapiJob(ecu, "IDENT", "", "");
    INPAapiCheckJobStatus("OKAY");
    connected = TRUE;
}

disconnect() {
    if (connected == TRUE) {
        INPAapiJob(ecu, "DIAGNOSE_ENDE", "", "");
        INPAapiEnd();
        connected = FALSE;
    }
}

SCREEN s_main() {
    ftextout("ECU Diagnostic", 0, 20, 1, 1);
    
    LINE("Status", "") {
        text(0, 2, "Connected:");
        digitalout(connected, 0, 15, "YES", "NO");
    }
}

MENU m_main() {
    INIT {
        setmenutitle("Main Menu");
    }
    
    ITEM(1, "Connect") {
        connect();
    }
    
    ITEM(10, "Exit") {
        disconnect();
        exit();
    }
}

inpainit() {
    settitle("ECU Tool");
    setmenu(m_main);
    setscreen(s_main, TRUE);
}

inpaexit() {
    disconnect();
}
```

## See Also

- Full PDF: `docs/INPA_V2.2_User_Documentation.pdf`
- Examples: `docs/reference/examples.md`
- System functions: `docs/system-functions.md`
