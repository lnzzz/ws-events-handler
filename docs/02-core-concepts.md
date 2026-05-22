# Core Concepts

This document explains the architecture and runtime behavior of `ws-events-handler` as
implemented in `WebSocketEventsHandler.js`. It is intentionally low-level so you can reason
about edge cases.

## Table of Contents

- [The Wire Format](#the-wire-format)
- [Handler Registry](#handler-registry)
- [Connection Lifecycle](#connection-lifecycle)
- [Heartbeat Loop](#heartbeat-loop)
- [Retry & Exponential Backoff](#retry--exponential-backoff)
- [Offline Buffer](#offline-buffer)
- [Network Detection](#network-detection)
- [See Also](#see-also)

---

## The Wire Format

Every message — incoming or outgoing — is a JSON-serialized **array** with two elements:

```
[ <eventName: string>, <payload: any> ]
```

For outbound messages, `send()` wraps the user payload into an envelope object:

```javascript
[
  'chat:message',
  {
    when: 1717420000000,   // Date.now() at send time
    id: 'client-42',       // only present after `mounted` event arrives
    payload: { text: 'hi' }
  }
]
```

For inbound messages, the library splits on the array boundary:

```javascript
const [eventName, payload] = Array.isArray(data) ? data : [data];
```

> **Special case:** if the parsed JSON is *exactly* equal to the configured
> `heartbeat.expectedResponse` (default `"pong"`), it is intercepted **before** routing,
> clears the heartbeat timeout, and is **never** dispatched to a handler.

## Handler Registry

Handlers are stored in a private `Map<string, HandlerRecord>`. Each `HandlerRecord` has:

```javascript
{
  eventName: 'chat:message',
  config: { callback, ack?, cycle? },
  registeredOn: 1717420000000,    // first-ever registration timestamp
  off: false,                      // soft-disable flag (see ws.off())
  tracking: { lastTrigger: ... }   // populated when the handler fires
}
```

Why a `Map`?

- **O(1)** lookup and update (vs. O(n) for the old array-based implementation).
- Predictable insertion order if iterated.
- A handler registered twice for the same event **replaces** the previous one but
  preserves `registeredOn` (so analytics-style metrics survive re-registration).

## Connection Lifecycle

```
                         construct
                            │
                            ▼
              ┌──────────────────────────┐
              │ #setupNetworkListeners() │   (browser: window online/offline;
              └──────────────────────────┘    node: NetworkQualityMonitor)
                            │
                            ▼
                       #connect()
                            │
            ┌──────────────────────────────┐
            │ pick WebSocket impl          │
            │ (global WebSocket or ws lib) │
            └──────────────────────────────┘
                            │
                            ▼
         ┌─────────┬────────┴─────────┬──────────┐
         ▼         ▼                  ▼          ▼
       onOpen   onMessage          onClose     onError
         │         │                  │          │
   start HB    parse + route     retry or     onerror()
   replay LE   to handler        destroy       hook
```

The library always registers a `'mounted'` handler internally (`this.on('mounted', …)`),
so a server that wants to give the client a stable ID should send:

```json
["mounted", { "id": "<connection-id>" }]
```

The client stores `#id` and uses it in every outgoing envelope.

## Heartbeat Loop

Enabled by passing a truthy `heartbeat` object.

```
every interval ms:
    if ws.readyState === 1 (OPEN):
        ws.send(JSON.stringify(heartbeat.message))   // default "ping"
        start timer (heartbeat.timeout):
            on tick:  ws.close()       ──► triggers onClose ──► retry
        on expectedResponse received:  clearTimeout(timer)
```

```
┌─ Client ─┐                      ┌─ Server ─┐
│          │ ── "ping" ─────────► │          │
│   (start │                      │  (send   │
│    timer)│ ◄──── "pong" ─────── │   pong)  │
│  cancel  │                      │          │
└──────────┘                      └──────────┘
```

If the server never replies, the timeout fires, the socket is forcibly closed,
`#onClose` runs, and the connection enters the retry loop.

## Retry & Exponential Backoff

Formula in `#retryConnection()`:

```javascript
retryIn = connectionRetryDelay * 2 ** (connectionRetryCount - 1)
```

With defaults (`retryDelay=1000`, `maxRetries=5`):

| Attempt | Delay (ms) |
| ------- | ---------- |
| 1       | 1000       |
| 2       | 2000       |
| 3       | 4000       |
| 4       | 8000       |
| 5       | 16000      |

After `maxRetries`, the library logs `Max retry attempts reached.` and calls
`destroy('Max retry attempts reached.')`.

> The retry counter is **not** reset on a successful reconnect in the current source
> code. If you need that behavior, you can override `connection.retryCount` back to 0 by
> re-constructing the instance, or treat the warning as a hint to do so.

## Offline Buffer

When `connection.fallback.localEvents` is `true`:

1. While `navigator.onLine === false`, `send()` pushes the wrapped envelope into a private
   `#localEvents` array instead of sending it on the wire.
2. On the next `open` event, if there is a `localEventsDelay`, the library starts a
   `setInterval` that re-sends one event per tick (FIFO order) and clears the interval
   when the buffer is empty.
3. If `localEventsDelay` is `0`/falsy, the events are flushed in a tight loop (LIFO order
   in the current source — see [Troubleshooting](13-troubleshooting.md)).

## Network Detection

The library uses different mechanisms depending on the runtime:

- **Browser** (`typeof window !== 'undefined'`):
  Listens to `window.addEventListener('online' | 'offline')`.
- **Node** (no `window`):
  Lazily requires `./NetworkQualityMonitor.js`, which periodically GETs an HTTPS URL
  (default `https://www.google.com`, every 5s) and emits `online` / `offline` / `quality`
  events on the EventEmitter API.

Both paths funnel into the same `#handleOnline` / `#handleOffline` bound handlers, so the
rest of the code is environment-agnostic.

## See Also

- [Event Handling](03-event-handling.md) — message routing details.
- [Handlers](04-handlers.md) — handler config object shape.
- **[Cycle Feature](14-cycle-feature.md)** — how the cycle config alters routing.
- [Connections](06-connections.md) — deep-dive on retry & offline.
