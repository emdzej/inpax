# @inpax/ediabasx-provider

EdiabasX provider for the INPA interpreter. Uses [@ediabasx/ediabas](https://github.com/emdzej/ediabasx) for real BMW ECU communication.

## Installation

```bash
# Install the provider
npm install @inpax/ediabasx-provider

# Install the required @ediabasx/ediabas package
# (see https://github.com/emdzej/ediabasx for setup)
npm install @ediabasx/ediabas
```

## Usage

```typescript
import { EdiabasXProvider } from '@inpax/ediabasx-provider';

// With config file
const provider = new EdiabasXProvider({
  configFile: './ediabas.config.json',
});

// Or with direct config
const provider = new EdiabasXProvider({
  config: {
    ecuPath: './ecu',
    simulation: false,
  },
});

// Initialize
await provider.init();

// Execute job
await provider.job('D_MOTOR', 'IDENT', '', '');

// Get results
const sets = provider.resultSets();
const value = provider.resultText('ECU', 1, '');

// Cleanup
await provider.end();
```

## Configuration

### From Config File

Create `ediabas.config.json`:

```json
{
  "version": 1,
  "interface": {
    "type": "serial",
    "serial": {
      "port": "/dev/ttyUSB0",
      "baudRate": 9600
    }
  },
  "paths": {
    "sgbd": "./ecu"
  }
}
```

### Direct Configuration

```typescript
const provider = new EdiabasXProvider({
  config: {
    ecuPath: './ecu',        // Path to SGBD/PRG files
    simulation: true,        // Use simulation mode
    timeout: 5000,           // Response timeout (ms)
    logging: false,          // Enable debug logging
  },
  autoConnect: true,         // Auto-connect on init
});
```

## Events

The provider emits standard INPA EDIABAS events:

- `job:complete` - Job executed successfully
- `job:error` - Job execution failed
- `connection:lost` - Connection to ECU lost
- `connection:restored` - Connection restored

## Requirements

- Node.js 18+
- `@ediabasx/ediabas` package (runtime dependency)
- SGBD/PRG files for target ECUs
- Hardware interface (K-Line adapter, DCAN, ENET) or simulation mode

## License

MIT
