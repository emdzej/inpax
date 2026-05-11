# Execution Cycle Reference

This document describes how the inpax interpreter executes INPA scripts, including the main loop, component coordination, and timing model.

## Overview

The inpax interpreter uses a **cooperative multitasking** model based on polling, matching the original INPA's MFC `OnIdle` handler. Three main components run pseudo-parallel:

1. **Screen** — UI display with LINE refresh
2. **State Machine** — Background logic and sequencing
3. **Menu (F-keys)** — User input handlers

```
┌─────────────────────────────────────────────────────────────┐
│                    MainScheduler                             │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   F-keys    │  │    State    │  │   Screen    │          │
│  │  (highest)  │──│   Machine   │──│  (lowest)   │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│                                                              │
│  tick() ─────────────────────────────────────────► 16ms     │
└─────────────────────────────────────────────────────────────┘
```

## Execution Priority

Each tick, components execute in strict priority order:

| Priority | Component | Description |
|----------|-----------|-------------|
| 1 (highest) | F-key handlers | Interrupt everything, execute immediately |
| 2 | State Machine | One state executes per tick |
| 3 (lowest) | Screen | LINE functions refresh continuously |

**Key principle:** Higher priority components can interrupt lower ones, but each component's code block runs to completion before switching.

## Main Loop

```typescript
// Simplified MainScheduler.tick()
async tick() {
  // 1. F-key handlers (highest priority)
  if (pendingMenuAction) {
    await pendingMenuAction.handler();
    pendingMenuAction = null;
  }

  // 2. State machine (one state per tick)
  if (stateMachineExecutor?.isRunning()) {
    await stateMachineExecutor.tick();
  }

  // 3. Screen (runs own internal timer)
  // ScreenExecutor manages its own tick loop
}
```

## Screen Execution Cycle

The `ScreenExecutor` implements a 3-phase cycle:

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│  INIT   │────▶│  LINE   │────▶│  IDLE   │
│ (once)  │     │ (loop)  │     │ (wait)  │
└─────────┘     └────┬────┘     └─────────┘
                     │ frequentFlag=true
                     └──────────────┘
```

### Phases

1. **INIT Phase**
   - Executes `allocFunc` (memory allocation)
   - Executes `initFunc` (initialization)
   - Runs once on screen activation
   - Transitions to LINE phase

2. **LINE Phase**
   - Executes each LINE block sequentially
   - Each LINE has its own function and controls
   - When `frequentFlag=true`: loops continuously
   - When `frequentFlag=false`: executes once, then IDLE

3. **IDLE Phase**
   - Only reached when `frequentFlag=false`
   - Screen waits for next activation or event

### Screen Activation

```typescript
// From INPA script
setscreen(s_main, TRUE);   // frequentFlag=true → continuous refresh
setscreen(s_status, FALSE); // frequentFlag=false → one-shot

// Internal flow
VM.setScreen(screenId, frequentFlag)
  → ScreenExecutor.start()
  → Phase: INIT → LINE (→ loop or IDLE)
```

## State Machine Execution Cycle

The `StateMachineExecutor` implements state-based execution:

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│  INIT   │────▶│ STATE_A │────▶│ STATE_B │
│ (first) │     │         │     │         │
└─────────┘     └────┬────┘     └─────────┘
                     │ no setstate()
                     └──────────────┘ (repeat)
```

### Execution Rules

1. **INIT is mandatory** — Every state machine starts with INIT
2. **One state per tick** — State code runs completely, then yields
3. **Explicit transitions** — Use `setstate()` to change state
4. **Implicit loop** — No `setstate()` = same state runs again

### State Transitions

```typescript
// Transition scheduled for NEXT tick
setstate(Z_WORK);

// Execution timeline:
// Tick N:   STATE_A executes, calls setstate(Z_WORK)
// Tick N+1: Z_WORK executes (transition happened)
```

### Nested State Machines

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

Call stack supports unlimited nesting depth.

## Timing Model

### Tick Interval

Default: **16ms** (~60 fps), matching typical UI refresh rates.

```typescript
const scheduler = new MainScheduler(vm, {
  tickInterval: 16,  // milliseconds
});
```

### Timer System

8 timer slots for non-blocking delays:

```typescript
// Set timer (slot 0, 1000ms)
settimer(0, 1000);

// Check in LINE/STATE code
testtimer(0, expired);
if (expired == TRUE) {
  // Timer finished
  settimer(0, 1000);  // Reset for next cycle
}
```

**Important:** Timers require manual polling — they don't fire callbacks.

## Complete Execution Example

```
Time    Component       Action
────────────────────────────────────────────────────────
0ms     MainScheduler   tick() starts
        F-keys          (none pending)
        StateMachine    Z_READ_DATA executes
                        → INPAapiJob("ecu", "status")
                        → setstate(Z_PROCESS)
        Screen          LINE 0 executes
                        → textout(status, 1, 10)
        MainScheduler   tick() complete
────────────────────────────────────────────────────────
16ms    MainScheduler   tick() starts
        F-keys          (none pending)
        StateMachine    Z_PROCESS executes
                        → process data
                        → setstate(Z_READ_DATA)
        Screen          LINE 1 executes
                        → analogout(value, 2, 10)
        MainScheduler   tick() complete
────────────────────────────────────────────────────────
32ms    MainScheduler   tick() starts
        F-keys          F1 pressed! → handler executes
                        → setstatemachine(sm_other)
        StateMachine    (interrupted, new SM started)
        Screen          LINE 0 executes
        MainScheduler   tick() complete
────────────────────────────────────────────────────────
```

## Usage

### Basic Setup

```typescript
import { VM, MainScheduler, parseIpo } from '@emdzej/inpax-interpreter';
import { createTuiRuntime } from '@emdzej/inpax-tui-provider';

// Parse IPO file
const ipo = parseIpo(buffer);

// Create VM with runtime
const runtime = createTuiRuntime();
const vm = new VM(ipo, { runtime });

// Create scheduler
const scheduler = new MainScheduler(vm, { tickInterval: 16 });

// Run startup
await vm.run();  // Executes inpainit()

// Start main loop
scheduler.start();

// Handle F-key from UI
runtime.ui.on('menu:select', ({ itemNum }) => {
  const handler = findMenuHandler(itemNum);
  scheduler.queueMenuAction(itemNum, handler);
});
```

### Stopping Execution

```typescript
// Stop everything cleanly
scheduler.stop();

// Or from script
exit();  // Calls vm.stop() internally
```

## Comparison with Original INPA

| Aspect | Original INPA | inpax |
|--------|---------------|-------|
| Threading | Single-threaded MFC | Single-threaded async |
| Polling | OnIdle handler | setTimeout loop |
| Timer | Windows timers | JavaScript Date |
| Priority | Same order | Same order |
| Blocking | Blocks UI | Non-blocking async |

The key difference: inpax uses `async/await` for non-blocking execution while maintaining the same cooperative multitasking semantics.

## Related Documentation

- [Screen Execution Model](./screen-execution-model.md)
- [State Machine Reference](./state-machine.md)
- [System Functions](../system-functions.md)
