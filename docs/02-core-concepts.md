# Core Concepts

## Event-Driven Architecture

WS-Events is built on an event-driven architecture using an internal `Map`-based handler registry for **O(1) lookup** complexity.

The event flow follows this path:

```
WebSocket → parse JSON → route to handler → process (cycle/ack/callback)
```

## Event Structure

Events are transmitted over the wire as **JSON arrays** in the following format:

```javascript
["eventName", {
  when: 1712345678901,      // Unix timestamp (ms)
  id: "client-uuid",         // Optional: client identifier (assigned after 'mounted' event)
  payload: { /* data */ }    // The actual event data
}]
```

This array format is used consistently for both incoming and outgoing events.

### The `mounted` Event

When a connection is established, the server should send a `mounted` event containing a client `id`. This ID is stored internally and included in all subsequent outgoing events.

## Handler Registry

The internal `#handlers` Map stores entries keyed by event name (string). Each handler entry contains:

| Field | Description |
|-------|-------------|
| `eventName` | The event name this handler listens for |
| `config` | The configuration object (callback, cycle, ack) |
| `registeredOn` | Timestamp of when the handler was registered |
| `off` | Boolean flag indicating if the handler is deactivated |
| `tracking` | Runtime tracking data (e.g., `lastTrigger`) |

## Connection Management

### Automatic Reconnection

When a connection drops, the library automatically retries using **exponential backoff**:

```
delay = retryDelay × 2^(attempt - 1)
```

| Attempt | Delay |
|---------|-------|
| 1 | 1,000 ms |
| 2 | 2,000 ms |
| 3 | 4,000 ms |
| 4 | 8,000 ms |
| 5 | 16,000 ms |

### Heartbeat

A keep-alive mechanism that sends a message (default: `"ping"`) at a configured interval. If the expected response (default: `"pong"`) is not received within the timeout window, the connection is closed and reconnection begins.

### Network Detection

- **Browser**: Listens to `window` `online`/`offline` events and checks `navigator.onLine`.
- **Node.js**: Uses a `NetworkQualityMonitor` that polls an HTTPS endpoint (default: `https://www.google.com`) every 5 seconds.

## Cycle Feature

The cycle system allows **batch-processing** of events. Instead of invoking the callback on every message, it accumulates N payloads and invokes a batch callback. Key features:

- **`every`**: Number of messages to collect per cycle
- **`rounds`**: Number of cycles to complete before self-destruction
- **`once`**: Shorthand for a single cycle (`rounds: 1`)
- **`exclusive`**: If `true`, only the cycle callback runs (root callback is skipped)
- **Auto-destruction**: After completing all rounds, the cycle configuration is set to `null`

### Internal Cycle Tracking

Each cycle maintains three internal fields:

- `internalMessageCount`: Messages received in the current cycle
- `internalCyclePayloads`: Accumulator array of payloads
- `internalRoundCount`: Number of completed cycles

## Acknowledgement (ACK)

When a handler has an `ack` configuration, the library automatically sends an acknowledgement event back to the server upon receiving a matching event. The ACK payload includes:

```javascript
{
  when: Date.now(),
  id: "client-id",           // If mounted
  ...originalPayload         // If originalEvent: true
}
```

## Local Events (Offline Storage)

When `connection.fallback.localEvents` is enabled, events sent while offline are queued in an internal array (`#localEvents`). On reconnection, they are dispatched either:

- **With delay**: One event per `localEventsDelay` interval (default: 1000ms)
- **Without delay**: All events sent immediately in reverse order

## See Also

- [Event Handling](03-event-handling.md) — Detailed event flow
- [Handlers](04-handlers.md) — Handler configuration and lifecycle
- [Connections](06-connections.md) — Connection lifecycle details