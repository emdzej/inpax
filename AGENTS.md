# INPA / IPS Scripting Language Guide

## Overview
INPA (Interpreter for Test Procedures) is a scripting system used for BMW diagnostics. It allows creating `.IPS` (source) files which are compiled into `.IPO` (object) files. These scripts control the diagnostic interface (EDIABAS) to communicate with vehicle ECUs.

Key features:
- C-like syntax
- Built-in UI functions (text, menus, graphs)
- EDIABAS interface for ECU communication
- State machine support for background tasks

## File Structure

A standard `.IPS` file structure:

```c
// 1. Pragmas & Includes
#include "inpa.h"

// 2. Global Variables
string myText;
int myCounter;
real voltage;

// 3. Main Entry Point (Required)
inpainit()
{
   INPAapiInit(); // Initialize EDIABAS
   settitle("My Test Script");
   setmenu(m_main);
   setscreen(s_main, TRUE);
}

// 4. Exit Point (Required)
inpaexit()
{
   INPAapiEnd(); // Cleanup EDIABAS
}

// 5. Screen Definitions
SCREEN s_main()
{
   // UI layout & periodic updates
   text(1, 0, "Main Menu");
}

// 6. Menu Definitions
MENU m_main()
{
   INIT {
      setmenutitle("Main");
   }
   ITEM(10, "Exit") {
      exit();
   }
}
```

## Language Elements

### Variables & Types
- `byte` (8-bit int)
- `int` (16-bit int)
- `long` (32-bit int)
- `real` (double float)
- `bool` (TRUE/FALSE)
- `string` (null-terminated)

### Control Structures
Standard C-style controls:
- `if (condition) { ... } else { ... }`
- `while (condition) { ... }`
- Logic: `&&`, `||`, `!`, `==`, `!=`, `>`, `<`
- Binary: `&`, `|`, `^`

### Functions
User functions:
```c
my_function(in: int a, out: int b) {
  b = a + 1;
}
```
Parameter directions: `in`, `out`, `inout`.

## User Interface

### Screens (`SCREEN`)
Defines visual layout. Can be cyclic (`frequ=TRUE`).
```c
SCREEN s_status()
{
   // Static text
   text(0, 0, "Status:");
   
   // Periodic job
   INPAapiJob("MY_ECU", "STATUS_READ", "", "");
   
   // Display result
   LINE("Voltage", "") {
      INPAapiResultAnalog(voltage, "STAT_UBATT", 1);
      analogout(voltage, 2, 10, 0.0, 15.0, 11.0, 14.0, "%.2f");
   }
}
```

### Menus (`MENU`)
Defines F-keys (F1-F10).
```c
MENU m_main()
{
   ITEM(1, "Read Error") {
      setscreen(s_error, TRUE);
   }
   ITEM(10, "Exit") {
      exit();
   }
}
```

## EDIABAS Interface (Standard Library)

### Core Functions
- `INPAapiInit()`: Initialize connection.
- `INPAapiJob(sgbd, job, args, result)`: Execute ECU job.
  - `sgbd`: ECU description file (e.g., "DME_M52")
  - `job`: Job name (e.g., "STATUS_LESEN")
- `INPAapiResultText(var, result_name, set, format)`: Get text result.
- `INPAapiResultAnalog(var, result_name, set)`: Get float result.
- `INPAapiFsLesen(sgbd, file)`: Read error memory to file.

### Example: Reading Voltage
```c
real volt;
INPAapiJob("DME", "STATUS_UBATT", "", "");
INPAapiResultAnalog(volt, "STAT_UBATT", 1);
```

## Best Practices
1. **Always include `inpa.h`**.
2. **Initialize/Exit properly**: Call `INPAapiInit()` in `inpainit()` and `INPAapiEnd()` in `inpaexit()`.
3. **Use State Machines** for complex, interruptible sequences (like guided tests).
4. **Error Handling**: Use `INPAapiCheckJobStatus("OKAY")` to verify job success.
5. **Formatting**: Use `analogout` for visual bars for sensor values.

## Compilation
Use `INPACOMP.EXE filename.ips` to compile.
