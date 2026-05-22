# Getting Started

This guide walks you from a blank project to a working `ws-events-handler` client that
connects, sends events, and reacts to incoming events.

## Prerequisites

- **Node.js 14+** (the library uses class private fields `#foo`, which require Node 12+;
  Node 14 LTS or higher is recommended).
- The [`ws`](https://www.npmjs.com/package/ws) package — installed automatically as a
  dependency, but worth knowing about because Node falls back to it when no global
  `WebSocket` exists.
- (Optional) Any test runner (Jest / Mocha / Vitest) — see
  [docs/10-testing.md](10-testing.md).

## Installation

```bash
npm install ws-events-handler
# or
yarn add ws-events-handler
```

## Importing

### CommonJS (Node)

```javascript
const WebSocketEventsHandler = require('ws-events-handler');
```

### ESM (browser / bundler)

If you are bundling with webpack / rollup / vite, you can use the default export pattern:

```javascript
import WebSocketEventsHandler from 'ws-events-handler';
```

> The library publishes a CommonJS file (`WebSocketEventsHandler.js`) that uses
> `module.exports = WebSocketEventsHandler`. Most bundlers will interop this correctly.

## Minimal Example

```javascript
const WebSocketEventsHandler = require('ws-events-handler');

const ws = new WebSocketEventsHandler('ws://localhost:8080', {
  // turn the heartbeat on by passing any truthy `heartbeat` object
  heartbeat: {
    interval: 15000,            // ms between pings
    message: 'ping',            // outgoing payload
    expectedResponse: 'pong',   // payload that resets the timeout
    timeout: 10000              // if no `pong` in 10s, close + reconnect
  },
  connection: {
    maxRetries: 5,              // permanent close after 5 failed attempts
    retryDelay: 1000,           // base delay, doubled each attempt
    fallback: {
      localEvents: true,        // buffer outbound events while offline
      localEventsDelay: 500     // replay rate after reconnect
    }
  },
  debug: true                   // mirror lifecycle events to console
});

// Register a handler. The 2nd argument is a CONFIG OBJECT, not a bare function.
ws.on('chat:message', {
  callback: (data) => {
    console.log('incoming chat:message', data);
  }
});

// Send an event. The library wraps it as: ["chat:message", { when, id?, payload }]
ws.send('chat:message', { text: 'hello server' });
```

## Verifying Locally

The quickest way to verify the client end-to-end is to spin up a tiny echo server in a
second terminal:

```javascript
// server.js
const { WebSocketServer } = require('ws');

const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (socket) => {
  // 1. greet the client with a `mounted` event so it learns its ID
  socket.send(JSON.stringify(['mounted', { id: 'client-' + Date.now() }]));

  socket.on('message', (raw) => {
    const data = JSON.parse(raw.toString());

    // Heartbeat support: respond `"pong"` to `"ping"`
    if (data === 'ping') {
      socket.send(JSON.stringify('pong'));
      return;
    }

    // Echo the event back to whoever sent it
    const [name, body] = data;
    console.log('server got', name, body);
    socket.send(JSON.stringify([name, body.payload]));
  });
});

console.log('echo server up on ws://localhost:8080');
```

Run both:

```bash
node server.js          # terminal A
node my-client.js       # terminal B
```

With `debug: true` enabled, the client terminal should print:

```
Connected to server
Mounted with id: client-... on <timestamp>
incoming chat:message { text: 'hello server' }
```

## Next Steps

- Understand the wire format and architecture: [Core Concepts](02-core-concepts.md)
- Learn the full API surface: [API Reference](08-api-reference.md)
- See the most powerful feature in depth: **[Cycle Feature](14-cycle-feature.md)**
- Browse runnable recipes: [Examples](09-examples.md)
