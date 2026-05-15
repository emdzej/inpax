# INPA UI System Reference

This document describes the INPA UI system, including SCREENs, MENUs, LINEs, and the layout system.

## Overview

INPA provides a text-based UI system consisting of:

- **SCREENs** - Display areas containing logical lines
- **MENUs** - Function key handlers (F1-F10, Shift+F1-F10)
- **LINEs** - Logical groupings of display elements within screens
- **Userboxes** - Overlay dialog windows

## Virtual Screen Concept

INPA uses a **virtual screen** model:
- Maximum 30 rows × 80 columns of text
- Unlimited number of logical lines (LINEs)
- Scrollable viewport on the virtual screen
- Coordinates are always relative to the start of each LINE

## SCREEN Structure

### Basic Syntax

```c
SCREEN screen_name()
{
    // Global screen code (runs every cycle)
    
    LINE("LineName", "API-String") {
        // LINE-specific code (runs only when visible)
    }
    
    LINE("AnotherLine", "") {
        // Another logical line
        
        CONTROL {
            // Control block - runs on control() activation
        }
    }
}
```

### Screen Components

#### Global Screen Code

Code outside LINE blocks runs on **every screen cycle**, regardless of which lines are visible:

```c
SCREEN s_status()
{
    // This always runs
    INPAapiJob("ecu", "status", "", "");
    INPAapiCheckJobStatus("OKAY");
    
    text(0, 0, "ECU Status Display");
    
    LINE("Line1", "") {
        // This only runs when Line1 is visible
    }
}
```

#### LINE Blocks

LINEs are logical groupings that can span multiple physical rows:

```c
LINE("SelectName", "API-ResultParams") {
    // SelectName: Displayed in selection menu
    // API-ResultParams: EDIABAS result parameters for optimization
    
    // Coordinates are RELATIVE to start of this LINE
    text(0, 1, "First row of this line");
    text(1, 1, "Second row of this line");
    text(2, 0, "");  // Empty row for spacing
}
```

**LINE Parameters:**

| Parameter | Description |
|-----------|-------------|
| SelectName | Name shown in line selection menu |
| API-ResultParams | EDIABAS result parameters (for optimization with `getapistring()`) |

#### CONTROL Blocks

CONTROL blocks contain code that runs only when `control()` is called:

```c
SCREEN s_control_demo()
{
    LINE("Motor Control", "") {
        textout("Motor Status:", 0, 1);
        digitalout(motor_running, 0, 20, "ON", "OFF");
        
        CONTROL {
            // This runs when user activates control for this line
            INPAapiJob("ecu", "toggle_motor", "", "");
            INPAapiCheckJobStatus("OKAY");
        }
    }
}

MENU m_control()
{
    ITEM(1, "Activate") {
        control();  // Triggers CONTROL blocks in current screen
    }
}
```

### Coordinate System

Coordinates in INPA are **row, column** (not x, y):

```
Column:  0    5    10   15   20   25   30   35   40   ...   79
Row 0:   |----|----|----|----|----|----|----|----|----...---|
Row 1:   |----|----|----|----|----|----|----|----|----...---|
Row 2:   |----|----|----|----|----|----|----|----|----...---|
...
Row 29:  |----|----|----|----|----|----|----|----|----...---|
```

**Within a LINE**, coordinates are relative:

```c
LINE("MyLine", "") {
    // Row 0 = first row of this LINE
    // Row 1 = second row of this LINE
    text(0, 0, "This is at the start of MyLine");
    text(1, 10, "This is on the second row, column 10");
}
```

### Screen Activation

```c
setscreen(screen_name, frequency_flag)
```

| Flag | Behavior |
|------|----------|
| TRUE | Cyclic refresh - screen code runs continuously |
| FALSE | Single pass - screen code runs once |

**Example:**
```c
ITEM(1, "Status") {
    setscreen(s_status, TRUE);   // Continuously update status
}

ITEM(2, "Info") {
    setscreen(s_info, FALSE);    // Show static info once
}
```

## MENU Structure

### Basic Syntax

```c
MENU menu_name()
{
    INIT {
        // Runs once when menu is activated
        setmenutitle("Menu Title");
    }
    
    ITEM(1, "F1 Label") {
        // Code for F1
    }
    
    ITEM(2, "F2 Label") {
        // Code for F2
    }
    
    // ... items 3-10 for F3-F10
    
    ITEM(11, "SF1 Label") {
        // Code for Shift+F1
    }
    
    // ... items 12-20 for Shift+F2-F10
}
```

### Item Numbers

| Item Number | Key |
|-------------|-----|
| 1-10 | F1-F10 |
| 11-20 | Shift+F1 to Shift+F10 |

