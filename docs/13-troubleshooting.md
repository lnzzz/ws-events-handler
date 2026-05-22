# Troubleshooting

Concrete issues you may hit when integrating `ws-events-handler`, with symptoms,
diagnosis steps, and fixes. Each entry references the real source code line / behavior.

## Table of Contents

1. [`Handler not found for event 'X'`](#1-handler-not-found-for-event-x)
2. [`Failed to parse message data.`](#2-failed-to-parse-message-data)
3. [Infinite reconnect loop](#3-infinite-reconnect-loop)
4. [Cycle callback never fires](#4-cycle-callback-never-fires)
5. [Local events not replayed on reconnect](#5-local-events-not-replayed-on-reconnect)
6. [Heartbeat times out repeatedly](#6-heartbeat-times-out-repeatedly)
7. [`navigator is not defined` in Node](#7-navigator-is-not-defined-in-node)
8. [`WebSocket is not defined` in Node](#8-websocket-is-not-defined-in-node)
9. [<a id="nqm-false-offline"></a>NetworkQualityMonitor reports offline incorrectly](#9-networkqualitymonitor-reports-offline-incorrectly)
10. [`destroy()` called but a reconnect still fires](#10-destroy-called-but-a-reconnect-still-fires)
11. [ACK loop (server replies to ack, triggers ack again)](#11-ack-loop)
12. [`ws.onerror` not called](#12-wsonerror-not-called)

---

## 1. `Handler not found for event 'X'`

**Symptom:** debug log warns `Handler not found for event 'X'` and the message is dropped.

**Cause:** The server sent an event you never registered for.

**Fix:**

```javascript
ws.on('X', { callback: (p) => { /* ... */ } });
```

Or, if the server-side event name is dynamic, register a catch-all by convention
(prefix-based dispatch is your responsibility — the library only matches exact strings).

## 2. `Failed to parse message data.`

**Symptom:** debug log warns about parse failure; the frame is silently dropped.

**Cause:** The server sent a non-JSON frame (binary, malformed string, …).

**Fix:** Make sure your server always `JSON.stringify`s outbound frames. The library
expects every text frame to be JSON.

If you genuinely need to handle binary frames, you'll need to monkey-patch the
underlying WebSocket — the library has no binary path.

## 3. Infinite reconnect loop

**Symptom:** Every retry attempt fails; logs cycle through `Retrying connection in N
seconds`.

**Causes & fixes:**

- **Wrong URL / DNS:** double-check `ws://host:port/path`.
- **TLS handshake fails:** if using `wss://` with a self-signed cert, the connection
  cannot be established. Either install the cert or disable verification (dev only).
- **`maxRetries` too high:** the library only stops after `maxRetries` attempts. With
  e.g. `maxRetries: 1000`, you will retry for hours. Lower it.
- **Heartbeat misconfigured:** if `interval` < proxy idle timeout but the proxy still
  closes you, every reconnect immediately re-times-out. See issue 6.

## 4. Cycle callback never fires

**Symptom:** You registered `cycle: { every: N, callback }` and the callback never
runs.

**Causes & fixes:**

- **`every` is larger than the number of messages received** — you only have 7 messages
  and `every: 10`. Lower `every`.
- **`every` is missing** — without `every`, `cycle.internalMessageCount === cycle.every`
  is never true. The accumulator grows forever (memory leak). Always set `every`.
- **`exclusive: true` and you wanted the per-message callback** — `exclusive` suppresses
  the per-message callback. Use `exclusive: false` (default) if you want both.
- **The handler was soft-disabled** with `off()`. Re-register with `on()`.

See **[Cycle Feature](14-cycle-feature.md)** for the full state diagram.

## 5. Local events not replayed on reconnect

**Symptom:** You called `send()` while offline and expected them to flush on reconnect;
they never appear on the server.

**Causes & fixes:**

- **`localEvents` not enabled** in the config:

  ```javascript
  connection: { fallback: { localEvents: true } }
  ```

- **You're on Node**, where `navigator.onLine` is undefined (older versions) or always
  reports online. The check
  `typeof navigator !== 'undefined' && !navigator.onLine` will never be true ⇒ events
  are sent immediately and fail silently if the socket is `CONNECTING` / `CLOSED`.
  Offline buffering is effectively a browser-only feature.

- **`localEventsDelay` is too large** — if the delay is 60_000 ms and you have 1000
  buffered events, it will take 60_000 seconds to flush. Lower it or set to `0` for an
  immediate burst.

## 6. Heartbeat times out repeatedly

**Symptom:** Logs show `No heartbeat expected response, reconnecting...` over and over.

**Causes & fixes:**

- **Server doesn't reply with the configured `expectedResponse`.** The library expects
  the parsed message to be **strictly equal** to `expectedResponse` (default `"pong"`).
  If your server sends `{"type":"pong"}`, that's an object, not the string `"pong"` —
  it won't match.
- **Network MTU / proxy buffering** is delaying small frames. Increase
  `heartbeat.timeout` (e.g. 30_000) and / or `heartbeat.interval`.
- **Server `proxy_read_timeout` < `heartbeat.interval`** — see
  [Deployment → nginx](12-deployment.md#reverse-proxy-nginx).

## 7. `navigator is not defined` in Node

**Symptom:** `ReferenceError: navigator is not defined` thrown from `send()`.

**Cause:** Very old Node versions (pre-21) do not provide a global `navigator`. The
library protects most call sites with `typeof navigator !== 'undefined'`, but if you
have monkey-patched or imported a wrong polyfill, the guard can fail.

**Fix:**

- Upgrade to Node 14+ (the library's minimum) and avoid replacing `navigator`.
- If you must polyfill, do it before constructing the handler:

  ```javascript
  if (typeof navigator === 'undefined') globalThis.navigator = { onLine: true };
  ```

## 8. `WebSocket is not defined` in Node

**Symptom:** `ReferenceError: WebSocket is not defined`.

**Cause:** Older Node without a global `WebSocket` AND the `ws` package isn't installed.

**Fix:**

```bash
npm install ws
```

The library does `require('ws').WebSocket` when no global is present.

## 9. NetworkQualityMonitor reports offline incorrectly

**Symptom:** In Node, the library logs `Network is offline. Closing WebSocket connection.`
even though you can reach the WS server.

**Cause:** The default NQM probes `https://www.google.com`. Corporate proxies, China
firewall, or air-gapped networks block this URL, so every probe fails ⇒ `offline`.

**Fix:** Construct your own NQM (or fork the library) with a reachable URL:

```javascript
const NQM = require('ws-events-handler/NetworkQualityMonitor');
const monitor = new NQM('https://your-internal-health-check.example.com', 10_000);
// Note: this monitor is *additional* to the one the library spins up. To replace it
// completely you would need a small fork / PR; the constructor currently does not
// accept an NQM instance.
```

## 10. `destroy()` called but a reconnect still fires

**Symptom:** After calling `destroy(reason)`, a `Retrying connection in N seconds` log
still appears.

**Cause:** A `#retryConnection()` `setTimeout` was already scheduled before `destroy()`
ran. The current source does not track or cancel that timer.

**Fix:** Race condition is benign — the next `#connect()` call will create a new
WebSocket that immediately closes (because event listeners were removed in `destroy()`).
If it bothers you, set a flag:

```javascript
const safeDestroy = () => {
  ws.__destroyed = true;
  ws.destroy('explicit');
};

// Optionally monkey-patch send to no-op:
const origSend = ws.send.bind(ws);
ws.send = (n, p) => { if (!ws.__destroyed) origSend(n, p); };
```

## 11. ACK loop

**Symptom:** Two events bounce back and forth between client and server forever.

**Cause:** You registered `ack` on event `X`. The server replies to `X-ack` with `X`
again, which triggers another ack, which the server responds to with `X`, …

**Fix:** Ack channels must be **one-way**. The server should consume `X-ack` silently
and not emit anything in response. Confirm by:

```javascript
// On the server (pseudo-code)
socket.on('message', ([name, payload]) => {
  if (name.endsWith('-ack')) return;   // never reply to acks
  // ...
});
```

## 12. `ws.onerror` not called

**Symptom:** You assigned `ws.onerror = fn` but errors only show in `console.error`.

**Causes & fixes:**

- **You assigned it too late** — between `new WebSocketEventsHandler(...)` and the first
  error event. Set it immediately, on the line after construction.
- **No error occurred yet.** The hook only fires for actual `error` events from the
  underlying WebSocket; parse errors, max-retries, and heartbeat timeouts do **not**
  route through it (those use `#log('error', ...)` or `destroy()`).
- **`debug: false`** hides the default log path, so it can *look* like the hook isn't
  called when in fact no error has fired yet. Enable debug to confirm.

---

If your issue isn't listed, please open a GitHub issue with:

- Library version (`npm ls ws-events-handler`)
- Node / browser version
- A minimal reproduction (echo server + client snippet)
- `debug: true` output

See also: [Connections](06-connections.md), [Error Handling](07-error-handling.md),
**[Cycle Feature](14-cycle-feature.md)**.
