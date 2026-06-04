# WS-Events

Event handler system for managing WebSocket-based event processing and communication.

## Table of Contents

- [Getting Started](docs/01-getting-started.md)
- [Core Concepts](docs/02-core-concepts.md)
- [Event Handling](docs/03-event-handling.md)
- [Handlers](docs/04-handlers.md)
- [Middleware & Extension Points](docs/05-middleware.md)
- [Connection Management](docs/06-connections.md)
- [Error Handling](docs/07-error-handling.md)
- [API Reference](docs/08-api-reference.md)
- [Examples](docs/09-examples.md)
- [Testing](docs/10-testing.md)
- [Advanced Topics](docs/11-advanced-topics.md)
- [Deployment](docs/12-deployment.md)
- [Troubleshooting](docs/13-troubleshooting.md)
- [Contributing](docs/CONTRIBUTING.md)

## Installation

```bash
npm install ws-events-handler
```

## Quick Start

```javascript
import WebSocketEventsHandler from 'ws-events-handler';

const wsHandler = new WebSocketEventsHandler('ws://localhost:8080', {
  heartbeat: {
    interval: 15000,
    message: 'ping',
    expectedResponse: 'pong',
    timeout: 10000
  },
  connection: {
    maxRetries: 5,
    retryDelay: 1000
  },
  debug: true
});

wsHandler.on('myEvent', (data) => console.log('Event received:', data));
wsHandler.send('myEvent', { key: 'value' });
```

## Features

- **Automatic Reconnection**: Exponential backoff with configurable max retries and base delay.
- **Heartbeat Support**: Configurable ping/pong with timeout detection for connection health.
- **Cycle Feature**: Batch events into cycles with configurable rounds and count, including exclusive mode.
- **Acknowledgement (ACK)**: Automatic ACK events for received messages with optional original payload inclusion.
- **Local Event Storage**: Offline event queuing with delayed dispatch on reconnection.
- **Network Detection**: Browser `online`/`offline` events + Node.js `NetworkQualityMonitor` polling.
- **Cross-Environment**: Works seamlessly in both browser and Node.js runtimes.
- **Debug Mode**: Verbose console logging for troubleshooting.

## API Overview

### Constructor

```javascript
new WebSocketEventsHandler(wsUrl, config?)
```

### Methods

| Method | Description |
|--------|-------------|
| `on(eventName, config)` | Register an event handler (function or config object) |
| `off(eventName)` | Deactivate a registered handler |
| `send(eventName, payload?)` | Send an event with optional payload |
| `destroy(reason?)` | Clean up resources and close the connection |

### Configuration Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `heartbeat` | object | `{}` | Heartbeat settings (set to `false` to disable) |
| `heartbeat.interval` | number | `15000` | Interval between heartbeats (ms) |
| `heartbeat.message` | string | `'ping'` | Heartbeat message to send |
| `heartbeat.expectedResponse` | string | `'pong'` | Expected server response |
| `heartbeat.timeout` | number | `10000` | Timeout for expected response (ms) |
| `connection.maxRetries` | number | `5` | Maximum reconnection attempts |
| `connection.retryDelay` | number | `1000` | Base retry delay for exponential backoff (ms) |
| `connection.fallback.localEvents` | boolean | `false` | Enable offline event storage |
| `connection.fallback.localEventsDelay` | number | `1000` | Delay between dispatching stored events (ms) |
| `debug` | boolean | `false` | Enable verbose console logging |

### Event `on()` Config

```javascript
wsHandler.on('eventName', {
  callback: (data) => { /* handler logic */ },
  cycle: {
    every: 5,
    rounds: 3,
    exclusive: true,
    once: false,
    callback: (payloads) => { /* batch handler */ }
  },
  ack: {
    event: 'customAckEvent',
    originalEvent: true
  }
});
```

## License

ISC