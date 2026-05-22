# Connection Management

This document explains how `ws-events-handler` opens, maintains, retries, and tears down
WebSocket connections, including its dual-environment design (browser + Node).

## Table of Contents

- [Environment Detection](#environment-detection)
- [NetworkQualityMonitor (Node)](#networkqualitymonitor-node)
- [Lifecycle States](#lifecycle-states)
- [Retry & Exponential Backoff](#retry--exponential-backoff)
- [Offline Buffering & Replay](#offline-buffering--replay)
- [`destroy()` Teardown](#destroy-teardown)
- [Reconnect Flow Diagram](#reconnect-flow-diagram)

---

## Environment Detection

`#setupNetworkListeners()` runs once in the constructor:

```javascript
if (typeof window !== 'undefined') {
  window.addEventListener('online',  this.#boundHandleOnline);
  window.addEventListener('offline', this.#boundHandleOffline);
} else {
  const NQM = require('./NetworkQualityMonitor.js');
  this.#nqm = new NQM();
  this.#nqm.on('online',  this.#boundHandleOnline);
  this.#nqm.on('offline', this.#boundHandleOffline);
}
```

`#connect()` picks the WebSocket implementation:

```javascript
if (typeof WebSocket !== 'undefined') {
  this.#ws = new WebSocket(this.#wsUrl);          // browser / Bun / Deno
} else {
  const { WebSocket } = require('ws');             // Node fallback
  this.#ws = new WebSocket(this.#wsUrl);
}
```

In Node 22+ where a global `WebSocket` exists, the global is used and `ws` is **not**
required at runtime.

## NetworkQualityMonitor (Node)

The bundled `NetworkQualityMonitor.js` is a small `EventEmitter`:

```javascript
const NQM = require('ws-events-handler/NetworkQualityMonitor');

const m = new NQM('https://www.google.com', 5000);
m.on('online',  () => console.log('came back'));
m.on('offline', () => console.log('lost connectivity'));
m.on('quality', ({ latency }) => console.log('latency', latency));

// later:
m.stopMonitoring();
```

Behavior (every `interval` ms):

1. `https.get(url)` and measure response time.
2. If `statusCode === 200` ⇒ considered online; otherwise offline.
3. Emit `'online'` or `'offline'` **only on edge transitions** (state change).
4. While online, emit `'quality'` with `{ latency }` every check.
5. A network error (DNS, ECONNRESET, …) is treated as offline.

> **Heads up:** the default probe URL is `https://www.google.com`. In corporate networks
> that block it, the monitor will incorrectly report offline. Pass your own URL — ideally
> a small, fast endpoint you control. See
> [Troubleshooting](13-troubleshooting.md#nqm-false-offline).

## Lifecycle States

Mirrors the W3C `WebSocket.readyState`:

| Value | State        | Meaning                                  |
| ----- | ------------ | ---------------------------------------- |
| 0     | `CONNECTING` | TCP/TLS/handshake in flight              |
| 1     | `OPEN`       | Ready to send/receive                    |
| 2     | `CLOSING`    | `close()` called, draining               |
| 3     | `CLOSED`     | Fully closed                             |

The library only sends when `readyState === 1`, only closes when `readyState < 2`, and
re-opens via `#retryConnection` on `close`.

## Retry & Exponential Backoff

```javascript
retryIn = retryDelay * 2 ** (retryCount - 1)
```

Defaults: `retryDelay = 1000ms`, `maxRetries = 5`.

| Attempt | Delay |
| ------- | ----- |
| 1       | 1s    |
| 2       | 2s    |
| 3       | 4s    |
| 4       | 8s    |
| 5       | 16s   |

After attempt 5 the library calls `destroy('Max retry attempts reached.')`. To start
fresh you must construct a new instance.

> The retry counter does **not** auto-reset on a successful reconnect in the current
> source code. If your deployment expects long-lived clients that survive many outages,
> consider tearing down + re-creating the instance on `'online'` rather than relying on
> the internal counter.

## Offline Buffering & Replay

Enabled by `connection.fallback.localEvents: true`.

```javascript
send(eventName, payload) {
  const message = [eventName, { when: Date.now(), id, payload }];

  if (typeof navigator !== 'undefined' && !navigator.onLine && this.#useLocalEvents) {
    this.#localEvents.push(message);     // buffer
    return;
  }

  this.#ws.send(JSON.stringify(message));
}
```

> **Important:** the offline check uses `navigator.onLine`, which is only meaningful in
> the **browser**. In Node, `navigator` is undefined (older versions) or always reports
> online (newer versions), so the buffer is effectively a browser-only safety net.

On the next `open`:

- If `localEventsDelay > 0`, a `setInterval` flushes one event every `localEventsDelay`
  ms, in **FIFO** order (oldest first), then clears itself.
- If `localEventsDelay` is `0` / undefined, the buffer is flushed in a single tight loop
  (in the current source, that loop iterates from the **end** of the array; see
  [Troubleshooting](13-troubleshooting.md) if order matters to you).

## `destroy()` Teardown

`destroy(reason)` is the only graceful way to close a client.

```javascript
ws.destroy('shutting down');
```

It performs:

1. Removes `online` / `offline` listeners from `window` (browser).
2. Detaches `online` / `offline` listeners from the `NetworkQualityMonitor` (Node).
3. Removes `message` / `open` / `close` / `error` listeners from `this.#ws`.
4. Stops the heartbeat interval and clears its timeout.
5. Calls `this.#ws.close()` if `readyState < 2`.
6. Clears the local-events dispatch interval.
7. Calls `this.#nqm.stopMonitoring()` (Node).
8. Logs `'WebSocket destroyed.'` with the reason.

After `destroy()` the instance is unusable — make a new one to reconnect.

## Reconnect Flow Diagram

```
┌──────────────┐
│  OPEN state  │
└──────┬───────┘
       │ network drop / heartbeat timeout / server close
       ▼
┌──────────────┐
│   onClose    │
└──────┬───────┘
       │
       │ retryCount < maxRetries?
       ├──── no ───► destroy('Max retry attempts reached.')
       │
       ▼ yes
┌──────────────────────────────┐
│ #retryConnection()           │
│   retryCount++               │
│   setTimeout(retryIn) ───────┼──► #connect()  ──► onOpen ──► flush #localEvents
└──────────────────────────────┘
```

Online/offline transitions short-circuit the retry timer:

- `online` event ⇒ immediately calls `#connect()`.
- `offline` event ⇒ closes the current socket and clears the local-events interval; the
  next `online` will trigger reconnection.

---

See also: [Core Concepts](02-core-concepts.md), [API Reference](08-api-reference.md),
[Troubleshooting](13-troubleshooting.md).
