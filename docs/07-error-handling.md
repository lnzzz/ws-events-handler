# Error Handling

This document catalogs every error surface in `ws-events-handler` (as implemented today),
their default behavior, and the recommended patterns for handling them in your
application.

## Table of Contents

- [Error Sources](#error-sources)
- [The `onerror` Override](#the-onerror-override)
- [Heartbeat Timeout](#heartbeat-timeout)
- [Permanent Close (Max Retries)](#permanent-close-max-retries)
- [Callback Errors](#callback-errors)
- [Parse Errors](#parse-errors)
- [User-Land Dead-Letter Queue](#user-land-dead-letter-queue)
- [Best Practices](#best-practices)

---

## Error Sources

| Source                       | Default behavior                                                 |
| ---------------------------- | ---------------------------------------------------------------- |
| WebSocket `error` event      | Calls `ws.onerror(err)` if set, otherwise logs `'WebSocket Error:'` (debug only). |
| JSON parse error in inbound  | Silently dropped + `console.warn('Failed to parse message data.')` (debug only). |
| Heartbeat timeout            | `ws.close()` ⇒ `onClose` ⇒ retry / destroy.                       |
| Unknown event name           | `console.warn("Handler not found for event '<name>'")` (debug only). Message dropped. |
| Handler `callback` throw     | Propagates up through `#onEvent` (no internal try/catch).        |
| `cycle.callback` throw       | Same as above.                                                   |
| Max retries reached          | Calls `destroy('Max retry attempts reached.')`.                  |

## The `onerror` Override

The class exposes a public mutable property:

```javascript
ws.onerror = (err) => {
  Sentry.captureException(err);
  metrics.increment('ws.error');
};
```

When set, the library's internal `#onError` delegates to it **instead of** logging:

```javascript
#onError = (error) => {
  if (this.onerror) return this.onerror(error);
  this.#log('error', 'WebSocket Error:', error);
}
```

Set it **before** the first error fires (i.e. as soon as possible after construction).

## Heartbeat Timeout

When `heartbeat` is configured and a `ping` is sent without a matching
`expectedResponse` arriving within `heartbeat.timeout` ms, the library:

1. Logs `'No heartbeat expected response, reconnecting...'`.
2. Calls `this.#ws.close()`.
3. `#onClose` fires ⇒ `#retryConnection()` schedules a reconnect with exponential backoff.

```
   send ping ─────────────► (no pong) ───── timeout(ms) ────►  ws.close()
                                                                   │
                                                                   ▼
                                                              #onClose ─► retry
```

If you want to react to repeated heartbeat failures (e.g. notify the user), watch for
the `ws.onerror` callback or instrument your own counter from outside:

```javascript
let timeouts = 0;
const wsBase = new WebSocketEventsHandler(url, { heartbeat: {...} });
const origLog = console.warn;
// (in production prefer wrapping the prototype or contributing a hook upstream)
```

## Permanent Close (Max Retries)

After `connectionRetryCount === connectionMaxRetries`, `#onClose` calls:

```javascript
this.destroy('Max retry attempts reached.');
```

The instance is now unusable. There is **no auto-recovery** beyond this point. Typical
patterns:

- Show a UI banner and let the user click "Reconnect" ⇒ construct a new instance.
- In Node, exit the process and let your supervisor (pm2 / systemd / k8s) restart you.

```javascript
ws.onerror = () => {/* ignore individual ws errors */};

// pseudo-supervisor loop:
function start() {
  const inst = new WebSocketEventsHandler(url, cfg);
  inst.on('mounted', () => { /* fresh start */ });
  // detect destroy via a sentinel event:
  const origDestroy = inst.destroy.bind(inst);
  inst.destroy = (reason) => {
    origDestroy(reason);
    if (reason === 'Max retry attempts reached.') {
      setTimeout(start, 30_000);   // cool down before another full retry cycle
    }
  };
}
start();
```

## Callback Errors

The library calls `config.callback(payload)` and `cycle.callback(batch)` **without** a
try/catch. A thrown error bubbles up the call stack of `#onEvent`, and since `#onEvent`
is itself invoked from the `message` event listener, the exception lands as an
unhandled rejection / uncaught exception depending on whether your callback is async.

**Always wrap your callbacks**:

```javascript
ws.on('x', {
  callback: async (p) => {
    try {
      await doWork(p);
    } catch (e) {
      ws.send('error', { source: 'x', message: e.message, when: Date.now() });
    }
  }
});
```

Or use a `compose(safe, ...)` middleware as shown in
[docs/05-middleware.md](05-middleware.md).

## Parse Errors

`#onMessage` wraps `JSON.parse(event.data)` in a `try/catch`. On failure it logs a
warning (only visible with `debug: true`) and **returns silently**. The bad frame is
gone — there is no retry, no dead-letter, no callback invocation.

If you need to capture malformed frames, monkey-patch your WebSocket polyfill or attach
a separate raw listener before construction.

## User-Land Dead-Letter Queue

There is no built-in DLQ. You can emulate one easily on top of the public API:

```javascript
const dlq = [];

ws.on('important', {
  callback: async (p) => {
    try { await persist(p); }
    catch (e) {
      dlq.push({ payload: p, error: e.message, when: Date.now() });
      // periodically retry the DLQ:
      setTimeout(retryDlq, 5000);
    }
  }
});

function retryDlq() {
  while (dlq.length) {
    const item = dlq.shift();
    persist(item.payload).catch(() => dlq.push(item));
  }
}
```

For an offline-aware variant, mirror the `#localEvents` pattern (an array drained by an
interval on reconnect) — see [Connections](06-connections.md#offline-buffering--replay).

## Best Practices

1. **Set `ws.onerror` immediately** after construction, before any I/O can occur.
2. **Always wrap callback bodies** in try/catch; the library does not.
3. **Treat `destroy('Max retry attempts reached.')` as a fatal**, supervisor-restart
   condition.
4. **Validate payloads** at the boundary (use the middleware pattern). The wire is a
   trust boundary.
5. **Don't silently drop unknown events** in production: register a catch-all by
   convention (e.g. server only sends well-known names) and instrument the `'Handler not
   found'` warning.
6. **Avoid heavy work inside callbacks** — long synchronous work will stall the
   heartbeat and cause spurious reconnects.

---

See also: **[Cycle Feature](14-cycle-feature.md)** (cycle.callback throws),
[Connections](06-connections.md), [Troubleshooting](13-troubleshooting.md).
