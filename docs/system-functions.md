# System Functions Architecture

System functions are built-in functions provided by the INPA VM. They are called via opcode `0x0C 0x81 [ID] 00`.

## Call Mechanism

### Invocation

```
0F 00 00 00        ; FRAME - push call frame marker
01 02 00 00        ; LOAD arg1 (push argument)
02 02 01 00        ; PUSHREF arg2 (push out parameter reference)
0C 81 [ID] 00      ; CALL system function by ID
```

### Internal Processing

From `FUN_004607d7` (interpreter):

```c
case 0x0C:  // CALL
    ip++;
    target = byte1;      // 0x80 = user, 0x81 = system
    func_id = bytes23;
    
    call_type = FUN_0041fc3f(context, target | (func_id << 16), &func_ptr);
    
    if (call_type == 1) {
        // User function - save return address, jump
        push_return_address(code_ptr, ip);
        jump_to_function(func_ptr);
    }
    else if (call_type == 2) {
        // System function - direct native call
        func_ptr(execution_context, &system_state);
        stack_cleanup();
    }
```

### Function Resolution

From `FUN_0041fc3f`:

```c
int FUN_0041fc3f(void* ctx, uint call_ref, code** out_func) {
    uint target = call_ref & 0xFF;
    uint func_id = call_ref >> 16;
    
    if (target == 0x80) {
        // User function table at ctx+0x38
        *out_func = ctx->user_functions[func_id];
        return 1;
    } else {
        // System function table at ctx+0x44
        *out_func = ctx->system_functions[func_id];
        return 2;
    }
}
```

### Function Registration

System functions are registered at compile time via `FUN_0041fcc7`:

```c
void FUN_0041fcc7(void* ctx, uint func_id, code* func_ptr) {
    // Create instruction word: 0x81 | (index << 16)
    uint* instr = allocate(4);
    *instr = 0x81;
    
    // Add to system function table
    uint index = array_append(ctx->system_functions, func_ptr);
    *(uint16_t*)(instr + 2) = index;
    
    // Register in name lookup
    register_name(ctx, func_name, func_id);
}
```

---

## Function Categories

### 1. UI Management

#### Screen Functions

| ID | Function | Description |
|----|----------|-------------|
| `0x04` | `setscreen` | Activate a screen definition |
| `0x03` | `settitle` | Set window title |
| `0x1A` | `setcolor` | Set foreground/background colors |

**`setscreen(SCREEN handle, bool cyclic)`**

Activates a SCREEN block defined in the IPO file.

```c
// Implementation concept
void setscreen(SCREEN handle, bool cyclic) {
    current_screen = handle;
    screen_cyclic_mode = cyclic;
    
    // Execute screen's init function (block type 0x21)
    if (handle->init_function) {
        execute_function(handle->init_function);
    }
    
    // Render all lines
    for (line in handle->lines) {
        render_line(line);
    }
}
```

**Cyclic mode:** When `cyclic=TRUE`, the screen continuously refreshes and re-executes line functions.

#### Menu Functions

| ID | Function | Description |
|----|----------|-------------|
| `0x00` | `setmenutitle` | Set menu bar title |
| `0x01` | `setmenu` | Activate a menu definition |
| `0x02` | `setitem` | Configure menu item |

**`setmenu(MENU handle)`**

Activates a MENU block.

```c
void setmenu(MENU handle) {
    current_menu = handle;
    
    // Build Windows menu from definition
    HMENU hmenu = CreateMenu();
    for (item in handle->items) {
        AppendMenu(hmenu, MF_STRING, item->id, item->text);
    }
    SetMenu(main_window, hmenu);
}
```

**`setitem(int ItemNum, string ItemText, bool Enabled)`**

Dynamically modifies a menu item.

```c
void setitem(int num, string text, bool enabled) {
    MENUITEMINFO mii;
    mii.fMask = MIIM_STRING | MIIM_STATE;
    mii.dwTypeData = text;
    mii.fState = enabled ? MFS_ENABLED : MFS_DISABLED;
    SetMenuItemInfo(current_menu, num, TRUE, &mii);
}
```

#### State Machine Functions

| ID | Function | Description |
|----|----------|-------------|
| `0x05` | `setstatemachine` | Set active state machine |
| `0x06` | `setstate` | Transition to state |
| `0x07` | `callstatemachine` | Call nested state machine |
| `0x08` | `returnstatemachine` | Return from nested SM |

**State Machine Model:**

