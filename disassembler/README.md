# @inpax/dis

IPO bytecode disassembler.

## Usage

```bash
# Disassemble
inpax-dis script.ipo

# Output to file
inpax-dis script.ipo -o script.dis

# Single function
inpax-dis script.ipo -f inpainit

# List functions
inpax-dis script.ipo -l

# File info
inpax-dis script.ipo -i
```

## Output

```
; Function: inpainit
; Block ID: 2
; Instructions: 15

0000: [0F000000] FRAME        ; push call frame
0001: [11000000] PUSHCONST    const[0] ; string "Test"
0002: [0C810300] CALL         sys settitle
0003: [10000100] POP          1
```