**Note:** Pressing Shift automatically switches the function key bar display.

### INIT Block

The INIT block runs **once** when the menu is activated via `setmenu()`:

```c
MENU m_main()
{
    INIT {
        setmenutitle("Main Menu");
        INPAapiInit();  // Initialize EDIABAS once
    }
    
    ITEM(1, "Start") {
        // ...
    }
}
```

### Dynamic Menu Items

Use `setitem()` to change item text and state dynamically:

```c
MENU m_dynamic()
{
    bool motor_on;
    
    INIT {
        motor_on = FALSE;
        setmenutitle("Motor Control");
    }
    
    ITEM(1, "Motor ON") {
        if (motor_on == FALSE) {
            INPAapiJob("ecu", "motor_on", "", "");
            motor_on = TRUE;
            setitem(1, "Motor OFF", TRUE);  // Change button text
        } else {
            INPAapiJob("ecu", "motor_off", "", "");
            motor_on = FALSE;
            setitem(1, "Motor ON", TRUE);
        }
    }
    
    ITEM(2, "Disabled") {
        // Initially disabled
    }
}

// Enable item 2 from somewhere else:
setitem(2, "Now Enabled", TRUE);

// Disable item 2:
setitem(2, "Disabled", FALSE);  // Grayed out, can't be clicked
```

### Repeating Items

Enable continuous execution while key is held:

```c
MENU m_jog()
{
    INIT {
        setitemrepeat(1, TRUE);  // F1 repeats while held
        setitemrepeat(2, TRUE);  // F2 repeats while held
    }
    
    ITEM(1, "Move Up") {
        // Called repeatedly while F1 is held
        move_up_one_step();
    }
    
    ITEM(2, "Move Down") {
        // Called repeatedly while F2 is held
        move_down_one_step();
    }
}
```

## Output Functions

### Text Output

#### text(row, col, string)
Simple text output with literal string:

```c
text(0, 0, "Hello World");
text(1, 5, "Indented text");
```

#### textout(variable, row, col)
Text output from variable:

```c
string status;
INPAapiResultText(status, "STATUS", 1, "");
textout(status, 2, 10);
```

#### ftextout(text, row, col, size, attr)
Formatted text with size and attributes:

```c
// Size: 0=normal, 1=medium, 2=large
// Attr: 0=normal, 1=bold, 2=italic, 4=underline (combinable)

ftextout("Normal", 0, 0, 0, 0);
ftextout("Bold", 1, 0, 0, 1);
ftextout("Large Bold Italic", 2, 0, 2, 3);  // 1+2=bold+italic
ftextout("Underlined", 3, 0, 0, 4);
ftextout("All attributes", 4, 0, 1, 7);  // 1+2+4=all
```

### Digital Output (Boolean Display)

```c
digitalout(value, row, col, trueText, falseText)
```

Displays a boolean as a visual indicator:
- **FALSE**: Empty circle (○)
- **TRUE**: Filled dot (●)

```c
bool motor_on = TRUE;
digitalout(motor_on, 5, 20, " ON ", " OFF ");
// Displays: ● ON
```

### Analog Output (Bar Graph)

```c
analogout(value, row, col, min, max, minValid, maxValid, format)
```

Displays a value as a horizontal bar graph:
- Red zone: below minValid or above maxValid
- Green zone: between minValid and maxValid
- Numeric value displayed beside bar

```c
real voltage = 13.2;
analogout(voltage, 3, 10, 0.0, 16.0, 11.5, 14.5, "2.1");
//         │       │   │    │     │     │      │
//         │       │   │    │     │     │      └─ Format: 2 int, 1 decimal
//         │       │   │    │     │     └──────── Max valid (green zone end)
//         │       │   │    │     └────────────── Min valid (green zone start)
//         │       │   │    └──────────────────── Max display range
//         │       │   └───────────────────────── Min display range
//         │       └───────────────────────────── Column
//         └───────────────────────────────────── Row
```

Use `multianalogout()` for triangle indicator mode:
```c
multianalogout(value, row, col, min, max, minValid, maxValid, format, mode)
// mode: 1=triangle, other=bar
```

### Hex Dump

```c
hexdump(startAddress, numBytes, row, col)
```

Displays binary data from EDIABAS buffer:

```c
INPAapiResultBinary("DATA", 1);
hexdump("0", 32, 5, 10);  // Show 32 bytes starting at offset 0
```

### Screen Clearing

```c
blankscreen();           // Clear entire screen
clearrect(5, 10, 3, 40); // Clear rectangle: row 5, col 10, 3 rows, 40 cols
ftextclear("text", row, col, size, attr);  // Clear specific ftextout area
```

