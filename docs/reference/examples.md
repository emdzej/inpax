# INPA Code Examples

This document provides code examples demonstrating common INPA patterns extracted from the official documentation.

## Table of Contents

- [Basic Script Structure](#basic-script-structure)
- [EDIABAS Integration](#ediabas-integration)
- [State Machine Patterns](#state-machine-patterns)
- [UI Patterns](#ui-patterns)
- [File Operations](#file-operations)
- [String Array Usage](#string-array-usage)
- [Logic Tables](#logic-tables)
- [Select/Control/Toggle](#selectcontroltoggle)
- [Timer Usage](#timer-usage)
- [Imported Functions](#imported-functions)

---

## Basic Script Structure

### Minimal Script

```c
#include "inpa.h"

SCREEN s_main()
{
    text(1, 1, "Hello INPA!");
}

MENU m_main()
{
    INIT {
        setmenutitle("Main Menu");
    }
    
    ITEM(10, "Exit") {
        exit();
    }
}

inpainit()
{
    settitle("Minimal Script");
    setmenu(m_main);
    setscreen(s_main, TRUE);
}

inpaexit()
{
}
```

### Complete Script Template

```c
//
// Script: template.ips
// Description: Complete INPA script template
//

#pragma winedit
#include "inpa.h"

//************************************
// GLOBAL VARIABLES
//************************************

string ecu_name = "my_ecu";
bool connected = FALSE;

//************************************
// USER-DEFINED FUNCTIONS
//************************************

connect_ecu()
{
    INPAapiInit();
    INPAapiJob(ecu_name, "IDENT", "", "");
    INPAapiCheckJobStatus("OKAY");
    connected = TRUE;
}

disconnect_ecu()
{
    if (connected == TRUE) {
        INPAapiJob(ecu_name, "DIAGNOSE_ENDE", "", "");
        INPAapiEnd();
        connected = FALSE;
    }
}

//************************************
// SCREENS
//************************************

SCREEN s_main()
{
    ftextout("ECU Diagnostic System", 0, 20, 1, 1);
    
    LINE("Connection Status", "") {
        text(0, 2, "ECU Connected:");
        digitalout(connected, 0, 20, " YES ", " NO ");
        text(1, 0, "");
    }
}

SCREEN s_ident()
{
    string part_number;
    string hw_version;
    string sw_version;
    
    INPAapiJob(ecu_name, "IDENT", "", "");
    INPAapiCheckJobStatus("OKAY");
    
    LINE("Part Number", "ID_BMW_NR") {
        text(0, 2, "BMW Part Number:");
        INPAapiResultText(part_number, "ID_BMW_NR", 1, "");
        textout(part_number, 0, 25);
        text(1, 0, "");
    }
    
    LINE("Hardware", "ID_HW_NR") {
        text(0, 2, "Hardware Version:");
        INPAapiResultText(hw_version, "ID_HW_NR", 1, "");
        textout(hw_version, 0, 25);
        text(1, 0, "");
    }
    
    LINE("Software", "ID_SW_NR") {
        text(0, 2, "Software Version:");
        INPAapiResultText(sw_version, "ID_SW_NR", 1, "");
        textout(sw_version, 0, 25);
        text(1, 0, "");
    }
}

//************************************
// MENUS
//************************************

MENU m_main()
{
    INIT {
        setmenutitle("Main Menu");
    }
    
    ITEM(1, "Connect") {
        connect_ecu();
        setscreen(s_main, TRUE);
    }
    
    ITEM(2, "Ident") {
        if (connected == TRUE) {
            setscreen(s_ident, TRUE);
        } else {
            messagebox("Error", "ECU not connected!");
        }
    }
    
    ITEM(5, "Faults") {
        if (connected == TRUE) {
            INPAapiFsLesen(ecu_name, "faults.tmp");
            viewopen("faults.tmp", "Fault Memory");
        }
    }
    
    ITEM(6, "Close") {
        viewclose();
    }
    
    ITEM(10, "Exit") {
        disconnect_ecu();
        exit();
    }
}

//************************************
// ENTRY POINTS
//************************************

inpainit()
{
    settitle("ECU Diagnostic Tool");
    setmenu(m_main);
    setscreen(s_main, TRUE);
}

inpaexit()
{
    disconnect_ecu();
}
```

---

## EDIABAS Integration

### Basic Job Execution

```c
SCREEN s_ediabas_basic()
{
    string t0, t1;
    int i;
    int sets;
    string str;
    
    INPAapiJob("sm_rd", "IDENT", "", "");
    INPAapiCheckJobStatus("OKAY");
    INPAapiResultSets(sets);
    
    inttostring(sets, str);
    text(2, 0, "Result Sets: " + str);
    
    LINE("ResultText", "") {
        text(0, 1, "BMW Part Number: ");
        INPAapiResultText(t0, "ID_BMW_NR", 1, "");
        textout(t0, 0, 35);
        text(2, 0, "");
    }
    
    LINE("ResultInt", "") {
        text(0, 1, "Hardware Number: ");
        INPAapiResultInt(i, "ID_HW_NR", 1);
        inttostring(i, str);
        textout(str, 0, 35);
    }
}
```

### Analog and Digital Results

```c
SCREEN s_status()
{
    real voltage;
    bool motor_signal;
    
    LINE("Analog Data", "") {
        INPAapiJob("sm_rd", "STATUS_ANALOG_LESEN", "", "");
        INPAapiCheckJobStatus("OKAY");
        text(0, 1, "Sensor Value [V]: ");
        INPAapiResultAnalog(voltage, "STAT_SENSOR_WERT", 1);
        analogout(voltage, 1, 30, 0.0, 5.0, 0.0, 5.0, "");
    }
    
    LINE("Digital Data", "") {
        INPAapiJob("sm_rd", "STATUS_DIGITAL_LESEN", "", "");
        INPAapiCheckJobStatus("OKAY");
        text(0, 1, "Motor Signal: ");
        INPAapiResultDigital(motor_signal, "STAT_MOTOR_EIN", 1);
        digitalout(motor_signal, 1, 30, " ON ", " OFF ");
    }
}
```

### Binary Data and Hex Dump

```c
string hexstr;
string startadr = "0";
int NumBytes;
bool dumpflag = FALSE;

SCREEN s_hexdump()
{
    LINE("Memory Dump", "") {
        if (dumpflag == TRUE) {
            INPAapiJob("sm_rd", "RAM_LESEN", hexstr, "");
            INPAapiCheckJobStatus("OKAY");
            INPAapiResultBinary("DATEN", 1);
            hexdump(startadr, NumBytes, 2, 10);
        }
    }
}

MENU m_hexdump()
{
    ITEM(1, "Read Memory") {
        int high, mid, low, seg;
        string highstr, lowstr, NumStr;
        
        input2hexnum(hexstr, NumBytes, "Read Memory",
                     "Enter address and length:",
                     "Start Address", "Number of Bytes",
                     "0x0000", "0xFFFFFFFF", 0, 100);
        
        hexconvert(hexstr, high, mid, low, seg);
        inttostring(low, lowstr);
        inttostring(NumBytes, NumStr);
        startadr = hexstr;
        hexstr = lowstr + ";" + NumStr;
        dumpflag = TRUE;
    }
}
```

### Direct API (No Error Handling)

```c
SCREEN s_direct_api()
{
    int i;
    int sets;
    string str;
    bool rc;
    
    INP1apiJob("sm_rd", "IDENT", "", "");
    
    // Wait for job completion with timeout
    i = 0;
    settimer(0, 5000);
    while (i != 1) {
        INP1apiState(i);
        inttostring(i, str);
        text(2, 0, "API State: " + str);
        
        bool timeout;
        testtimer(0, timeout);
        if (timeout == TRUE) {
            messagebox("Error", "Timeout waiting for response!");
            exit();
        }
    }
    
    INP1apiResultSets(rc, sets);
    if (rc == FALSE) {
        int errorCode;
        string errorText;
        INP1apiErrorCode(errorCode);
        INP1apiErrorText(errorText);
        messagebox("Error", errorText);
    }
    
    LINE("Results", "") {
        string t0;
        INP1apiResultText(rc, t0, "ID_BMW_NR", 1, "");
        if (rc == TRUE) {
            textout(t0, 0, 35);
        } else {
            textout("Error reading result", 0, 35);
        }
    }
}
```

### Fault Memory Reading

```c
string ECU = "abs5_a";
string FsFile = "FsFile.tmp";
int FsMode = 0xFF;  // Show all details

read_faults(in: string ecu)
{
    INPAapiFsLesen(ecu, FsFile);
    INPAapiJob(ecu, "DIAGNOSE_ENDE", "", "");
    viewopen(FsFile, "Fault Memory Contents");
}

MENU m_faults()
{
    INIT {
        // Configure fault reading
        INPAapiFsMode(FsMode, "w", "", "", "");
    }
    
    ITEM(1, "Read FS") {
        read_faults(ECU);
    }
    
    ITEM(2, "Toggle Details") {
        if (FsMode == 0xFF) {
            FsMode = 0x07;  // Location, environment, type only
            messagebox("Mode", "Basic details only");
        } else {
            FsMode = 0xFF;  // All details
            messagebox("Mode", "Full details");
        }
        INPAapiFsMode(FsMode, "w", "", "", "");
    }
    
    ITEM(3, "Close") {
        viewclose();
    }
}
```

---

## State Machine Patterns

### Basic State Machine with Timer

```c
int tn_delay = 0;
int tv_delay = 1000;
bool var_digital_1;

STATEMACHINE sm_toggle()
{
    bool expired_flag;
    
    INIT {
        var_digital_1 = FALSE;
        settimer(tn_delay, tv_delay);
        setstate(Z_TOGGLE);
    }
    
    Z_TOGGLE {
        testtimer(tn_delay, expired_flag);
        if (expired_flag == TRUE) {
            // Toggle the variable
            if (var_digital_1 == TRUE)
                var_digital_1 = FALSE;
            else
                var_digital_1 = TRUE;
            
            // Reset timer
            settimer(tn_delay, tv_delay);
        }
        // Stay in Z_TOGGLE state
    }
}

SCREEN s_toggle_demo()
{
    LINE("Toggle Demo", "") {
        ftextout("Digital Value:", 1, 5, 0, 1);
        digitalout(var_digital_1, 2, 30, "ON ", "OFF");
    }
}

inpainit()
{
    setscreen(s_toggle_demo, TRUE);
    setstatemachine(sm_toggle);
}
```

### Sub-State Machine Pattern

```c
// Reusable delay state machine
STATEMACHINE sm_delay()
{
    bool expired;
    
    INIT {
        settimer(1, 1000);
        setstate(Z_WAIT);
    }
    
    Z_WAIT {
        testtimer(1, expired);
        if (expired == TRUE) {
            returnstatemachine();
        }
    }
}

// Main state machine that uses sub-state machine
STATEMACHINE sm_main()
{
    int step;
    
    INIT {
        step = 1;
        setstate(Z_STEP);
    }
    
    Z_STEP {
        string s;
        inttostring(step, s);
        userboxopen(0, 10, 20, 3, 30, "Progress", "Step " + s);
        
        // Do work for this step
        INPAapiJob("ecu", "step_job", s, "");
        
        // Wait using sub-state machine
        callstatemachine(sm_delay);
        
        userboxclose(0);
        step = step + 1;
        
        if (step > 5) {
            setstate(Z_DONE);
        }
        // Else stay in Z_STEP
    }
    
    Z_DONE {
        messagebox("Complete", "All steps finished");
        setstate(Z_END);
    }
    
    Z_END {
        // Idle state - do nothing
    }
}
```

### Motor Control State Machine

```c
STATEMACHINE sm_motor_test()
{
    int try_counter;
    int TRY_MAX = 3;
    string job_status;
    bool motor_running;
    
    INIT {
        try_counter = 0;
        userboxopen(0, 5, 10, 4, 40, "Motor Test", "Please start engine");
        delay(2000);
        setstate(Z_SEND_COMMAND);
    }
    
    Z_SEND_COMMAND {
        if (try_counter < TRY_MAX) {
            INPAapiJob("GSA", "STATUS_LESEN", "", "");
            INPAapiResultText(job_status, "JOB_STATUS", 1, "");
            INPAapiResultDigital(motor_running, "STAT_MOTOR_SIGNAL_EIN", 1);
            try_counter = try_counter + 1;
            setstate(Z_EVALUATE);
        } else {
            setstate(Z_ERROR);
        }
    }
    
    Z_EVALUATE {
        if (motor_running == TRUE) {
            setstate(Z_SUCCESS);
        } else {
            // Retry
            settimer(0, 500);
            setstate(Z_WAIT_RETRY);
        }
    }
    
    Z_WAIT_RETRY {
        bool expired;
        testtimer(0, expired);
        if (expired == TRUE) {
            setstate(Z_SEND_COMMAND);
        }
    }
    
    Z_SUCCESS {
        userboxclose(0);
        messagebox("Success", "Motor signal detected!");
        returnstatemachine();
    }
    
    Z_ERROR {
        userboxclose(0);
        messagebox("Error", "Motor signal not detected after 3 attempts");
        returnstatemachine();
    }
}
```

---

## UI Patterns

### Formatted Text Output

```c
SCREEN s_formatted()
{
    bool flag = TRUE;
    
    textout("Test of formatted text output", 0, 10);
    
    LINE("Size: Normal", "") {
        ftextout("1: Normal size text", 1, 5, 0, 0);
    }
    
    LINE("Size: Medium", "") {
        ftextout("2: Medium size text", 1, 5, 1, 0);
    }
    
    LINE("Size: Large", "") {
        ftextout("3: Large size text", 1, 5, 2, 0);
    }
    
    LINE("Attr: Bold", "") {
        ftextout("4: Bold text", 1, 5, 0, 1);
    }
    
    LINE("Attr: Italic", "") {
        ftextout("5: Italic text", 1, 5, 0, 2);
    }
    
    LINE("Attr: Underline", "") {
        ftextout("6: Underlined text", 1, 5, 0, 4);
    }
    
    LINE("Combined", "") {
        ftextout("7: Bold+Italic+Underline", 1, 5, 1, 7);
    }
}
```

### Userbox Progress Indicator

```c
show_progress(in: string message)
{
    userboxopen(0, 10, 20, 5, 40, "Please Wait", "");
    userboxftextout(0, message, 2, 0, 0, 24);  // Centered
}

hide_progress()
{
    userboxclose(0);
}

// Usage:
ITEM(1, "Process") {
    show_progress("Reading data...");
    INPAapiJob("ecu", "long_job", "", "");
    show_progress("Processing...");
    delay(1000);
    hide_progress();
    messagebox("Done", "Processing complete");
}
```

### Color Cycling Demo

```c
MENU m_colors()
{
    int fg_color = 0;
    int bg_color = 13;
    string s;
    
    ITEM(1, "Next FG") {
        fg_color = fg_color + 1;
        if (fg_color > 15) fg_color = 0;
        setcolor(fg_color, bg_color);
        inttostring(fg_color, s);
        messagebox("Color", "Foreground: " + s);
    }
    
    ITEM(2, "Next BG") {
        bg_color = bg_color + 1;
        if (bg_color > 15) bg_color = 0;
        setcolor(fg_color, bg_color);
        inttostring(bg_color, s);
        messagebox("Color", "Background: " + s);
    }
    
    ITEM(3, "Reset") {
        setcolor(16, 32);  // Windows default
    }
}
```

### Input Form Example

```c
int value1 = 0;
int value2 = 0;
real value3 = 0.0;
string text1;
int InputState;

SCREEN s_input_demo()
{
    string s;
    
    LINE("Input State", "") {
        inttostring(InputState, s);
        textout("Input State = " + s, 1, 1);
    }
    
    LINE("Integer Values", "") {
        inttostring(value1, s);
        textout("Value 1 = " + s, 1, 1);
        inttostring(value2, s);
        textout("Value 2 = " + s, 3, 1);
    }
    
    LINE("Real Value", "") {
        realtostring(value3, "4.2", s);
        textout("Value 3 = " + s, 1, 1);
    }
    
    LINE("Text", "") {
        textout("Text = " + text1, 1, 1);
    }
}

MENU m_input_demo()
{
    ITEM(1, "Int") {
        inputint(value1, "Integer Input", "Enter value (0-100):", 0, 100);
        getinputstate(InputState);
    }
    
    ITEM(2, "Real") {
        inputnum(value3, "Real Input", "Enter value (-10.0 to 100.0):", -10.0, 100.0);
        getinputstate(InputState);
    }
    
    ITEM(3, "2 Int") {
        input2int(value1, value2, "Two Integers", "Enter:",
                  "First (0-100):", "Second (-50 to 50):",
                  0, 100, -50, 50);
        getinputstate(InputState);
    }
    
    ITEM(4, "Text") {
        inputtext(text1, "Text Input", "Enter text:");
        getinputstate(InputState);
    }
}
```

---

## File Operations

### Basic File Writing

```c
test_file_write()
{
    fileopen("test1.dat", "w");  // Create/overwrite
    filewrite("Line 1: First test");
    filewrite("Line 2: Second test");
    fileclose();
    
    fileopen("test2.dat", "a");  // Append
    filewrite("Appended line");
    fileclose();
}
```

### File Reading

```c
read_file_contents(in: string filename)
{
    string line;
    bool eof;
    int linenum;
    
    fileopen(filename, "r");
    linenum = 1;
    fileread(line, eof);
    
    while (eof == FALSE) {
        string s;
        inttostring(linenum, s);
        textout(s + ": " + line, linenum, 1);
        linenum = linenum + 1;
        fileread(line, eof);
    }
    
    fileclose();
}
```

### File Operations with Viewer

```c
string DatFileName = "demo.dat";
string UserString;

GetUserString(inout: string Str)
{
    inputtext(Str, "User Input", "Enter text to save:");
}

MENU m_file_demo()
{
    INIT {
        setmenutitle("File Demo");
    }
    
    ITEM(1, "Input") {
        GetUserString(UserString);
    }
    
    ITEM(2, "Write") {
        fileopen(DatFileName, "a");
        filewrite(UserString);
        fileclose();
        messagebox("File", "Data written to file");
    }
    
    ITEM(3, "View") {
        viewopen(DatFileName, "File Contents");
    }
    
    ITEM(4, "Clear") {
        fileopen(DatFileName, "w");
        fileclose();
        messagebox("File", "File cleared");
    }
    
    ITEM(5, "Close View") {
        viewclose();
    }
}
```

---

## String Array Usage

```c
int hStrArr_1;
int hStrArr_Test;

init_string_arrays()
{
    bool b;
    int i;
    string s;
    
    // Create array
    StrArrayCreate(b, hStrArr_1);
    if (b == FALSE) {
        messagebox("Error", "Could not create string array!");
        return;
    }
    
    // Fill array
    i = 0;
    while (i < 10) {
        inttostring(i, s);
        StrArrayWrite(hStrArr_1, i, "Element " + s);
        i = i + 1;
    }
}

read_string_array(in: int hStrArr)
{
    int i;
    int count;
    string s;
    string ArrStr;
    
    i = 0;
    StrArrayGetElementCount(hStrArr, count);
    
    while (i < count) {
        inttostring(i, s);
        StrArrayRead(hStrArr, i, ArrStr);
        filewrite(s + ": " + ArrStr);
        i = i + 1;
    }
}

MENU m_strarray()
{
    bool b;
    string s;
    
    ITEM(1, "Create") {
        StrArrayCreate(b, hStrArr_Test);
        if (b == TRUE) {
            messagebox("OK", "Array created");
        }
    }
    
    ITEM(2, "Fill") {
        int i;
        i = 0;
        while (i < 5) {
            inttostring(i, s);
            StrArrayWrite(hStrArr_Test, i, "Test Item " + s);
            i = i + 1;
        }
    }
    
    ITEM(3, "Read[3]") {
        StrArrayRead(hStrArr_Test, 3, s);
        messagebox("Read", "Index 3: " + s);
    }
    
    ITEM(4, "Clear") {
        StrArrayDelete(hStrArr_Test);
    }
    
    ITEM(5, "Destroy") {
        StrArrayDestroy(hStrArr_Test);
    }
    
    ITEM(6, "View All") {
        fileopen("strarray.tmp", "w");
        filewrite("String Array Contents:");
        filewrite("");
        read_string_array(hStrArr_Test);
        fileclose();
        viewopen("strarray.tmp", "Array Contents");
    }
}

inpaexit()
{
    // Clean up arrays
    StrArrayDestroy(hStrArr_1);
    StrArrayDestroy(hStrArr_Test);
}
```

---

## Logic Tables

```c
// Global variables
bool bi1 = FALSE;
bool bi2 = FALSE;
bool bi3 = FALSE;
bool bo1 = FALSE;
bool bo2 = FALSE;

// Toggle helper
booltoggle(inout: bool b)
{
    if (b == TRUE)
        b = FALSE;
    else
        b = TRUE;
}

// Logic table definition
// Outputs: o1, o2
// Inputs: i1, i2, i3
LOGTABLE ltab(out: bool o1 o2, in: bool i1 i2 i3)
{
    // Output  : Input
    // o1 o2   : i1 i2 i3
    0y00: 0y000;  // All inputs FALSE -> both outputs FALSE
    0y01: 0y10X;  // i1=1, i2=0, i3=any -> o1=0, o2=1
    0y10: 0y010;  // i1=0, i2=1, i3=0 -> o1=1, o2=0
    0y11: OTHER;  // All other cases -> both outputs TRUE
}

SCREEN s_logtable()
{
    // Evaluate logic table
    ltab(bo1, bo2, bi1, bi2, bi3);
    
    LINE("Inputs", "") {
        text(0, 2, "Input 1:");
        digitalout(bi1, 0, 15, "TRUE ", "FALSE");
        text(1, 2, "Input 2:");
        digitalout(bi2, 1, 15, "TRUE ", "FALSE");
        text(2, 2, "Input 3:");
        digitalout(bi3, 2, 15, "TRUE ", "FALSE");
        text(3, 0, "");
    }
    
    LINE("Outputs", "") {
        text(0, 2, "Output 1:");
        digitalout(bo1, 0, 15, "TRUE ", "FALSE");
        text(1, 2, "Output 2:");
        digitalout(bo2, 1, 15, "TRUE ", "FALSE");
    }
}

MENU m_logtable()
{
    ITEM(1, "Tog IN1") {
        booltoggle(bi1);
    }
    
    ITEM(2, "Tog IN2") {
        booltoggle(bi2);
    }
    
    ITEM(3, "Tog IN3") {
        booltoggle(bi3);
    }
}
```

---

## Select/Control/Toggle

```c
string togglestr0;
string togglestr1;
string globalstr;

SCREEN s_select_demo()
{
    textout("ToggleString0: " + togglestr0, 1, 0);
    textout("ToggleString1: " + togglestr1, 3, 0);
    textout("GlobalStr: " + globalstr, 5, 0);
    textout("", 6, 0);
    
    LINE("Line1", "API-1") {
        globalstr = "LINE1";
        textout("Control Line 1", 2, 2);
        
        CONTROL {
            messagebox("Control1", "Control 1 executed");
        }
    }
    
    LINE("Line2", "API-2") {
        globalstr = "LINE2";
        textout("Control Line 2", 2, 2);
        
        CONTROL {
            messagebox("Control2", "Control 2 executed");
        }
    }
    
    LINE("Line3", "API-3") {
        globalstr = "LINE3";
        textout("Control Line 3", 2, 2);
        
        CONTROL {
            messagebox("Control3", "Control 3 executed");
        }
    }
}

MENU m_select_demo()
{
    ITEM(1, "Control") {
        messagebox("Control", "GlobalStr=" + globalstr);
        control();
    }
    
    ITEM(2, "SingleSel") {
        select(FALSE);
    }
    
    ITEM(3, "MultiSel") {
        select(TRUE);
    }
    
    ITEM(4, "Deselect") {
        deselect();
    }
    
    ITEM(5, "Toggle0") {
        togglelist(TRUE, FALSE, togglestr0);
    }
    
    ITEM(6, "Toggle1") {
        togglelist(FALSE, TRUE, togglestr1);
    }
}
```

---

## Timer Usage

```c
int timer_count = 0;
bool timer_running = FALSE;

SCREEN s_timer()
{
    string s;
    
    LINE("Timer Status", "") {
        text(0, 2, "Timer Running:");
        digitalout(timer_running, 0, 20, " YES ", " NO ");
        
        inttostring(timer_count, s);
        text(1, 2, "Count: " + s);
    }
}

STATEMACHINE sm_counter()
{
    bool expired;
    
    INIT {
        timer_count = 0;
        timer_running = TRUE;
        settimer(0, 1000);  // 1 second interval
        setstate(Z_COUNT);
    }
    
    Z_COUNT {
        testtimer(0, expired);
        if (expired == TRUE) {
            timer_count = timer_count + 1;
            settimer(0, 1000);  // Reset timer
            
            if (timer_count >= 10) {
                setstate(Z_DONE);
            }
        }
    }
    
    Z_DONE {
        timer_running = FALSE;
        messagebox("Timer", "Count reached 10!");
        setstate(Z_IDLE);
    }
    
    Z_IDLE {
        // Do nothing - wait for restart
    }
}

MENU m_timer()
{
    ITEM(1, "Start") {
        setstatemachine(sm_counter);
    }
    
    ITEM(2, "Reset") {
        timer_count = 0;
        timer_running = FALSE;
    }
}
```

---

## Imported Functions

### Windows MessageBox Example

```c
// Import Windows MessageBox
import pascal lib "user.exe::MessageBox" MyMessageBox(
    in: int handle1,
    in: string text1,
    in: string kopf,
    in: int Art,
    returns: int ret
);

// Variables
int flags = 16;  // MB_ICONERROR
string title = "My Title";
string text = "Hello from imported function!";
int handle = 0;  // Desktop window handle
int result;

MENU m_import()
{
    ITEM(1, "MsgBox") {
        MyMessageBox(handle, text, title, flags, result);
    }
}
```

### Custom DLL Function

```c
// Import custom DLL function
import "C" lib "c:\tmp\test.dll" MyHello();

// Alternative with internal name mapping
import pascal lib "mylib.dll::InternalName" ExternalName(
    in: string param1,
    out: int result
);
```

### Structure Usage with Imports

```c
long Buffer;
int Zahl;
int ReturnedValue;
string ReturnedString = "        ";

// Import wvsprintf
import pascal lib "user" wvsprintf(
    inout: string ReturnedString,
    in: string Format,
    in: structure ArgList,
    returns: int ReturnedValue
);

format_number()
{
    Zahl = 127;
    
    CreateStructure(Buffer, 1024);
    SetStructureMode(0);  // Write mode
    StructureLong(Buffer, 0, Zahl);
    
    wvsprintf(ReturnedString, "%04X", Buffer, ReturnedValue);
    // Result: ReturnedString = "007F"
}
```

---

## PEM (Protocol/Label Manager) Example

```c
print_protocol()
{
    bool PEMresult = FALSE;
    string FileName = "\wineldi\prt\protbef.dmf";
    string FormularName;
    
    // Load form
    FormularName = "for_befuell1";
    PEMLoad_formular(PEMresult, FileName, FormularName);
    PEMDefault_besetzen(PEMresult, FormularName);
    
    // Fill fields
    PEMWrite_druckfeld(PEMresult, "vakuum1", FormularName, "value1");
    PEMWrite_druckfeld(PEMresult, "vakuum2", FormularName, "value2");
    PEMWrite_druckfeld(PEMresult, "fehler", FormularName, "error1");
    
    // Print
    PEMPrintFormular(PEMresult, FormularName);
    
    // Cleanup
    PEMForget_formular(PEMresult, FormularName);
}
```
