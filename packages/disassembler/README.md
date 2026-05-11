# @emdzej/inpax-disassembler

IPO bytecode disassembler for INPAX.

## Usage

```typescript
import { disassemble, formatDisassembly } from '@emdzej/inpax-disassembler';
import { parseIPO } from '@emdzej/inpax-parser';
import { readFileSync } from 'fs';

const buffer = new Uint8Array(readFileSync('script.ipo'));
const ipo = parseIPO(buffer);

// Disassemble all functions
const result = disassemble(ipo);

// Format as text
const text = formatDisassembly(result);
console.log(text);
```

## Output Format

```asm
; === Function: inpainit ===
; Args: 0, Locals: 2

0000: PUSH    0x0001          ; 1
0003: SYSCALL setscreen       ; System call
0006: PUSH    "Hello"         ; String
000A: PUSH    0x0000          ; Row
000D: PUSH    0x0000          ; Col
0010: SYSCALL text            ; Display text
0013: RET                     ; Return
```

## CLI

```bash
# Disassemble to stdout
inpax dis script.ipo

# Save to file
inpax dis script.ipo -o output.asm
```

## Options

```typescript
interface DisassembleOptions {
  showOffsets?: boolean;    // Show byte offsets
  showComments?: boolean;   // Add comments
  resolveStrings?: boolean; // Inline string values
  resolveLabels?: boolean;  // Use label names for jumps
}
```
