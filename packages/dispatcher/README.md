# @inpax/dispatcher

Event dispatcher for INPAX runtime.

Internal package for routing events between interpreter, UI, and EDIABAS providers.

## Usage

```typescript
import { Dispatcher } from '@inpax/dispatcher';

const dispatcher = new Dispatcher();

dispatcher.on('menu:select', (event) => {
  // Handle menu selection
});

dispatcher.emit('screen:update', { ... });
```