```
┌─────────────────────────────────────┐
│           State Machine             │
│  ┌─────────┐    ┌─────────┐        │
│  │ State A │───►│ State B │        │
│  └─────────┘    └─────────┘        │
│       │              │              │
│       ▼              ▼              │
│  [on_enter]     [on_enter]         │
│  [on_timer]     [on_timer]         │
│  [on_exit]      [on_exit]          │
└─────────────────────────────────────┘
```

```c
void setstatemachine(STATEMACHINE handle) {
    // Push current SM to stack (for nesting)
    if (current_sm) {
        sm_stack_push(current_sm, current_state);
    }
    current_sm = handle;
    current_state = handle->initial_state;
}

void setstate(STATE handle) {
    if (current_state && current_state->on_exit) {
        execute_function(current_state->on_exit);
    }
    current_state = handle;
    if (current_state->on_enter) {
        execute_function(current_state->on_enter);
    }
}
```

---

### 2. Timer Functions

| ID | Function | Description |
|----|----------|-------------|
| `0x09` | `settimer` | Start/configure timer |
| `0x0A` | `testtimer` | Check if timer expired |

**Timer System:**

INPA supports up to 16 timers (0-15).

```c
// Global timer state
uint32_t timer_start[16];
uint32_t timer_duration[16];

void settimer(int timernum, int timeval) {
    if (timernum < 0 || timernum > 15) {
        raise_error(ERROR_INVALID_TIMER);
        return;
    }
    timer_start[timernum] = GetTickCount();
    timer_duration[timernum] = timeval;  // milliseconds
}

void testtimer(int timernum, bool* expired) {
    if (timernum < 0 || timernum > 15) {
        raise_error(ERROR_INVALID_TIMER);
        *expired = FALSE;
        return;
    }
    
    uint32_t elapsed = GetTickCount() - timer_start[timernum];
    *expired = (elapsed >= timer_duration[timernum]);
}
```

**Usage Pattern:**

```c
// IPS code
settimer(0, 1000);  // 1 second timer
while (TRUE) {
    bool expired;
    testtimer(0, expired);
    if (expired) break;
    delay(100);
}
```

---

### 3. String Functions

| ID | Function | Description |
|----|----------|-------------|
| `0x23` | `strcat` | Concatenate strings |
| `0x24` | `strlen` | Get string length |
| `0x25` | `midstr` | Extract substring |

**`strcat(out: string dest, in: string left, in: string right)`**

```c
void strcat(string* dest, string left, string right) {
    // Validate inputs
    if (!left || !right) {
        raise_error(ERROR_INVALID_PARAM);
        return;
    }
    
    // Allocate result
    size_t len = strlen(left) + strlen(right) + 1;
    char* result = allocate_string(len);
    
    strcpy(result, left);
    strcat(result, right);
    
    // Assign to output parameter
    free_string(*dest);
    *dest = result;
}
```

**`strlen(out: int length, in: string str)`**

```c
void strlen_func(int* length, string str) {
    if (!str) {
        *length = 0;
        return;
    }
    *length = (int)strlen(str);
}
```

**`midstr(out: string result, in: string str, in: int start, in: int length)`**

```c
void midstr(string* result, string str, int start, int len) {
    if (!str || start < 0 || len < 0) {
        raise_error(ERROR_INVALID_PARAM);
        return;
    }
    
    int str_len = strlen(str);
    if (start >= str_len) {
        *result = allocate_string(1);
        (*result)[0] = '\0';
        return;
    }
    
    int actual_len = min(len, str_len - start);
    char* res = allocate_string(actual_len + 1);
    strncpy(res, str + start, actual_len);
    res[actual_len] = '\0';
    
    free_string(*result);
    *result = res;
}
```

---

### 4. Type Conversion Functions

| ID | Function | Description |
|----|----------|-------------|
| `0x1E` | `realtostring` | Real → String with format |
| `0x1F` | `stringtoreal` | String → Real |
| `0x20` | `inttostring` | Int → String |
| `0x21` | `stringtoint` | String → Int |
| `0x26` | `realtoint` | Real → Int |
| `0x27` | `inttoreal` | Int → Real |
| `0x28` | `bytetoint` | Byte → Int |
| `0x29` | `inttolong` | Int → Long |
| `0x2A` | `longtoreal` | Long → Real |

**`realtostring(in: real value, in: string format, out: string result)`**

Format string uses C-style printf specifiers:

```c
void realtostring(double value, string format, string* result) {
    char buffer[256];
    
    // Parse format (e.g., "%.2f", "%10.3e")
    sprintf(buffer, format, value);
    
    free_string(*result);
    *result = duplicate_string(buffer);
}
```

