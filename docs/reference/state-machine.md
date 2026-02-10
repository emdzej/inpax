# INPA State Machine Reference

This document describes how state machines work in INPA scripts, including states, transitions, events, and the lifecycle.

## Overview

State machines in INPA enable the formulation of interruptible background actions that run **pseudo-parallel** to SCREENs and function key handlers. They provide a mechanism for:

- Long-running operations that shouldn't block the UI
- Cyclic background tasks
- Sequential multi-step processes with pauses
- Nested subroutine-style operations

## Key Concepts

### Pseudo-Parallel Execution

INPA uses cooperative multitasking. Code blocks are always executed completely before switching to another parallel object. A "block" is defined as:

- A single state within a state machine
- A logical line (LINE) within a SCREEN
- The code associated with a function key

**Execution Order Example:**
1. LINE 1 code executes completely
2. State 3 code executes completely  
3. LINE 4 code executes completely
4. State 3 code executes again (no state change occurred)
5. If F-key pressed: F-key handler executes with highest priority

## State Machine Syntax

### Basic Structure

```c
STATEMACHINE sm_name()
{
    // Local variables (optional)
    bool flag;
    int counter;
    
    INIT {
        // Initialization code - always executed first
        // Must transition to next state with setstate()
    }
    
    STATE_NAME_1 {
        // Code for this state
        // Use setstate() to transition
    }
    
    STATE_NAME_2 {
        // Another state
    }
    
    // ... more states
}
```

### Rules

1. **INIT is mandatory** - Every state machine must have an INIT block
2. **State names must be unique** within the state machine
3. **State names are user-defined** - choose meaningful names
4. **No limit** on number of states
5. **Cyclic execution** - if no `setstate()` is called, the same state runs again next cycle

## State Machine Functions

### setstatemachine(sm)

Activates a state machine as the main background process.

```c
setstatemachine(in: STATEMACHINE sm)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| sm | STATEMACHINE | Name of the state machine to activate |

**Example:**
```c
inpainit() {
    setmenu(m_main);
    setscreen(s_main, TRUE);
    setstatemachine(sm_main);  // Start main state machine
}
```

### setstate(state)

Transitions to a new state within the current state machine.

```c
setstate(in: STATE state)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| state | STATE | Name of the target state |

**Note:** The transition happens after the current block completes. The new state runs on the next cycle.

**Example:**
```c
INIT {
    counter = 0;
    setstate(Z_WAIT);  // Transition to Z_WAIT state
}

Z_WAIT {
    counter = counter + 1;
    if (counter > 10) {
        setstate(Z_DONE);  // Transition when condition met
    }
    // If no setstate(), Z_WAIT runs again next cycle
}
```

### callstatemachine(sm)

Calls a state machine as a "subroutine". The called state machine can be interrupted (unlike regular functions).

```c
callstatemachine(in: STATEMACHINE sm)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| sm | STATEMACHINE | Name of the state machine to call |

**Important:** The called state machine must eventually call `returnstatemachine()` to return control to the caller.

**Features:**
- Nesting depth is unlimited
- Called state machine can be interrupted by SCREEN updates and key events
- Caller resumes at the point after the `callstatemachine()` call

### returnstatemachine()

Returns from a called state machine back to the caller.

```c
returnstatemachine()
```

**Example - Sub-State Machine Pattern:**
```c
STATEMACHINE sm_delay()
{
    INIT {
        settimer(1, 1000);  // 1 second delay
        setstate(Z_WAIT_TIMER);
    }
    
    Z_WAIT_TIMER {
        bool expired;
        testtimer(1, expired);
        if (expired == TRUE) {
            returnstatemachine();  // Return to caller
        }
        // While waiting, UI stays responsive
    }
}

STATEMACHINE sm_main()
{
    INIT {
        setstate(Z_WORK);
    }
    
    Z_WORK {
        // Do some work...
        callstatemachine(sm_delay);  // Call sub-state machine
        // Execution continues here after sm_delay returns
        setstate(Z_NEXT);
    }
}
```

## Complete Example

```c
#include "inpa.h"

// Timer configuration
int tn_screen_demo = 0;
int tv_screen_demo_digital = 10000;
int tn_delay = 1;
int tv_delay = 1000;

// Variables
bool var_digital_1;

//////////////////////////////////////////
// HELPER FUNCTIONS
//////////////////////////////////////////

check_sm_return(in: int timer_num)
{
    bool return_flag;
    testtimer(timer_num, return_flag);
    if (return_flag == TRUE) {
        returnstatemachine();
    }
}

toggle_boolvar(inout: bool b)
{
    if (b == TRUE)
        b = FALSE;
    else
        b = TRUE;
}

//////////////////////////////////////////
// STATE MACHINES
//////////////////////////////////////////

// Reusable delay state machine
STATEMACHINE sm_delay()
{
    bool expired_flag;
    
    INIT {
        settimer(tn_delay, tv_delay);
        setstate(Z_WAIT_TIMER);
    }
    
    Z_WAIT_TIMER {
        testtimer(tn_delay, expired_flag);
        if (expired_flag == TRUE)
            returnstatemachine();
    }
    
    Z_END {
        // Never reached in this example
    }
}

