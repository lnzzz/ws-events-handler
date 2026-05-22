# Advanced Topics

Topics covered here are beyond the basic "open a socket and listen" use case. They
discuss what the library does **not** do, and the user-land patterns that compensate.

## Table of Contents

- [Distributed Event Processing](#distributed-event-processing)
- [Ordering Guarantees](#ordering-guarantees)
- [Performance Tips](#performance-tips)
- [Memory Considerations](#memory-considerations)
- [Security Considerations](#security-considerations)
- [Rate Limiting](#rate-limiting)
- [Heartbeat Tuning Trade-offs](#heartbeat-tuning-trade-offs)

---

## Distributed Event Processing

`ws-events-handler` is a **per-connection** client library. It has no clustering, no
shared state, no built-in pub/sub across instances. If you need to fan an event out to
all clients in a horizontally-scaled WebSocket fleet, do it on the server side — for
example, with Redis pub/sub:

```
client A ──► server-1 ──► redis pub ──► server-1, server-2, ... ──► all subscribed clients
client B ──► server-2 ◄──┘
```

The client side just calls `ws.send(name, payload)` and `ws.on(name, { callback })`; the
distribution is the server's responsibility.

## Ordering Guarantees

- **Per-connection:** WebSocket itself preserves frame order. The library does not
  re-order incoming messages.
- **Across connections:** no guarantee. If you tear down and reconnect, late frames from
  the old socket may arrive after early frames from the new socket (they shouldn't —
  TCP/TLS closes block writes — but treat it as undefined behavior).
- **Offline buffer flush:** when `localEventsDelay > 0`, events are flushed in **FIFO**
  order. When `localEventsDelay = 0`, the current source loops from the **end** of the
  array (LIFO). If order matters with no delay, set a small delay (e.g. `1`).
- **Cycle batches:** within a batch, payloads are in arrival order
  (`internalCyclePayloads.push(payload)`).

## Performance Tips

1. **Keep callbacks small.** They run on the same tick as the WebSocket `message` event;
   long work delays the next message and the next heartbeat.

2. **Batch with `cycle.every`** rather than buffering manually. The library does the
   accumulation in O(1) per message with no extra heap pressure beyond the payload
   array — see [Cycle Feature](14-cycle-feature.md).

3. **Defer to a microtask** for heavy work:

   ```javascript
   ws.on('frame', {
     callback: (p) => queueMicrotask(() => encodeFrame(p))
   });
   ```

4. **Avoid logging in hot paths.** `debug: true` calls `console[level]` on every
   lifecycle event, which is fine for development but slow under load.

5. **Reuse a single instance per logical channel.** Each `WebSocketEventsHandler` opens
   its own connection; multiplexing many event types over one instance is cheaper than
   spawning many instances.

## Memory Considerations

### Cycle Accumulator

Each handler with a `cycle` config maintains an internal array
`cycle.internalCyclePayloads` that grows until the batch fires. If `every` is large and
you never reach it, you have an unbounded memory leak.

```javascript
// BAD: 1 million-message batch with no rounds, never flushed if you stop early.
ws.on('x', { cycle: { every: 1_000_000, callback: (b) => persist(b) } });
```

Mitigations:

- Always set `every` to a value you will realistically hit.
- Add a `rounds` ceiling so the handler self-destructs.
- Periodically `off()` + re-`on()` to flush the accumulator.

### Offline Buffer

`#localEvents` is unbounded. A long offline period with frequent `send()` calls will
grow this array until you reconnect or destroy the instance. Consider a max length:

```javascript
// Defensive wrapper:
const originalSend = ws.send.bind(ws);
ws.send = (name, payload) => {
  // (peek internal state is not officially supported; use a separate counter)
  if (mySendCounter++ > 10_000 && !navigator.onLine) {
    console.warn('dropping buffered event');
    return;
  }
  originalSend(name, payload);
};
```

### Destroyed Instances

After `destroy()` the listener references are removed, but if your application still
holds references to the handler config closures, those closures will keep their captured
variables alive. Null out your references explicitly:

```javascript
ws.destroy('done');
ws = null;
```

## Security Considerations

1. **Use `wss://` in production.** `ws://` is unencrypted and trivially MITM-able.
2. **Validate every payload.** The wire is a trust boundary; never `eval`, never destructure
   into your DB layer without schema validation. See the
   [middleware patterns](05-middleware.md) for validation hooks (joi/zod).
3. **Treat the `id` from `mounted` as untrusted.** Don't use it as a database primary key
   without server-side verification.
4. **Be careful with ACK loops.** A server that echoes the ack you sent will trigger an
   infinite ping-pong with no rate limit. The library does not detect this.
5. **Rate-limit on the server.** The client has no built-in throttling for inbound
   messages.
6. **Sanitize logged payloads.** `debug: true` will `console.log` payloads, which can
   include PII. Disable in production.

## Rate Limiting

User-land throttle (drops messages outside the window):

```javascript
const throttle = (ms) => {
  let last = 0;
  return (payload, next) => {
    const now = Date.now();
    if (now - last < ms) return;
    last = now;
    return next(payload);
  };
};

ws.on('cursor', {
  callback: (p, next = render) => throttle(50)(p, () => render(p))
});
```

User-land debounce (collapses bursts to the latest):

```javascript
const debounce = (ms, fn) => {
  let t;
  return (p) => { clearTimeout(t); t = setTimeout(() => fn(p), ms); };
};

ws.on('search:typing', { callback: debounce(150, doSearch) });
```

For an even cleaner batching primitive — use `cycle`.

## Heartbeat Tuning Trade-offs

| Setting             | Lower value                                            | Higher value                                       |
| ------------------- | ------------------------------------------------------ | -------------------------------------------------- |
| `heartbeat.interval`| Detect dead connections faster; more bandwidth.        | Bandwidth-friendly; slower detection.              |
| `heartbeat.timeout` | Fail fast (good UX); false positives on slow networks. | Tolerate latency; slower failure detection.        |
| Both small          | Mobile / wifi roaming.                                 | n/a                                                |
| Both large          | Power-sensitive IoT, satellite links.                  | n/a                                                |

Typical defaults (`interval: 15000, timeout: 10000`) are good for a web app on broadband.
For mobile, try `interval: 5000, timeout: 3000`.

---

See also: **[Cycle Feature](14-cycle-feature.md)**, [Connections](06-connections.md),
[Deployment](12-deployment.md).
