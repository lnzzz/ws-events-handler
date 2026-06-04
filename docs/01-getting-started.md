# Getting Started

## Prerequisites

- Node.js 14+ or a modern browser with WebSocket support
- npm or yarn

## Installation

```bash
npm install ws-events-handler
```

## Basic Setup

```javascript
const WebSocketEventsHandler = require('ws-events-handler');
// or:
import WebSocketEventsHandler from 'ws-events-handler';

const ws = new WebSocketEventsHandler('ws://localhost:8080', {
  heartbeat: {
    interval: 15000,       // Send heartbeat every 15s
    message: 'ping',        // Heartbeat message
    expectedResponse: 'pong', // Expected reply
    timeout: 10000          // Wait 10s before reconnecting
  },
  connection: {
    maxRetries: 5,          // Max reconnection attempts
    retryDelay: 1000        // Initial delay (exponential backoff)
  },
  debug: true               // Enable verbose logging
});
```

## Verifying Connection

```javascript
ws.on('mounted', (data) => {
  console.log('Connected with ID:', data.id);
});
```

## Next Steps

- [Core Concepts](02-core-concepts.md)
- [Event Handling](03-event-handling.md)
- [API Reference](08-api-reference.md)