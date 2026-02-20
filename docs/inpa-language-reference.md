# INPA Language Reference

Based on official INPA V2.2 User Documentation (Softing GmbH / BMW AG, 2000-07-20).

## File Structure (5.1)

```
[pragmas]
[includes]
[imported functions]
[external function declarations]
[global data definitions]
[test procedure description]
```

### Pragmas (5.1.1)
```basic
#PRAGMA AUTOACT <value>
#PRAGMA TIMER <value>
```

### Includes (5.1.2)
```basic
#INCLUDE "filename.src"
```

### Imported Functions (5.1.3)
```basic
IMPORT "library.dll" : functionname(params) : returntype
```

### External Function Declarations (5.1.4)
```basic
EXTERNAL FUNCTION funcname(params) : returntype
```

### Global Data Definitions (5.1.5)
```basic
GLOBAL
  bool flag
  int counter
  long value
  real number
  string[80] text
```

## Language Elements (5.3)

### User-Defined Functions (5.3.1)
```basic
FUNCTION name(type param1, OUT type param2, INOUT type param3)
  VAR
    int local1
    
  ; function body
ENDFUNC
```

Parameter directions:
- **IN** (default) — pass by value
- **OUT** — return value
- **INOUT** — pass by reference

### Screen Display (5.3.3)
```basic
SCREEN name, title, script

  LINE line1, row, col, "format"
  CONTROL control1, row, col, width, height
  
ENDSCREEN
```

### Menu Control (5.3.4)
```basic
MENU name, title

  ITEM item1, "Label", "hotkey", func_to_call
  
ENDMENU
```

### State Machines (5.3.5)
```basic
STATEMACHINE name

  STATE state1, func_entry
  STATE state2, func_entry
  
ENDSTATEMACHINE
```

### Logic Tables (5.3.6)
```basic
LOGICTABLE name, rows, cols

  ; table data
  
ENDLOGICTABLE
```

### Control Structures (5.3.7)

#### IF-THEN-ELSE
```basic
IF condition THEN
  ; statements
ELSEIF condition THEN
  ; statements
ELSE
  ; statements
ENDIF
```

#### WHILE-WEND
```basic
WHILE condition
  ; statements
WEND
```

#### REPEAT-UNTIL
```basic
REPEAT
  ; statements
UNTIL condition
```

#### FOR-NEXT
```basic
FOR var = start TO end STEP step
  ; statements
NEXT
```

#### SELECT-CASE
```basic
SELECT expression
  CASE value1:
    ; statements
  CASE value2:
    ; statements
  DEFAULT:
    ; statements
ENDSELECT
```

## Standard Library Functions (5.3.8)

### Screen Configuration
- `settitle(string title)` — Set window title
- `setscreen(string name)` — Switch to screen
- `setmenu(string name)` — Set active menu
- `settimer(int ms)` — Set timer interval

### Output
- `text(row, col, string text)` — Print text
- `textout(string text)` — Output to current position
- `inttostr(int val, int width, int base)` — Convert int to string
- `realtostr(real val, int width, int decimals)` — Convert real to string

### Input
- `inputint(string prompt)` — Input integer
- `inputstring(string prompt)` — Input string

### Dialog
- `messagebox(string title, string text, int buttons)` — Show message box
- `inputbox(string title, string prompt, string default)` — Input dialog

### File I/O
- `fileopen(string path, string mode)` — Open file
- `fileclose(int handle)` — Close file
- `fileread(int handle, OUT string line)` — Read line
- `filewrite(int handle, string line)` — Write line

### EDIABAS Interface
- `edisopen(string sgbd)` — Open EDIABAS session
- `edisclose()` — Close session
- `edisjob(string job, string params)` — Execute job
- `edisresult(string name, OUT var result)` — Get result

### String Functions
- `strlen(string s)` — Length
- `substr(string s, int start, int len)` — Substring
- `strcat(string a, string b)` — Concatenate
- `strcmp(string a, string b)` — Compare
- `strupr(string s)` — Uppercase
- `strlwr(string s)` — Lowercase

### Conversion
- `chr(int code)` — ASCII to char
- `asc(string char)` — Char to ASCII
- `atoi(string s)` — String to int
- `itoa(int val)` — Int to string
- `atof(string s)` — String to float
- `ftoa(real val)` — Float to string

### System
- `delay(int ms)` — Wait milliseconds
- `exit()` — Exit program
- `getdate(OUT int y, OUT int m, OUT int d)` — Get date
- `gettime(OUT int h, OUT int m, OUT int s)` — Get time

## Data Types

| Type | Size | Range |
|------|------|-------|
| bool | 1 byte | TRUE/FALSE |
| byte | 1 byte | 0-255 |
| int | 2 bytes | -32768 to 32767 |
| long | 4 bytes | -2^31 to 2^31-1 |
| real | 8 bytes | IEEE 754 double |
| string | variable | max 255 chars |

## Operators

### Arithmetic
`+`, `-`, `*`, `/`, `%` (modulo)

### Comparison
`=`, `<>`, `<`, `>`, `<=`, `>=`

### Logical
`AND`, `OR`, `NOT`

### Bitwise
`&`, `|`, `^` (XOR)

## Reserved Functions

Every IPS file must define:
- `inpainit()` — Called on startup (function ID 2)
- `inpaexit()` — Called on shutdown (function ID 3)

System-generated (in IPO):
- `__inpa_startup__` — Internal init (ID 0)
- `__inpa_shutdown__` — Internal cleanup (ID 1)

## See Also

- Full PDF: `docs/INPA_V2.2_User_Documentation.pdf`
- Appendix A (page 60): Formal language grammar
- Appendix B (page 67): Complete example