## Dialog Boxes

### Message Boxes

```c
messagebox("Title", "Message text");   // With exclamation icon
infobox("Title", "Info text");         // With info (i) icon
```

Both pause script execution until user clicks OK.

### Input Dialogs

#### Text Input
```c
string name;
inputtext(name, "Enter Name", "Please enter your name:");
```

#### Numeric Input
```c
int count;
inputint(count, "Enter Count", "Number of iterations:", 1, 100);

real temperature;
inputnum(temperature, "Temperature", "Enter value:", -40.0, 150.0);
```

#### Hex Input
```c
string address;
inputhex(address, "Address", "Enter start address:", "0x0000", "0xFFFF");
```

#### Boolean Input
```c
bool confirm;
inputdigital(confirm, "Confirm", "Proceed with operation?", "No", "Yes");
```

#### Multiple Field Input
```c
int start, end;
input2int(start, end, "Range", "Enter range:", 
          "Start:", "End:", 0, 1000, 0, 1000);

string hex1, hex2;
input2hex(hex1, hex2, "Addresses", "Enter addresses:",
          "Start:", "End:", "0x0000", "0xFFFF", "0x0000", "0xFFFF");
```

#### Check Input Status
```c
int state;
inputint(value, "Input", "Enter value:", 0, 100);
getinputstate(state);
if (state == 0) {
    // User clicked OK
} else if (state == 1) {
    // User cancelled
}
```

## Userboxes

Userboxes are overlay windows that float above the main screen.

### Opening Userboxes

```c
userboxopen(boxNum, row, col, height, width, title, text)
```

| Parameter | Description |
|-----------|-------------|
| boxNum | Box number 0-11 |
| row | Top-left row |
| col | Top-left column |
| height | Height in rows |
| width | Width in columns |
| title | Title (affects frame style) |
| text | Initial text content |

**Frame Styles:**

| Box# | With Title | Without Title |
|------|------------|---------------|
| 0-3 | Bold frame | Normal frame |
| 4-7 | Normal frame | Normal frame |
| 8-11 | Normal frame | No frame |

```c
// Bold-framed progress box
userboxopen(0, 10, 20, 5, 40, "Progress", "Processing...");

// Frameless notification
userboxopen(8, 15, 30, 3, 30, "", "Operation complete");
```

### Writing to Userboxes

```c
userboxftextout(boxNum, text, row, col, size, attr)
```

Coordinates are relative to the userbox interior.

**Additional Attributes for Userbox:**

| Value | Effect |
|-------|--------|
| 8 | Vertically centered (row ignored) |
| 16 | Horizontally centered (col ignored) |
| 24 | Both centered |

```c
userboxopen(0, 5, 10, 8, 50, "Status", "");
userboxftextout(0, "Centered Title", 0, 0, 1, 24);  // Centered both ways
userboxftextout(0, "Left aligned", 2, 2, 0, 0);
```

### Userbox Colors

```c
userboxsetcolor(boxNum, fgColor, bgColor)
```

### Closing Userboxes

```c
userboxclear(boxNum);  // Clear contents but keep open
userboxclose(boxNum);  // Close and remove
```

### Userbox Example

```c
// Progress indicator pattern
userboxopen(0, 10, 20, 5, 40, "Processing", "");
userboxftextout(0, "Reading fault memory...", 2, 2, 0, 0);

INPAapiFsLesen("ecu", "fs.tmp");

userboxftextout(0, "Complete!", 2, 2, 0, 1);
delay(1000);
userboxclose(0);
```

## Line Selection

Users can select lines for enlarged display:

### Programmatic Selection

```c
select(FALSE);  // Single selection mode
select(TRUE);   // Multiple selection mode
deselect();     // Return to full view
```

### Saved Selections (Sets)

Users can save selection combinations:
1. Select lines
2. Enter name in dialog
3. Click "Save"

Sets are stored in `<scriptname>.INI` in SGDAT directory.

### Getting Selected Line Info

```c
string apiParams;
getapistring(TRUE, FALSE, apiParams);
// Returns API parameters for visible lines
// TRUE = include count prefix
// FALSE = visible area only (TRUE = entire screen)
```

```c
string toggleParams;
togglelist(TRUE, TRUE, toggleParams);
// Shows selection dialog, returns parameters
```

## Colors

### Screen Colors

```c
setcolor(fgColor, bgColor)
```

### Color Values

| Value | Color |
|-------|-------|
| 0 | White |
| 1 | Black |
| 2 | Light Gray |
| 3 | Gray |
| 4 | Bright Red |
| 5 | Dark Red |
| 6 | Red-Violet |
| 7 | Red-Lilac |
| 8 | Bright Yellow |
| 9 | Olive |
| 10 | Bright Green |
| 11 | Dark Green |
| 12 | Light Cyan |
| 13 | Muted Cyan |
| 14 | Bright Blue |
| 15 | Blue |

