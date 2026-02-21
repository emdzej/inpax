# @inpax/providers

Provider factory for INPAX.

Creates and configures provider instances based on runtime environment.

## Usage

```typescript
import { createProviders } from '@inpax/providers';

const { ui, ediabas } = createProviders({
  mode: 'tui',        // 'tui' | 'cli' | 'mock'
  sgbdPath: '/path/to/sgbd',
});
```

## Modes

| Mode | UI Provider | EDIABAS Provider |
|------|-------------|------------------|
| `tui` | TuiProvider | EdiabasProvider |
| `cli` | CliProvider | EdiabasProvider |
| `mock` | MockUIProvider | MockEdiabasProvider |