**`stringtoint(in: string value, out: int result)`**

```c
void stringtoint(string value, int* result) {
    if (!value || !*value) {
        *result = 0;
        return;
    }
    
    // Handle hex prefix
    if (value[0] == '0' && (value[1] == 'x' || value[1] == 'X')) {
        *result = (int)strtol(value, NULL, 16);
    } else {
        *result = atoi(value);
    }
}
```

---

### 5. Date/Time Functions

| ID | Function | Description |
|----|----------|-------------|
| `0x1C` | `getdate` | Get current date |
| `0x1D` | `gettime` | Get current time |
| `0x1B` | `delay` | Pause execution |

**`getdate(out: string date)`**

```c
void getdate(string* date) {
    SYSTEMTIME st;
    GetLocalTime(&st);
    
    char buffer[32];
    sprintf(buffer, "%02d.%02d.%04d", st.wDay, st.wMonth, st.wYear);
    
    free_string(*date);
    *date = duplicate_string(buffer);
}
```

**`gettime(out: string time)`**

```c
void gettime(string* time) {
    SYSTEMTIME st;
    GetLocalTime(&st);
    
    char buffer[32];
    sprintf(buffer, "%02d:%02d:%02d", st.wHour, st.wMinute, st.wSecond);
    
    free_string(*time);
    *time = duplicate_string(buffer);
}
```

**`delay(in: int milliseconds)`**

```c
void delay(int ms) {
    // Process Windows messages while waiting
    DWORD start = GetTickCount();
    while (GetTickCount() - start < (DWORD)ms) {
        MSG msg;
        if (PeekMessage(&msg, NULL, 0, 0, PM_REMOVE)) {
            TranslateMessage(&msg);
            DispatchMessage(&msg);
        }
        Sleep(10);  // Small sleep to reduce CPU usage
    }
}
```

---

### 6. Script Control Functions

| ID | Function | Description |
|----|----------|-------------|
| `0x0C` | `exit` | Exit current script |
| `0x0D` | `exitwindows` | Exit INPA application |
| `0x0E` | `scriptselect` | Show script selection dialog |
| `0x0F` | `scriptchange` | Load different script |

**`exit()`**

```c
void exit_func() {
    // Set flag to terminate script execution
    execution_flags |= FLAG_SCRIPT_EXIT;
    
    // Clear current screen/menu/state
    current_screen = NULL;
    current_menu = NULL;
    current_sm = NULL;
}
```

**`scriptchange(in: string NewScriptFile)`**

```c
void scriptchange(string new_script) {
    // Validate script file exists
    if (!file_exists(new_script)) {
        raise_error(ERROR_FILE_NOT_FOUND);
        return;
    }
    
    // Execute cleanup
    if (inpaexit_function) {
        execute_function(inpaexit_function);
    }
    
    // Unload current IPO
    unload_ipo(current_ipo);
    
    // Load new IPO
    current_ipo = load_ipo(new_script);
    
    // Execute init
    execute_function(current_ipo->inpainit);
}
```

---

### 7. Selection/Job Control

| ID | Function | Description |
|----|----------|-------------|
| `0x10` | `select` | Enable selection mode |
| `0x11` | `deselect` | Disable selection mode |
| `0x12` | `control` | Enter control mode |
| `0x13` | `start` | Start job execution |
| `0x14` | `stop` | Stop job execution |
| `0x0B` | `setjobstatus` | Set job status code |

These functions control the EDIABAS job execution cycle.

**EDIABAS Integration Model:**

```
┌──────────────────────────────────────────────┐
│                  INPA Script                 │
│                                              │
│   select()     ──►  EDIABAS: Prepare job    │
│   start()      ──►  EDIABAS: Execute job    │
│   [wait for results]                         │
│   stop()       ──►  EDIABAS: Cleanup        │
│   deselect()   ──►  EDIABAS: Release        │
│                                              │
└──────────────────────────────────────────────┘
```

```c
void select(bool multiple) {
    // Initialize EDIABAS API
    if (!ediabas_initialized) {
        apiInit();
    }
    
    selection_mode = true;
    multiple_selection = multiple;
    
    // Clear previous selections
    clear_job_selections();
}

void start() {
    if (!selection_mode) {
        raise_error(ERROR_NOT_IN_SELECTION);
        return;
    }
    
    // Execute all selected jobs
    for (job in selected_jobs) {
        apiJob(job->sgbd, job->name, job->params, job->results);
    }
    
    job_running = true;
}

void stop() {
    job_running = false;
    apiEnd();
}
```

---

### 8. Print Functions