// Demo state machine
STATEMACHINE sm_screen_demo_digital()
{
    bool expired_flag;
    
    INIT {
        setscreen(s_screen_demo_digital, TRUE);
        settimer(tn_screen_demo, tv_screen_demo_digital);
        var_digital_1 = FALSE;
        setstate(Z_1);
    }
    
    Z_1 {
        toggle_boolvar(var_digital_1);
        callstatemachine(sm_delay);  // Wait between toggles
        check_sm_return(tn_screen_demo);  // Check if main timer expired
    }
}

// Main state machine
STATEMACHINE sm_main()
{
    INIT {
        setstate(Z_SCREEN_DEMO);
    }
    
    Z_SCREEN_DEMO {
        callstatemachine(sm_screen_demo_digital);
        setscreen(s_main, TRUE);
        setstate(Z_END);
    }
    
    Z_END {
        messagebox("Notice", "Demo finished");
        exit();
    }
}

//////////////////////////////////////////
// SCREEN
//////////////////////////////////////////

SCREEN s_screen_demo_digital()
{
    LINE("Digital Output", "") {
        ftextout("Digital Output:", 1, 5, 0, 1);
        digitalout(var_digital_1, 2, 30, "ON ", "OFF");
        textout("", 3, 1);
    }
}

SCREEN s_main()
{
}

//////////////////////////////////////////
// MENU
//////////////////////////////////////////

MENU m_main()
{
    INIT {
        setmenutitle("Main Menu");
    }
    
    ITEM(10, "Exit") {
        exit();
    }
}

//////////////////////////////////////////
// ENTRY POINTS
//////////////////////////////////////////

inpainit()
{
    settitle("State Machine Demo");
    setmenu(m_main);
    setscreen(s_main, TRUE);
    setstatemachine(sm_main);  // Start the state machine
}

inpaexit()
{
}
```

## State Machine Lifecycle

### Initialization

1. `inpainit()` is called when script loads
2. `setstatemachine(sm_main)` activates the main state machine
3. `INIT` block of the state machine executes
4. `setstate()` in INIT determines the first operational state

### Normal Operation

```
┌─────────────────────────────────────────────────────────────┐
│                     INPA Main Loop                          │
│                                                             │
│  1. Execute current SCREEN LINE (if visible)               │
│  2. Execute current STATE of active state machine          │
│  3. Check for key events → execute ITEM code if pressed    │
│  4. Repeat                                                  │
└─────────────────────────────────────────────────────────────┘
```

### State Transitions

```
State A                          State B
┌──────────────────┐            ┌──────────────────┐
│                  │  setstate  │                  │
│  // Do work      │ ─────────► │  // New work     │
│  setstate(Z_B);  │            │  setstate(Z_C);  │
│                  │            │                  │
└──────────────────┘            └──────────────────┘
```

### Calling Sub-State Machines

```
sm_main                    sm_sub
┌───────────────┐         ┌───────────────┐
│ STATE_A:      │         │ INIT:         │
│   ...         │ ──────► │   setstate()  │
│   callstate   │         └───────────────┘
│   machine()   │                │
│   ...    ◄────│────────────────┘ returnstatemachine()
│   setstate()  │         
└───────────────┘
```

## Best Practices

### 1. Use Timers for Delays

Don't use `delay()` in state machines - it blocks everything. Use timers instead:

```c
// BAD - blocks UI
STATE_WAIT {
    delay(1000);  // Freezes the entire application
    setstate(Z_NEXT);
}

// GOOD - non-blocking
STATE_WAIT {
    bool expired;
    testtimer(0, expired);
    if (expired == TRUE) {
        setstate(Z_NEXT);
    }
    // UI remains responsive while waiting
}
```

### 2. Initialize Timers in INIT or Previous State

```c
INIT {
    settimer(0, 5000);  // Set up timer
    setstate(Z_WAIT);
}

Z_WAIT {
    bool expired;
    testtimer(0, expired);
    if (expired == TRUE) {
        setstate(Z_DONE);
    }
}
```

### 3. Use Sub-State Machines for Reusable Patterns

```c
// Reusable EDIABAS job execution with retry
STATEMACHINE sm_execute_job()
{
    int retry_count;
    
    INIT {
        retry_count = 0;
        setstate(Z_TRY);
    }
    
    Z_TRY {
        if (retry_count < 3) {
            INPAapiJob("ecu", "job", "", "");
            INPAapiCheckJobStatus("OKAY");
            retry_count = retry_count + 1;
            setstate(Z_CHECK);
        } else {
            setstate(Z_FAILED);
        }
    }
    
    Z_CHECK {
        // Check results, returnstatemachine() on success
        returnstatemachine();
    }
    
    Z_FAILED {
        messagebox("Error", "Job failed after 3 retries");
        returnstatemachine();
    }
}
```

### 4. Keep States Small and Focused

Each state should do one thing:

```c
// GOOD - each state has single responsibility
Z_READ_SENSOR {
    INPAapiJob("ecu", "read_sensor", "", "");
    setstate(Z_PROCESS_DATA);
}

