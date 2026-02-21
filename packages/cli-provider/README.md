# @inpax/cli-provider

Headless CLI provider for INPAX.

Simple `IUIProvider` implementation that outputs to stdout. Useful for batch execution and testing.

## Usage

```typescript
import { CliProvider } from '@inpax/cli-provider';

const provider = new CliProvider();

provider.setTitle('My Script');
// Output: ═══ My Script ═══

provider.text(0, 0, 'Hello World');
// Output: Hello World

provider.analogOut(42.5, 1, 0, 0, 100, 10, 90, '%.1f');
// Output: 42.5

provider.digitalOut(true, 2, 0, 'ON', 'OFF');
// Output: ON
```

## Features

- Simple stdout output
- No interactive input (returns defaults)
- Good for automated testing
- No terminal dependencies

## Comparison

| Feature | TuiProvider | CliProvider |
|---------|-------------|-------------|
| Full UI | ✅ | ❌ |
| Interactive | ✅ | ❌ |
| Input dialogs | ✅ | Returns defaults |
| Dependencies | ink, react | None |
| Use case | Interactive | Batch/testing |

## With CLI

```bash
# Use CliProvider with --headless flag
inpax run script.ipo --headless
```
