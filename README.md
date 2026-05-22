# WS-Events

> Event handler system for managing WebSocket-based event processing and communication.

`ws-events-handler` is a small, dependency-light library that wraps a raw WebSocket connection
with a friendlier event-bus style API. It works in both **the browser** (native `WebSocket`) and
**Node.js** (using the [`ws`](https://www.npmjs.com/package/ws) package), and ships with:

- Automatic reconnection with **exponential backoff**.
- Configurable **heartbeat** (ping / pong).
- A first-class **handler registry** (`on` / `off` / `send` / `destroy`).
- A unique **Cycle feature** that batches incoming events and fires a callback every *N* messages,
  for *M* rounds, optionally suppressing the per-message callback.
- **ACK** support for round-tripping confirmation messages.
- **Offline buffering** of outbound events using `navigator.onLine`, with ordered replay on reconnect.
- A built-in **`NetworkQualityMonitor`** for Node environments (HTTP probe + latency emit).
- A `debug` mode that mirrors the internal state to `console`.

---

## Table of Contents

- [Getting Started](docs/01-getting-started.md)
- [Core Concepts](docs/02-core-concepts.md)
- [Event Handling](docs/03-event-handling.md)
- [Handlers](docs/04-handlers.md)
- [Middleware](docs/05-middleware.md)
- [Connections](docs/06-connections.md)
- [Error Handling](docs/07-error-handling.md)
- [API Reference](docs/08-api-reference.md)
- [Examples](docs/09-examples.md)
- [Testing](docs/10-testing.md)
- [Advanced Topics](docs/11-advanced-topics.md)
- [Deployment](docs/12-deployment.md)
- [Troubleshooting](docs/13-troubleshooting.md)
- **[Cycle Feature (deep dive)](docs/14-cycle-feature.md)** ← required reading
- [Contributing](docs/CONTRIBUTING.md)

---

## Installation

```bash
npm install ws-events-handler
# or
yarn add ws-events-handler
```

> **Note:** In Node, `ws-events-handler` depends on the [`ws`](https://www.npmjs.com/package/ws) package,
> which is installed automatically as a transitive dependency.

---

## Quick Start

```javascript
const WebSocketEventsHandler = require('ws-events-handler');

const ws = new WebSocketEventsHandler('ws://localhost:8080', {
  heartbeat: {
    interval: 15000,          // send "ping" every 15s
    message: 'ping',
    expectedResponse: 'pong',
    timeout: 10000            // close + reconnect if no "pong" in 10s
  },
  connection: {
    maxRetries: 5,
    retryDelay: 1000,         // 1s, 2s, 4s, 8s, 16s (exponential backoff)
    fallback: {
      localEvents: true,      // buffer outbound events while offline
      localEventsDelay: 500   // replay one event every 500ms after reconnect
    }
  },
  debug: true
});

// Register a handler (config is an object, not a bare function)
ws.on('greet', {
  callback: (data) => console.log('greet received:', data)
});

// Send an event (server receives ["greet", { when, payload }])
ws.send('greet', { hello: 'world' });

// Tear everything down
// ws.destroy('shutdown');
```

---

## Features at a Glance

| Feature                   | Where                                                                 |
| ------------------------- | --------------------------------------------------------------------- |
| Automatic reconnection    | [Connections](docs/06-connections.md)                                 |
| Heartbeat ping/pong       | [Connections](docs/06-connections.md) · [API](docs/08-api-reference.md) |
| `on` / `off` / `send`     | [Event Handling](docs/03-event-handling.md) · [Handlers](docs/04-handlers.md) |
| **Cycle batching**        | **[Cycle Feature](docs/14-cycle-feature.md)**                         |
| ACK messages              | [Event Handling](docs/03-event-handling.md)                           |
| Offline buffering         | [Connections](docs/06-connections.md)                                 |
| Network quality monitor   | [API Reference](docs/08-api-reference.md)                             |
| Debug logging             | [API Reference](docs/08-api-reference.md)                             |

---

## The Cycle Feature (in 30 seconds)

The **Cycle feature** lets a handler accumulate `every: N` payloads and then invoke a batch
callback. It can run a fixed number of `rounds`, only `once`, and optionally `exclusive`ly
(suppressing the per-message callback). On the final round it self-destructs by setting
`handler.config.cycle = null`.

```javascript
ws.on('metric:tick', {
  callback: (p) => console.log('tick', p),    // runs every message (unless exclusive)
  cycle: {
    every: 10,
    rounds: 3,
    exclusive: false,
    callback: (batch) => console.log('batch of', batch.length, 'ticks')
  }
});
```

This is documented in depth (with state diagram, edge cases, and 5+ examples) in
**[docs/14-cycle-feature.md](docs/14-cycle-feature.md)**.

---

## License

ISC — see [`package.json`](./package.json).
