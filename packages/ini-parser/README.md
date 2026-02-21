# @inpax/ini-parser

INPA configuration file parser.

Parses INI files used by INPA with support for:
- `//` style comments
- Duplicate keys as arrays
- INPA-specific formats (INPA.INI, group files)

## Usage

### Basic INI Parsing

```typescript
import { parse, parseFile, stringify } from '@inpax/ini-parser';

const content = `
// Configuration file
[SECTION]
KEY=value
ENTRY=code1,desc1,
ENTRY=code2,desc2,
`;

const ini = parse(content);
// { SECTION: { KEY: 'value', ENTRY: ['code1,desc1,', 'code2,desc2,'] } }

// From file
const config = await parseFile('/path/to/config.ini');
```

### INPA.INI Format

```typescript
import { parseInpaConfig } from '@inpax/ini-parser';

const config = parseInpaConfig(content);
// {
//   version: '1.0',
//   environ: 'BMW',
//   script: 'E46.IPO',
//   fKeys: { F1: 'Start', F10: 'Exit' }
// }
```

### Group Config (E46.ENG, etc.)

```typescript
import { parseGroupConfig, findRootSection, getValidEntries } from '@inpax/ini-parser';

const config = parseGroupConfig(content);
const root = findRootSection(config);

console.log(root.description); // 'Select E46'
console.log(getValidEntries(root));
// [{ code: 'DME', description: 'Engine Control' }, ...]
```

## Helper Functions

```typescript
import { get, getFirst, getAll, hasSection, hasKey, sections, keys } from '@inpax/ini-parser';

get(ini, 'SECTION', 'KEY');           // 'value'
get(ini, 'SECTION', 'MISSING', 'def'); // 'def'
getFirst(ini, 'SECTION', 'ENTRY');     // 'code1,desc1,'
getAll(ini, 'SECTION', 'ENTRY');       // ['code1,desc1,', 'code2,desc2,']
hasSection(ini, 'SECTION');            // true
hasKey(ini, 'SECTION', 'KEY');         // true
sections(ini);                          // ['SECTION']
keys(ini, 'SECTION');                   // ['KEY', 'ENTRY']
```
