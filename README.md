# WS-Events (WSEVENTS)

Event handler system for managing WebSocket-based event processing and communication

[![npm version](https://img.shields.io/npm/v/ws-events-handler.svg)](https://www.npmjs.com/package/ws-events-handler)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Documentation](#documentation)
- [License](#license)

## Features

- **Automatic Reconnection** — Exponential backoff reconnection strategy
- **Heartbeat / Keep-Alive** — Configurable ping/pong with timeout detection
- **Event-Driven Architecture** — Register listeners for custom event types
- **Cycle / Batch Processing** — Group N messages and process them together
- **Automatic ACK** — Built-in acknowledgment events (e.g., `eventName-ack`)
- **Offline Resilience** — Queue events locally and dispatch on reconnect
- **Cross-Platform** — Browser `navigator.onLine` + Node.js NetworkQualityMonitor
- **Debug Mode** — Verbose logging for development

## Installation

```bash
npm install ws-events-handler
```

## Quick Start

```javascript
import WebSocketEventsHandler from 'ws-events-handler';

const ws = new WebSocketEventsHandler('ws://localhost:8080', {
  heartbeat: { interval: 15000, message: 'ping', expectedResponse: 'pong', timeout: 10000 },
  connection: { maxRetries: 5, retryDelay: 1000 },
  debug: true
});

ws.on('message', (data) => console.log('Received:', data));
ws.send('greeting', { text: 'Hello!' });
```

## Documentation

| Document | Description |
|----------|-------------|
| [Getting Started](docs/01-getting-started.md) | Installation, setup, first steps |
| [Core Concepts](docs/02-core-concepts.md) | Architecture, patterns, design decisions |
| [Event Handling](docs/03-event-handling.md) | Event lifecycle, message format, sending/receiving |
| [Handlers](docs/04-handlers.md) | Register, configure, unregister handlers |
| [Connections](docs/06-connections.md) | Lifecycle, reconnection, heartbeat |
| [Error Handling](docs/07-error-handling.md) | Error types, recovery, logging |
| [API Reference](docs/08-api-reference.md) | Full API reference |
| [Examples](docs/09-examples.md) | Real-world usage examples |
| [Advanced Topics](docs/11-advanced-topics.md) | Cycle, ACK, local events, monitoring |
| [Troubleshooting](docs/13-troubleshooting.md) | Common issues and solutions |
| [Contributing](docs/CONTRIBUTING.md) | How to contribute |

## License

ISC License