| ID | Function | Description |
|----|----------|-------------|
| `0x17` | `printscreen` | Print current screen |
| `0x18` | `printfile` | Print file to printer |

**`printscreen()`**

```c
void printscreen() {
    if (!current_screen) {
        return;
    }
    
    // Create bitmap of screen content
    HDC screenDC = GetDC(main_window);
    HDC memDC = CreateCompatibleDC(screenDC);
    
    // ... capture screen to bitmap ...
    
    // Send to default printer
    PrintDlg(&pd);
    if (pd.hDC) {
        StartDoc(pd.hDC, &di);
        StartPage(pd.hDC);
        BitBlt(pd.hDC, 0, 0, width, height, memDC, 0, 0, SRCCOPY);
        EndPage(pd.hDC);
        EndDoc(pd.hDC);
    }
}
```

---

### 9. API/Toggle Functions

| ID | Function | Description |
|----|----------|-------------|
| `0x15` | `getapistring` | Get EDIABAS result as string |
| `0x16` | `togglelist` | Get toggle button states |

These functions interface with EDIABAS results and UI toggle states.

**`getapistring(bool ArgNumFlag, bool FullScreenFlag, out: string ApiString)`**

```c
void getapistring(bool include_argnum, bool full_screen, string* result) {
    // Build string from current EDIABAS results
    StringBuilder sb;
    
    for (int i = 0; i < api_result_count; i++) {
        if (include_argnum) {
            sb_appendf(&sb, "%d: ", i);
        }
        sb_append(&sb, api_results[i].value);
        sb_append(&sb, "\n");
    }
    
    free_string(*result);
    *result = sb_to_string(&sb);
}
```

---

## Error Handling

System functions can raise errors through `FUN_0045d573` or `FUN_0045d76e`:

| Error Code | Meaning |
|------------|---------|
| `0x06` | Invalid parameter type |
| `0x08` | Null pointer |
| `0x0B` | Value out of range |
| `0x13` | Invalid value |
| `0x14` | API call failed |
| `0x15` | Function not supported |
| `0x17` | Operation not allowed |
| `0x149` | Type mismatch |
| `0x190` | Division by zero |
| `0x194` | Invalid function |
| `0x195` | Operation not supported for type |

---

## Complete Function List by Category

### UI (0x00-0x08)
- `0x00` setmenutitle, `0x01` setmenu, `0x02` setitem
- `0x03` settitle, `0x04` setscreen
- `0x05` setstatemachine, `0x06` setstate
- `0x07` callstatemachine, `0x08` returnstatemachine

### Timer (0x09-0x0A)
- `0x09` settimer, `0x0A` testtimer

### Job Control (0x0B-0x14)
- `0x0B` setjobstatus, `0x0C` exit, `0x0D` exitwindows
- `0x0E` scriptselect, `0x0F` scriptchange
- `0x10` select, `0x11` deselect, `0x12` control
- `0x13` start, `0x14` stop

### Output (0x15-0x1A)
- `0x15` getapistring, `0x16` togglelist, `0x17` printscreen
- `0x18` printfile, `0x1A` setcolor

### Utility (0x1B-0x2A)
- `0x1B` delay, `0x1C` getdate, `0x1D` gettime
- `0x1E` realtostring, `0x1F` stringtoreal
- `0x20` inttostring, `0x21` stringtoint
- `0x22` hexconvert, `0x23` strcat, `0x24` strlen, `0x25` midstr
- `0x26` realtoint, `0x27` inttoreal, `0x28` bytetoint
- `0x29` inttolong, `0x2A` longtoreal

### EDIABAS/PEM (0x2B+)
- Various ECU communication functions (see full list in ipo-file-structure.md)

---

## Stack Protocol

### Input Parameters (`in:`)

Pushed as values before CALL:

```
01 [scope] [index]   ; LOAD - push value copy
```

### Output Parameters (`out:`)

Pushed as references before CALL:

```
02 [scope] [index]   ; PUSHREF - push reference
```

### Return Values

System functions that return values store them in out parameters. There is no direct return value mechanism - all outputs go through `out:` parameters.

### Example Call Sequence

```c
// IPS: strlen(result, mystring);
```

```
0F 00 00 00        ; FRAME
02 02 00 00        ; PUSHREF local #0 (result - out param)
01 02 01 00        ; LOAD local #1 (mystring - in param)
0C 81 24 00        ; CALL strlen (0x24)
```

After the call:
- `local #0` contains the string length
- Stack is cleaned up by `FUN_0045ee95`

---

*Based on INPA.exe decompilation and observed behavior*
