# INPA Screen & State Machine Execution Model

Based on reverse engineering of `INPA.exe` (Ghidra decompilation).

## Overview

INPA uses an **event-driven polling model** for screen and state machine execution, NOT hardware timers. The main execution loop is called from MFC's OnIdle handler, ensuring non-blocking UI updates.

## Core Architecture

### Context Structure (DAT_0049ff18)

The runtime maintains a context structure with these key offsets:

| Offset | Name | Description |
|--------|------|-------------|
| `0xb4` | `lineListHead` | Pointer to LINE list (for iteration) |
| `0xc0` | `pendingMenu` | Menu to activate (set by `setmenu()`) |
| `0xc4` | `pendingScreen` | Screen to activate (set by `setscreen()`) |
| `0xc8` | `pendingStateMachine` | StateMachine to activate (set by `setstatemachine()`) |
| `0xcc` | `pendingMenuItem` | Menu item handler to execute |
| `0xd0` | `lineCode` | Pointer to current LINE block bytecode |
| `0xd4` | `initCode` | Pointer to INIT block bytecode |
| `0xd8` | `exitCode` | Pointer to EXIT block bytecode (states) |
| `0xdc` | `runningFlag` | 1 = execution active, 0 = paused |
| `0xe0` | `frequentFlag` | Screen refresh mode (0=once, 1=continuous) |
| `0xe4` | `continueFlag` | 1 = restart cycle after EXIT |
| `0xe8` | `phase` | Current execution phase (0, 1, 2) |

### Execution Phases

Screen/StateMachine execution follows a 3-phase cycle:

```
Phase 0 (INIT)     Phase 1 (LINE)     Phase 2 (EXIT)
     │                  │                  │
     ▼                  ▼                  ▼
┌─────────┐       ┌─────────┐       ┌─────────┐
│ Run     │──────▶│ Run     │──────▶│ Run     │
│ INIT    │       │ LINE    │       │ EXIT    │
│ block   │       │ blocks  │       │ block   │
└─────────┘       └─────────┘       └─────────┘
                       │                  │
                       │            continueFlag=1?
                       │                  │
                       ▼                  ▼
                  FrequentFlag=1?    Restart Phase 0
                       │
                       ▼
                  Return to Phase 1
```

## Screen Execution

### `setscreen(SCREEN s, bool FrequentFlag)`

```c
// System function handler for setscreen()
void setscreen_handler(context, params) {
    // Pop screen handle from stack
    screenHandle = pop_stack();      // 0x40 | screen_index
    frequentFlag = pop_stack();      // bool
    
    // Validate type (must be 0x40 = SCREEN)
    if ((screenHandle & 0xFF) != 0x40) {
        error(0x194, "setscreen");   // Wrong type error
    }
    
    // Resolve screen pointer
    screenPtr = lookup_screen(screenHandle);
    
    // Store in pending slot
    context->pendingScreen = screenPtr;  // 0xc4
    context->frequentFlag = frequentFlag; // 0xe0
}
```

### Screen Refresh Cycle

When `frequentFlag = TRUE`:

1. **Initial activation:**
   - Screen's INIT code runs once
   - LINE blocks are collected for iteration

2. **OnIdle polling loop:**
   ```c
   // Called from MFC OnIdle - FUN_00420745
   if (context->runningFlag == 1) {
       switch (context->phase) {
           case 0:  // INIT phase
               run_bytecode(context->initCode);
               context->phase = 1;
               break;
               
           case 1:  // LINE phase (main refresh)
               run_bytecode(context->lineCode);
               // After all LINEs complete, decide next step
               if (context->hasExit) {
                   context->phase = 2;
               } else if (context->frequentFlag) {
                   context->phase = 1;  // Loop back to LINE
               }
               break;
               
           case 2:  // EXIT phase
               run_bytecode(context->exitCode);
               context->phase = 0;  // Restart cycle
               break;
       }
   }
   ```

3. **Continuous refresh:**
   - With `FrequentFlag=TRUE`, after LINE completes, it loops back
   - This creates continuous polling without explicit timers
   - UI remains responsive because execution yields to message pump

### Screen Structure (IPO format)

```
SCREEN {
    INIT { ... }      // Runs once on screen activation
    LINE(n, ...) {    // Runs repeatedly when FrequentFlag=TRUE
        ...
    }
}
```

## State Machine Execution

### `setstatemachine(STATEMACHINE sm)`

Sets the active state machine. Unlike screens, state machines use explicit state transitions.

### `setstate(STATE state)`

Triggers transition to a new state within the current state machine.

### State Execution Cycle

