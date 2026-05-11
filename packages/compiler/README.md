# @emdzej/inpax-compiler

IPS source code compiler for INPAX (Work in Progress).

## Status

🚧 **In Development** — Not yet functional.

## Planned Usage

```typescript
import { compile } from '@emdzej/inpax-compiler';
import { readFileSync, writeFileSync } from 'fs';

const source = readFileSync('script.ips', 'utf-8');
const ipo = compile(source);
writeFileSync('script.ipo', ipo);
```

## IPS Language

INPA scripts use a C-like language:

```c
// Screen definition
SCREEN my_screen()
{
    textout("Hello World", 0, 0);
}

// Menu definition  
MENU main_menu()
{
    setitem(1, "Start", TRUE);
    setitem(10, "Exit", TRUE);
}

// Entry point
PROC inpainit()
{
    settitle("My Script");
    setscreen(my_screen, TRUE);
    setmenu(main_menu);
}

// Menu handler
PROC main_menu_select(item)
{
    if (item == 10) {
        exit();
    }
}
```

## Compiler Pipeline

```
┌─────────┐    ┌────────┐    ┌─────────┐    ┌────────┐
│  Lexer  │ -> │ Parser │ -> │ Codegen │ -> │  IPO   │
└─────────┘    └────────┘    └─────────┘    └────────┘
```

## Components

- **Lexer** — Tokenize IPS source
- **Parser** — Build AST
- **Codegen** — Generate bytecode
- **Linker** — Resolve references, build string table
