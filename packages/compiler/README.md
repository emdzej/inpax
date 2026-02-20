# @inpax/compiler

INPA IPS to IPO compiler written in TypeScript.

## Usage

```bash
# Compile IPS to IPO
inpax-compile script.ips -o script.ipo

# Show tokens
inpax-compile script.ips --tokens

# Show AST
inpax-compile script.ips --ast
```

## Example IPS

```basic
; Test script
global
  int counter
  string message

const
  int MAX_COUNT = 100
  string TITLE = "Test"

function inpainit()
  settitle(TITLE)
  counter = 0
endfunc

function inpaexit()
endfunc

function main()
  var
    int i
  
  while counter < MAX_COUNT
    counter = counter + 1
  wend
  
  if counter == MAX_COUNT then
    message = "Done"
  endif
endfunc
```

## Architecture

```
IPS Source
    ↓
  Lexer    (tokens.ts, lexer.ts)
    ↓
  Parser   (parser.ts) → AST (types.ts)
    ↓
 CodeGen   (codegen.ts)
    ↓
IPO Binary
```

## Supported Syntax

### Types
- `bool`, `byte`, `int`, `long`, `real`, `string`

### Declarations
- `global` - Global variables
- `const` - Constants
- `var`/`local` - Local variables
- `function`/`endfunc` - Functions

### Control Flow
- `if`/`then`/`elseif`/`else`/`endif`
- `while`/`wend`
- `for`/`to`/`step`/`next`
- `repeat`/`until`
- `select`/`case`/`default`/`endselect`

### Operators
- Arithmetic: `+`, `-`, `*`, `/`, `%`
- Comparison: `==`, `!=`, `<>`, `<`, `<=`, `>`, `>=`
- Logical: `and`, `or`, `not`
- Bitwise: `&`, `|`, `^`

## TODO

- [ ] Screen/Menu/StateMachine compilation
- [ ] Parameter directions (in/out/inout)
- [ ] For loops
- [ ] Arrays
- [ ] Full system function mapping