```c
// State machine context at offset 0xc8
void statemachine_handler(context, smHandle) {
    // Validate type (must be 0x42 = STATEMACHINE)
    if ((smHandle & 0xFF) != 0x42) {
        error(0x194, "setstatemachine");
    }
    
    context->pendingStateMachine = lookup_statemachine(smHandle);
}
```

State transitions:
1. Current state's EXIT runs
2. New state's INIT runs
3. New state's body runs continuously

### State Structure (IPO format)

```
STATEMACHINE {
    STATE name {
        INIT { ... }   // Runs once on state entry
        BODY { ... }   // Runs continuously
        EXIT { ... }   // Runs once before transition
    }
    STATE other { ... }
}
```

## Timer Functions

INPA provides manual timer management, separate from screen refresh:

### `settimer(int timernum, int timeval)`

```c
// Sets a countdown timer
// timernum: 0-7 (8 timer slots available)
// timeval: milliseconds until expiration
void settimer_handler(context, params) {
    timerNum = pop_int();
    timeVal = pop_int();
    timers[timerNum] = GetTickCount() + timeVal;
}
```

### `testtimer(int timernum, out bool expiredflag)`

```c
// Checks if timer has expired
void testtimer_handler(context, params) {
    timerNum = pop_int();
    expired = (GetTickCount() >= timers[timerNum]);
    push_bool(expired);
}
```

### Usage Example

```inpa
SCREEN my_screen, TRUE {
    int timer_expired;
    
    INIT {
        settimer(0, 1000);  // 1 second timer
    }
    
    LINE(0, "Status") {
        testtimer(0, timer_expired);
        if (timer_expired) {
            // Do something every second
            INPAapiJob(...);
            settimer(0, 1000);  // Reset timer
        }
    }
}
```

## Execution Model Summary

| Feature | Mechanism | Frequency |
|---------|-----------|-----------|
| Screen LINE refresh | OnIdle polling | Every idle cycle (~16ms) |
| State BODY execution | OnIdle polling | Every idle cycle |
| settimer/testtimer | Manual polling | Script-controlled |
| Menu item handlers | Event-triggered | On user input |

### Key Insights

1. **No hardware timers for screen refresh** - INPA uses cooperative multitasking via MFC's OnIdle

2. **FrequentFlag controls looping** - When TRUE, LINE blocks execute repeatedly; when FALSE, only once

3. **Non-blocking execution** - Each bytecode instruction yields periodically, keeping UI responsive

4. **State machines are modal** - Only one state machine active at a time, states have exclusive execution

5. **Manual timers for precise timing** - Use `settimer`/`testtimer` when specific intervals needed

## Implementation Notes for inpax

### Recommended Architecture

```typescript
interface ScreenContext {
  screen: Screen;
  frequentFlag: boolean;
  phase: 'init' | 'line' | 'exit';
  lineIndex: number;
  running: boolean;
}

class ScreenExecutor {
  private context: ScreenContext;
  private intervalId: NodeJS.Timeout | null = null;
  
  start(screen: Screen, frequent: boolean) {
    this.context = {
      screen,
      frequentFlag: frequent,
      phase: 'init',
      lineIndex: 0,
      running: true
    };
    
    // Use setImmediate/requestAnimationFrame for non-blocking execution
    this.scheduleNext();
  }
  
  private scheduleNext() {
    if (!this.context.running) return;
    
    setImmediate(() => {
      this.executeStep();
      this.scheduleNext();
    });
  }
  
  private executeStep() {
    switch (this.context.phase) {
      case 'init':
        this.executeInit();
        this.context.phase = 'line';
        break;
        
      case 'line':
        if (this.executeNextLine()) {
          // More lines to execute
        } else {
          // All lines done
          if (this.context.frequentFlag) {
            this.context.lineIndex = 0;  // Restart
          } else {
            this.context.running = false;
          }
        }
        break;
    }
  }
}
```

### Timer Implementation

```typescript
class InpaTimers {
  private timers: Map<number, number> = new Map();
  
  setTimer(num: number, ms: number): void {
    this.timers.set(num, Date.now() + ms);
  }
  
  testTimer(num: number): boolean {
    const expiry = this.timers.get(num);
    return expiry !== undefined && Date.now() >= expiry;
  }
}
```

## References

- `FUN_00420745` - Main execution loop (OnIdle handler)
- `FUN_0041a4ec` - Screen activation
- `FUN_0042e457` - State machine activation  
- `FUN_004607d7` - Bytecode interpreter main loop
- `FUN_0041fde1` - Set FrequentFlag for screen

---

*Document generated from INPA.exe.c reverse engineering analysis*
