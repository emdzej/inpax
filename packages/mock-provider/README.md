# @inpax/mock-provider

Mock providers for INPAX testing.

## Usage

```typescript
import { MockUIProvider, MockEdiabasProvider } from '@inpax/mock-provider';

// Mock UI
const ui = new MockUIProvider();
ui.setTitle('Test');
console.log(ui.getTitle()); // 'Test'

// Mock EDIABAS
const ediabas = new MockEdiabasProvider();
ediabas.setJobResult('IDENT', { id: '12345' });

await ediabas.connect('DME');
const result = await ediabas.job('IDENT');
console.log(result); // { id: '12345' }
```

## MockUIProvider

Records all UI calls for testing:

```typescript
const ui = new MockUIProvider();

// Use provider...
ui.text(0, 0, 'Hello');
ui.setItem(1, 'Start', true);

// Check recorded calls
expect(ui.calls).toContainEqual({
  method: 'text',
  args: [0, 0, 'Hello']
});
```

## MockEdiabasProvider

Simulates EDIABAS responses:

```typescript
const ediabas = new MockEdiabasProvider();

// Set up expected responses
ediabas.setJobResult('IDENT', {
  id: 'DME_12345',
  variant: 'MS45'
});

ediabas.setJobResult('STATUS_LESEN', {
  rpm: 850,
  temp: 90
});

// Use in tests
const result = await ediabas.job('IDENT');
```

## Use with Interpreter

```typescript
import { Interpreter } from '@inpax/interpreter';
import { MockUIProvider, MockEdiabasProvider } from '@inpax/mock-provider';

const interpreter = new Interpreter({
  ipo,
  ui: new MockUIProvider(),
  ediabas: new MockEdiabasProvider(),
});

await interpreter.run('inpainit');
```
