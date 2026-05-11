# @emdzej/inpax-parser

IPO bytecode parser for INPAX.

## Usage

```typescript
import { parseIPO, parseIPOHeader } from '@emdzej/inpax-parser';
import { readFileSync } from 'fs';

const buffer = new Uint8Array(readFileSync('script.ipo'));

// Parse header only
const header = parseIPOHeader(buffer);
console.log('Version:', header.version);
console.log('Screens:', header.screenCount);
console.log('Menus:', header.menuCount);

// Parse full IPO
const ipo = parseIPO(buffer);
console.log('Functions:', ipo.functions.length);
console.log('Strings:', ipo.strings.length);
```

## IPO Structure

```
┌────────────────────────┐
│ Header (fixed size)    │
├────────────────────────┤
│ String Table           │
├────────────────────────┤
│ Screen Definitions     │
├────────────────────────┤
│ Menu Definitions       │
├────────────────────────┤
│ Function Table         │
├────────────────────────┤
│ Bytecode               │
└────────────────────────┘
```

## Parsed Objects

### IPOHeader

```typescript
interface IPOHeader {
  magic: number;
  version: number;
  stringTableOffset: number;
  screenCount: number;
  menuCount: number;
  functionCount: number;
  // ...
}
```

### IPOFunction

```typescript
interface IPOFunction {
  name: string;
  offset: number;
  size: number;
  localCount: number;
  argCount: number;
}
```