## Complete UI Example

```c
#include "inpa.h"

string ecu_status;
real voltage;
bool motor_running;

SCREEN s_main()
{
    // Header (always runs)
    ftextout("ECU Diagnostic Display", 0, 20, 1, 1);
    text(1, 0, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    // Get status data
    INPAapiJob("ecu", "status", "", "");
    INPAapiCheckJobStatus("OKAY");
    
    LINE("Status", "STATUS_TEXT") {
        text(0, 2, "Status:");
        INPAapiResultText(ecu_status, "STATUS_TEXT", 1, "");
        textout(ecu_status, 0, 20);
        text(1, 0, "");
    }
    
    LINE("Voltage", "VOLTAGE") {
        text(0, 2, "Battery Voltage:");
        INPAapiResultAnalog(voltage, "VOLTAGE", 1);
        analogout(voltage, 0, 25, 0.0, 16.0, 11.5, 14.5, "2.1");
        text(1, 0, "");
        
        CONTROL {
            // Calibrate voltage sensor
            INPAapiJob("ecu", "calibrate_voltage", "", "");
            messagebox("Calibration", "Voltage sensor calibrated");
        }
    }
    
    LINE("Motor", "MOTOR_STATUS") {
        text(0, 2, "Motor:");
        INPAapiResultDigital(motor_running, "MOTOR_RUNNING", 1);
        digitalout(motor_running, 0, 15, " RUNNING ", " STOPPED ");
        text(1, 0, "");
        
        CONTROL {
            // Toggle motor
            if (motor_running == TRUE) {
                INPAapiJob("ecu", "motor_off", "", "");
            } else {
                INPAapiJob("ecu", "motor_on", "", "");
            }
        }
    }
}

MENU m_main()
{
    INIT {
        INPAapiInit();
        setmenutitle("Main Menu");
    }
    
    ITEM(1, "Refresh") {
        // Force screen refresh (already cyclic, but for demo)
        setscreen(s_main, TRUE);
    }
    
    ITEM(2, "Control") {
        control();  // Activate CONTROL blocks
    }
    
    ITEM(3, "Select") {
        select(FALSE);  // Enter line selection mode
    }
    
    ITEM(4, "Deselect") {
        deselect();  // Return to full view
    }
    
    ITEM(5, "Faults") {
        INPAapiFsLesen("ecu", "faults.tmp");
        viewopen("faults.tmp", "Fault Memory");
    }
    
    ITEM(6, "Close View") {
        viewclose();
    }
    
    ITEM(10, "Exit") {
        INPAapiEnd();
        exit();
    }
}

inpainit()
{
    settitle("ECU Diagnostic Tool");
    setmenu(m_main);
    setscreen(s_main, TRUE);
}

inpaexit()
{
    INPAapiEnd();
}
```

## Layout Best Practices

### 1. Use Consistent Spacing

```c
LINE("Section", "") {
    ftextout("Section Header", 0, 2, 1, 1);
    text(1, 4, "Detail 1:");
    textout(value1, 1, 20);
    text(2, 4, "Detail 2:");
    textout(value2, 2, 20);
    text(3, 0, "");  // Spacing line
}
```

### 2. Align Related Data

```c
// Use consistent column positions
int label_col = 2;
int value_col = 25;

text(0, label_col, "Engine Speed:");
textout(rpm_str, 0, value_col);
text(1, label_col, "Coolant Temp:");
textout(temp_str, 1, value_col);
text(2, label_col, "Battery:");
textout(volt_str, 2, value_col);
```

### 3. Group Related Information in LINEs

```c
LINE("Engine Data", "RPM;TEMP;LOAD") {
    // All engine-related data together
}

LINE("Transmission", "GEAR;RATIO") {
    // All transmission data together
}
```

### 4. Use Headers and Separators

```c
SCREEN s_organized()
{
    ftextout("═══════════════════════════════════════", 0, 0, 0, 0);
    ftextout("   DIAGNOSTIC REPORT", 1, 0, 1, 1);
    ftextout("═══════════════════════════════════════", 2, 0, 0, 0);
    
    LINE("Section1", "") {
        text(0, 0, "─────────────────────────────────────");
        // Content
    }
}
```

### 5. Reserve Box Numbers Consistently

```c
// Convention: 
// Box 0: Progress/busy indicator
// Box 1-3: Status messages
// Box 4-7: Data display
// Box 8-11: Frameless notifications
```
