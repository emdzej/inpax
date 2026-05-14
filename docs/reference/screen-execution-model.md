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

## Tick granularity — all LINE blocks per tick, NOT one per tick

A recurring question: when frequentFlag=TRUE, does each OnIdle tick run
**all** LINE blocks of the active screen, or does it run **one** LINE
block per tick? Confirmed from Ghidra: **all LINE blocks per tick.**

The block-phase state machine at context offset `+0xe8` is **3-way**
(INIT=0, LINE=1, EXIT=2), not per-LINE. The +0xe8 transitions are:

```
0 (INIT) → 1 (LINE) → 2 (EXIT) → 0  (cycle restarts via the +0xe4 flag)
```

Inside `INPA_RunBlockPhase` (FUN_00420745) the LINE case looks like:

```c
case 1:  // LINE phase
    if (ctx->lineCode != 0) {  // +0xd0
        FUN_00460731(&vm, ctx->lineCode);  // ip = 0, code_size = sizeof(lineCode)
        do {
            iVar1 = INPA_VM_Interpret(&vm, ctx->lineListHead);
        } while (iVar1 != 0 && ctx->runningFlag == 1);  // +0xdc
    }
    FUN_0041e0da(ctx);  // post-LINE screen hook (scroll/repaint)
    ctx->phase++;       // → 2 (EXIT)
```

Crucially, `INPA_VM_Interpret` (FUN_004607d7) is **single-instruction**:

```c
if (ctx->code_size <= ctx->ip) return 0;   // past end → "done"
... execute one opcode at ctx->code_ptr[ctx->ip] ...
return 1;                                   // "more to do"
```

So the `do { Interpret } while (iVar1 != 0 && running)` loop is a
tight single-stepper that runs the **entire** `lineCode` bytecode in
one OnIdle call. After the first cycle, the INIT pointer (`+0xd4`)
is zeroed, so the steady-state per tick is:

```
phase 0: lineCode INIT is null → skip → phase = 1
phase 1: run all LINE blocks to completion → phase = 2
phase 2: usually no EXIT → phase = 0 (cycle restarts)
```

That entire transition (0→1→2→0) happens within one `INPA_RunBlockPhase`
call when there's no pending menu / screen / state-machine switch and
no async system function inside the LINE block forces an early yield.

### Why this matters for inpax

- The `screen-executor.ts` "one tick = full cycle" model matches INPA.
- Per-tick caches keyed by `lineIndex` are safe — each tick sees
  every LINE block sequentially.
- Per-LINE caches that try to short-circuit "this is the same LINE I
  ran last tick" would be **wrong** — INPA never works in those terms.

## Ghidra rename map

Functions referenced in this doc, renamed in the Ghidra project for
discoverability. Use the right-hand names when re-exploring.

| Address      | Original       | Renamed                     |
|--------------|----------------|-----------------------------|
| `0x004607d7` | `FUN_004607d7` | `INPA_VM_Interpret`         |
| `0x00420745` | `FUN_00420745` | `INPA_RunBlockPhase`        |
| `0x004176fb` | `FUN_004176fb` | `INPA_RunStatusDispatcher`  |
| `0x00402d7c` | `FUN_00402d7c` | `INPA_MainAppStateStep`     |
| `0x004014a5` | `FUN_004014a5` | `INPA_OnIdleStep`           |

Call chain (top = entry):

```
INPA_OnIdleStep            (0x004014a5)  ← MFC OnIdle handler
  → INPA_MainAppStateStep  (0x00402d7c)  ← app-level state machine (case 5)
    → INPA_RunStatusDispatcher (0x004176fb)  ← status dispatcher
      → INPA_RunBlockPhase  (0x00420745)  ← INIT/LINE/EXIT executor
        → INPA_VM_Interpret (0x004607d7)  ← single-instruction VM
```

## References

- `INPA_RunBlockPhase` (`0x00420745`) - INIT/LINE/EXIT block executor (OnIdle target)
- `FUN_0041a4ec` - Screen activation
- `FUN_0042e457` - State machine activation
- `INPA_VM_Interpret` (`0x004607d7`) - Bytecode interpreter (single-step per call)
- `FUN_0041fde1` - Set FrequentFlag for screen
- `FUN_00460731` - Load bytecode block (resets ip, sets code_size)
- `FUN_0041e0da` - Post-LINE-phase screen hook

---

*Document generated from INPA.exe.c reverse engineering analysis*
