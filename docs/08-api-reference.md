# API Reference

Complete public API of the `ws-events-handler` package, derived directly from the source
files `WebSocketEventsHandler.js` and `NetworkQualityMonitor.js`.

## Table of Contents

- [`WebSocketEventsHandler`](#class-websocketeventshandler)
  - [Constructor](#constructor)
  - [Configuration Schema](#configuration-schema)
  - [Methods](#methods)
  - [Properties](#properties)
  - [Special Events](#special-events)
- [`NetworkQualityMonitor`](#class-networkqualitymonitor)
- [Default Values Table](#default-values-table)
- [Cycle Reference](#cycle-reference)

---

## Class: `WebSocketEventsHandler`

```javascript
const WebSocketEventsHandler = require('ws-events-handler');
```

The default export. Manages a single WebSocket connection.

### Constructor

```typescript
new WebSocketEventsHandler(wsUrl: string, config?: Config)
```

| Param   | Type     | Required | Description                                  |
| ------- | -------- | -------- | -------------------------------------------- |
| `wsUrl` | `string` | yes      | The `ws://` or `wss://` URL to connect to.   |
| `config`| `Config` | no       | See [Configuration Schema](#configuration-schema). |

Side effects on construction:

1. Sets up network listeners (browser `online`/`offline`, or Node `NetworkQualityMonitor`).
2. Immediately calls `#connect()`.
3. Internally registers a `'mounted'` handler.

> **Note:** Construction is synchronous; the connection itself is not. Listen for the
> `'mounted'` event (sent by your server) to know when the session is ready.

### Configuration Schema

```typescript
type Config = {
  heartbeat?: {
    interval?: number;              // default 15000 ms
    message?: any;                  // default "ping"   (JSON-stringified before send)
    expectedResponse?: any;         // default "pong"
    timeout?: number;               // default 10000 ms
  };
  connection?: {
    retryCount?: number;            // default 0     (starting attempt counter)
    maxRetries?: number;            // default 5
    retryDelay?: number;            // default 1000 ms (base for exponential backoff)
    fallback?: {
      localEvents?: boolean;        // default false
      localEventsDelay?: number;    // default 1000 ms (replay rate)
    };
  };
  debug?: boolean;                  // default false
};
```

> **Important:** if you omit the `heartbeat` key entirely, the heartbeat is **disabled**
> (`#useHeartbeat = false`). Passing `heartbeat: {}` enables it with all defaults.

### Methods

#### `on(eventName, config)`

Register or replace a handler.

```typescript
ws.on(eventName: string, config: HandlerConfig | Function): void
```

`HandlerConfig`:

```typescript
type HandlerConfig = {
  callback?: (payload: any) => void | Promise<void>;
  ack?: {
    event?: string;             // defaults to `${eventName}-ack`
    originalEvent?: boolean;    // include original payload in ack body
  };
  cycle?: CycleConfig;          // see "Cycle Reference" below
};
```

If you pass a **bare function**, it is stored as-is in `handler.config`; the library
will call it directly with the payload (legacy form). Prefer the object form.

#### `off(eventName)`

Soft-disable a handler. The record stays in the registry but `off = true`, so incoming
messages for that event are dropped. Re-enable by calling `on()` again.

```typescript
ws.off(eventName: string): void
```

#### `send(eventName, payload)`

Send an event over the wire (or buffer it if offline & `fallback.localEvents` is true).

```typescript
ws.send(eventName: string, payload: any): void
```

Outgoing frame shape:

```javascript
[
  eventName,
  { when: Date.now(), id?: <client-id>, payload }
]
```

#### `destroy(reason)`

Gracefully tear down the connection, listeners, intervals, and (in Node) the
`NetworkQualityMonitor`. Logs `'WebSocket destroyed.'` with the reason.

```typescript
ws.destroy(reason?: string): void
```

After `destroy()`, the instance is **not reusable**. Create a new one to reconnect.

### Properties

#### `onerror` (writable)

A user-settable error hook. When set, the internal `#onError` delegates to it instead of
logging.

```javascript
ws.onerror = (err) => { /* report to Sentry, etc. */ };
```

Default: `false` (falsy ⇒ internal logging path is used).

### Special Events

| Event name | Direction | Payload                  | Notes                                               |
| ---------- | --------- | ------------------------ | --------------------------------------------------- |
| `mounted`  | inbound   | `{ id: string }`         | Stores the assigned client id and `mountTime`.      |
| `ping` /   | outbound  | `"ping"` (JSON string)   | Sent by the heartbeat loop.                         |
| `pong`     | inbound   | `"pong"` (JSON string)   | Intercepted before dispatch, clears timeout.        |
| `<x>-ack`  | outbound  | `{ when, id?, ...payload? }` | Auto-sent for handlers with an `ack` config.     |

---

## Class: `NetworkQualityMonitor`

```javascript
const NetworkQualityMonitor = require('ws-events-handler/NetworkQualityMonitor');
```

Lightweight `EventEmitter` that periodically probes an HTTPS URL to detect connectivity
and latency. Used internally on Node when `window` is not available; you can also use it
standalone.

### Constructor

```typescript
new NetworkQualityMonitor(url?: string, interval?: number)
```

| Param     | Type     | Default                      | Description                |
| --------- | -------- | ---------------------------- | -------------------------- |
| `url`     | `string` | `'https://www.google.com'`   | URL probed via `https.get`. |
| `interval`| `number` | `5000`                       | ms between probes.         |

Construction immediately starts monitoring (calls `startMonitoring()`).

### Methods

| Method                  | Description                                                |
| ----------------------- | ---------------------------------------------------------- |
| `startMonitoring()`     | Begin the `setInterval` probe loop.                        |
| `stopMonitoring()`      | Clear the probe interval.                                  |
| `checkNetworkQuality()` | Run a single probe immediately.                            |

### Emitted Events

| Event     | Args                  | Fired when                                             |
| --------- | --------------------- | ------------------------------------------------------ |
| `online`  | (none)                | Edge transition from offline ⇒ online (HTTP 200).      |
| `offline` | (none)                | Edge transition from online ⇒ offline (non-200/error). |
| `quality` | `{ latency: number }` | Every successful probe while online.                   |

### Properties

| Property     | Type      | Description                                  |
| ------------ | --------- | -------------------------------------------- |
| `url`        | `string`  | The URL being probed.                        |
| `interval`   | `number`  | Probe interval in ms.                        |
| `isOnline`   | `boolean` | Cached connectivity state.                   |
| `latency`    | `number`  | Last measured latency in ms (null if never).  |

---

## Default Values Table

| Setting                              | Default                | Source line(s) in `WebSocketEventsHandler.js` |
| ------------------------------------ | ---------------------- | --------------------------------------------- |
| `connectionRetryCount`               | `0`                    | private field                                 |
| `connectionMaxRetries`               | `5`                    | private field                                 |
| `connectionRetryDelay`               | `1000` ms              | private field                                 |
| `useHeartbeat`                       | `true` (disabled if `heartbeat` key absent) | constructor               |
| `heartbeatInterval`                  | `15000` ms             | private field                                 |
| `heartbeatTimeout`                   | `10000` ms             | private field                                 |
| `heartbeatMessage`                   | `"ping"`               | private field                                 |
| `heartbeatExpectedResponse`          | `"pong"`               | private field                                 |
| `useLocalEvents`                     | `false`                | private field                                 |
| `localEventsDelay`                   | `1000` ms              | private field                                 |
| `debugMode`                          | `false`                | private field                                 |
| `onerror`                            | `false`                | public field                                  |
| `NetworkQualityMonitor.url`          | `'https://www.google.com'` | NQM constructor                          |
| `NetworkQualityMonitor.interval`     | `5000` ms              | NQM constructor                               |

---

## Cycle Reference

The `cycle` sub-config controls batched callbacks. Documented in depth, with state
diagram and edge cases, in **[docs/14-cycle-feature.md](14-cycle-feature.md)**.

Quick reference:

```typescript
type CycleConfig = {
  every: number;             // required: batch size
  rounds?: number;           // optional: number of cycles before self-destruct
  once?: boolean;            // optional: alias for rounds=1
  exclusive?: boolean;       // optional: suppress per-message callback
  callback?: (batch: any[]) => void;  // defaults to handler.config.callback
};
```

See **[Cycle Feature](14-cycle-feature.md)** for the full annotated walkthrough.
