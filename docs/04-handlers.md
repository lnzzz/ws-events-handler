# Handlers

A **handler** in `ws-events-handler` is more than a callback function: it is a record
stored in the internal `Map` with metadata about its lifecycle. This document explains the
record shape, registration semantics, and best practices.

## Table of Contents

- [Registration](#registration)
- [Internal Stored Shape](#internal-stored-shape)
- [Unregistering (Soft Off)](#unregistering-soft-off)
- [Callback Signature](#callback-signature)
- [Tracking Metadata](#tracking-metadata)
- [ACK Sub-Config](#ack-sub-config)
- [Cycle Sub-Config](#cycle-sub-config)
- [Best Practices](#best-practices)

---

## Registration

```javascript
ws.on(eventName, config);
```

- `eventName: string` — the wire name of the event.
- `config: object` — see below.

A second call to `on()` for the same event **replaces** the previous record but preserves
the `registeredOn` timestamp. The `off` flag is reset to `false`.

```javascript
ws.on('foo', { callback: () => 'a' });
ws.on('foo', { callback: () => 'b' });  // 'a' is gone, but registeredOn is unchanged
```

## Internal Stored Shape

```javascript
{
  eventName: 'user:update',          // string
  config: {                          // your config object
    callback: <Function>,
    ack?:    { event?, originalEvent? },
    cycle?:  { every, rounds?, once?, exclusive?, callback?, ...counters }
  },
  registeredOn: 1717420000000,       // ms timestamp of first registration
  off: false,                        // soft-disable flag
  tracking?: { lastTrigger: 1717420000123 }   // populated on first fire
}
```

This record is set/updated via `#updateHandler(handler, config)` whenever the handler
fires or its config is mutated (e.g. by the Cycle feature self-destructing).

## Unregistering (Soft Off)

```javascript
ws.off('user:update');
```

This sets `handler.off = true`. The handler record itself remains in the Map. Effects:

- Incoming `user:update` events are **dropped silently** by `#onEvent`.
- `tracking.lastTrigger` is **not** updated.
- Cycle counters are **frozen** at their last value (they do not reset).
- The handler can be re-enabled by calling `on('user:update', ...)` again.

> **Why soft-off?** It lets you pause and resume listeners without losing their analytics
> history or having to re-register the cycle accumulators from scratch.

## Callback Signature

```javascript
(payload: any) => void | Promise<void>
```

- The callback receives the **raw payload** as sent on the wire — the library does NOT
  unwrap the `{when, id, payload}` envelope for you when the message is incoming. If the
  server sends `["foo", 42]` your callback gets `42`. If the server sends
  `["foo", { when, id, payload: 42 }]` your callback gets the whole envelope.
- The callback can be `async`. The library does NOT `await` its return value, so
  unhandled promise rejections will surface as `UnhandledPromiseRejection`. Wrap your
  body in `try/catch`.
- The callback **must not mutate** the payload if you rely on cycle batching: the
  same reference is pushed into `cycle.internalCyclePayloads`.

## Tracking Metadata

Every fire updates:

```javascript
handler.tracking = { lastTrigger: Date.now() };
```

You can introspect this from outside if you stash a reference (currently the registry is
private, but you can wrap `on` in your own factory):

```javascript
const wrap = (name, cfg) => {
  ws.on(name, {
    ...cfg,
    callback: (p) => { lastSeen[name] = Date.now(); return cfg.callback(p); }
  });
};
```

## ACK Sub-Config

```javascript
ack: {
  event: 'custom-ack-name',   // default: `${eventName}-ack`
  originalEvent: true         // spread original payload into ack body
}
```

The ack is sent **before** the user callback runs. See [Event Handling](03-event-handling.md#ack-behavior).

## Cycle Sub-Config

```javascript
cycle: {
  every: 5,                       // required: batch size
  rounds: 2,                      // optional: total rounds before self-destruct
  once: false,                    // optional: alias for rounds=1
  exclusive: false,               // optional: suppress the per-message callback
  callback: (payloads) => { ... } // optional: defaults to handler.config.callback
}
```

This is documented in depth, with edge cases, in **[Cycle Feature](14-cycle-feature.md)**.

## Best Practices

1. **Keep callbacks non-blocking.** The handler runs synchronously on the WebSocket
   `message` event loop tick; CPU-heavy work will stall heartbeats.

   ```javascript
   ws.on('frame', {
     callback: (p) => {
       queueMicrotask(() => heavyEncode(p));  // yield first
     }
   });
   ```

2. **Make handlers idempotent.** Network blips can cause the server to redeliver. Treat
   the handler body as if it could run twice for the same payload.

3. **Don't mutate the payload.** Pushing into nested arrays is fine; reassigning
   properties is not — the same object is referenced by cycle accumulators and any
   downstream code.

4. **Wrap callbacks in `try/catch`.** A throw inside `config.callback` or
   `cycle.callback` propagates up through `#onEvent` (there is no try/catch in the
   source) and may break subsequent processing.

5. **Reach for `cycle` instead of manual buffering.** Batching N messages by hand is the
   canonical use-case for the Cycle feature — see [docs/14-cycle-feature.md](14-cycle-feature.md).

---

See also: [API Reference](08-api-reference.md), [Examples](09-examples.md).
