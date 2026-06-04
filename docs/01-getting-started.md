# Getting Started

## Prerequisites

- **Node.js** v12+ (or a modern browser with native WebSocket API)
- **npm** or **yarn** package manager

## Installation

Install the package via npm:

```bash
npm install ws-events-handler
```

## Importing the Library

### ESM (ECMAScript Modules)

```javascript
import WebSocketEventsHandler from 'ws-events-handler';
```

### CommonJS

```javascript
const WebSocketEventsHandler = require('ws-events-handler');
```

## Basic Setup

Create a new instance pointing to your WebSocket server:

```javascript
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
```

### Minimal Setup

All options are optional. The simplest possible setup:

```javascript
const wsHandler = new WebSocketEventsHandler('ws://localhost:8080');
```

This will use all default values (heartbeat enabled, 5 retries, 1s base delay, no local events, no debug).

## Verification

Create a simple test file `index.js`:

```javascript
import WebSocketEventsHandler from 'ws-events-handler';

const wsHandler = new WebSocketEventsHandler('ws://localhost:8080', {
  debug: true
});

wsHandler.on('welcome', (data) => {
  console.log('Server says:', data.message);
});
```

Run it:

```bash
node index.js
```

If the server is running and reachable, you should see:

```
info: Connected to server
```

## Next Steps

- [Core Concepts](02-core-concepts.md) — Understand the architecture
- [Event Handling](03-event-handling.md) — Learn how events flow through the system
- [Handlers](04-handlers.md) — Dive into handler configuration (cycles, ACKs)
- [API Reference](08-api-reference.md) — Full API documentation