# Core Concepts

## Architecture Overview

The WS-Events library is built around a **WebSocketEventsHandler** class that wraps a native WebSocket connection and provides:

1. **Event-driven message handling** — Incoming messages are parsed and routed to registered handlers by event name
2. **Connection lifecycle management** — Connect, disconnect, exponential-backoff reconnect
3. **Heartbeat / keep-alive** — Periodic ping/pong to detect stale connections
4. **Offline resilience** — Queue events locally when offline and dispatch on reconnect
5. **Network detection** — Browser `navigator.onLine` or `NetworkQualityMonitor` for Node.js

## Message Format

All messages use a compact array format:

```javascript
// Send
['eventName', { when: 1234567890, id: 'client-id', payload: { ... } }]

// Receive
['eventName', { payload: { ... } }]
```

## Handler Registry

The library uses a `Map<string, HandlerConfig>` internally (`#handlers`). Each handler stores:

```javascript
{
  eventName: 'string',
  config: Function | { callback, cycle, ack },
  registeredOn: timestamp,
  off: boolean,
  tracking: { lastTrigger: timestamp }
}
```

## Connection Lifecycle

1. `constructor()` → connects
2. `open` → start heartbeat, dispatch local events
3. `message` → parse JSON, route to handler
4. `close` → retry with exponential backoff or destroy
5. `error` → `onerror` callback or console.error

## Network Detection

- **Browser**: Uses `window` `online`/`offline` events + `navigator.onLine` check
- **Node.js**: Uses `NetworkQualityMonitor` which pings a URL periodically and emits `online`/`offline` events