Z_PROCESS_DATA {
    INPAapiResultAnalog(value, "SENSOR_VALUE", 1);
    setstate(Z_DISPLAY);
}

Z_DISPLAY {
    // Update display
    setstate(Z_READ_SENSOR);  // Loop back
}
```

### 5. Handle State Machine Cleanup

```c
STATEMACHINE sm_test()
{
    INIT {
        INPAapiInit();  // Initialize resources
        setstate(Z_WORK);
    }
    
    Z_WORK {
        // ... do work ...
    }
    
    Z_CLEANUP {
        INPAapiEnd();  // Clean up resources
        returnstatemachine();
    }
}
```

## Common Patterns

### Polling Pattern

```c
STATEMACHINE sm_poll()
{
    INIT {
        settimer(0, 500);  // Poll every 500ms
        setstate(Z_POLL);
    }
    
    Z_POLL {
        bool expired;
        testtimer(0, expired);
        if (expired == TRUE) {
            // Execute poll
            INPAapiJob("ecu", "status", "", "");
            INPAapiCheckJobStatus("OKAY");
            settimer(0, 500);  // Reset timer
        }
        // Stay in Z_POLL state
    }
}
```

### Sequential Steps Pattern

```c
STATEMACHINE sm_sequence()
{
    INIT {
        setstate(Z_STEP1);
    }
    
    Z_STEP1 {
        // Do step 1
        action_box_open("Performing step 1...");
        INPAapiJob("ecu", "step1", "", "");
        setstate(Z_STEP2);
    }
    
    Z_STEP2 {
        // Do step 2
        action_box_open("Performing step 2...");
        INPAapiJob("ecu", "step2", "", "");
        setstate(Z_STEP3);
    }
    
    Z_STEP3 {
        // Do step 3
        action_box_open("Performing step 3...");
        INPAapiJob("ecu", "step3", "", "");
        setstate(Z_COMPLETE);
    }
    
    Z_COMPLETE {
        messagebox("Success", "All steps completed");
        returnstatemachine();
    }
}
```

### Conditional Branching Pattern

```c
STATEMACHINE sm_conditional()
{
    bool condition;
    
    INIT {
        setstate(Z_CHECK);
    }
    
    Z_CHECK {
        INPAapiJob("ecu", "status", "", "");
        INPAapiResultDigital(condition, "READY", 1);
        
        if (condition == TRUE) {
            setstate(Z_PATH_A);
        } else {
            setstate(Z_PATH_B);
        }
    }
    
    Z_PATH_A {
        // Handle ready case
        setstate(Z_END);
    }
    
    Z_PATH_B {
        // Handle not-ready case
        settimer(0, 1000);
        setstate(Z_WAIT_RETRY);
    }
    
    Z_WAIT_RETRY {
        bool expired;
        testtimer(0, expired);
        if (expired == TRUE) {
            setstate(Z_CHECK);  // Retry
        }
    }
    
    Z_END {
        returnstatemachine();
    }
}
```

## Interaction with SCREEN and MENU

State machines, SCREENs, and MENUs work together:

```c
SCREEN s_status()
{
    // This runs cyclically, interleaved with state machine
    INPAapiJob("ecu", "status", "", "");
    LINE("Status", "") {
        INPAapiResultText(status, "STATUS", 1, "");
        textout(status, 1, 10);
    }
}

MENU m_control()
{
    ITEM(1, "Start") {
        // F-key handlers have highest priority
        setstatemachine(sm_process);  // Start a new state machine
    }
    
    ITEM(2, "Stop") {
        // Can interrupt state machine
        stop();  // Stops cyclic processing
    }
}

STATEMACHINE sm_process()
{
    INIT {
        setscreen(s_status, TRUE);  // Activate status screen
        setstate(Z_WORK);
    }
    
    Z_WORK {
        // State machine and screen run together
        // User can still press F-keys
    }
}
```

## Error Handling

State machines should handle errors gracefully:

```c
STATEMACHINE sm_with_error_handling()
{
    int error_count;
    
    INIT {
        error_count = 0;
        setstate(Z_TRY);
    }
    
    Z_TRY {
        bool rc;
        INP1apiJob("ecu", "risky_job", "", "");
        INP1apiState(rc);
        
        if (rc == 1) {  // Job completed
            setstate(Z_CHECK_RESULT);
        } else {
            error_count = error_count + 1;
            if (error_count > 3) {
                setstate(Z_ERROR);
            }
            // Stay in Z_TRY and retry
        }
    }
    
    Z_CHECK_RESULT {
        bool success;
        INP1apiResultText(success, status, "JOB_STATUS", 1, "");
        if (status == "OKAY") {
            setstate(Z_SUCCESS);
        } else {
            setstate(Z_ERROR);
        }
    }
    
    Z_SUCCESS {
        messagebox("Success", "Operation completed");
        returnstatemachine();
    }
    
    Z_ERROR {
        messagebox("Error", "Operation failed");
        returnstatemachine();
    }
}
```
