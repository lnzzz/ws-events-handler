# Event Handling

`ws-events-handler` follows an event-bus model: you register handlers by name with `on()`,
emit events with `send()`, and the library takes care of (de)serialization, ack, cycle
batching, and the special `mounted` system event.

## Table of Contents

- [Outgoing Message Shape](#outgoing-message-shape)
- [Incoming Message Routing](#incoming-message-routing)
- [Handler Config Object](#handler-config-object)
- [ACK Behavior](#ack-behavior)
- [The `mounted` System Event](#the-mounted-system-event)
- [Examples](#examples)

---

## Outgoing Message Shape

`send(eventName, payload)` always produces:

```javascript
[
  eventName,
  {
    when: Date.now(),
    id: this.#id,        // only included once the server has assigned one
    payload               // your value, untouched
  }
]
```

The entire array is `JSON.stringify`-ed before being passed to the underlying `ws.send`.

> **Tip:** the server-side contract is your decision, but mirroring this envelope on the
> server side is usually a good idea — it gives you `when` (latency) and `id` (sender)
> for free.

## Incoming Message Routing

Routing happens in two steps inside `#onMessage` and `#onEvent`:

1. **`#onMessage(event)`**
   - Tries `JSON.parse(event.data)`. On parse failure, logs a warning and **returns
     silently** (the bad message is dropped — see [Error Handling](07-error-handling.md)).
   - If the parsed value equals `heartbeat.expectedResponse` (e.g. `"pong"`), it clears
     the heartbeat timeout and returns.
   - Otherwise it calls `#onEvent(data)`.

2. **`#onEvent(data)`**
   - Destructures `[eventName, payload] = Array.isArray(data) ? data : [data]`.
   - Looks up `this.#handlers.get(eventName)`.
   - If no handler exists, logs `Handler not found for event '<name>'` and returns.
   - If `handler.off === true`, returns silently (soft-disabled handler).
   - Otherwise calls `#processHandler(handler, payload)`.

```
event.data (raw string)
        │
        ▼
     JSON.parse  ── parse error ──► drop (log warning)
        │
        ▼
   === expectedResponse? ── yes ──► clear heartbeat timeout
        │ no
        ▼
   Array? ── no ──► [data]
        │
        ▼
   handlers.get(name)
        │
        ▼
   off? ── yes ──► drop silently
        │ no
        ▼
   #processHandler ──► ack? cycle? callback?
```

## Handler Config Object

The 2nd argument to `on()` is a **config object** (the library will also accept a bare
function for backward-compat reasons, but the object form is canonical):

```javascript
ws.on('user:update', {
  // (1) Per-message callback. Called for every incoming message UNLESS cycle.exclusive
  //     is true.
  callback: (payload) => {
    console.log('user updated', payload);
  },

  // (2) Optional ACK config. See "ACK Behavior" below.
  ack: {
    event: 'user:update-ack',   // optional, defaults to `${eventName}-ack`
    originalEvent: true         // include the original payload in the ack body
  },

  // (3) Optional Cycle config. See docs/14-cycle-feature.md for the full reference.
  cycle: {
    every: 5,
    rounds: 2,
    exclusive: false,
    callback: (batch) => console.log('batch of', batch.length)
  }
});
```

## ACK Behavior

When a handler config includes an `ack` sub-object, the library calls `#sendAck` **before**
running the user callback. It synthesizes:

```javascript
[
  ackConfig.event || `${eventName}-ack`,
  {
    when: Date.now(),
    id: this.#id,                                  // if known
    ...(ackConfig.originalEvent ? payload : {})    // spread the original payload
  }
]
```

…and sends it directly via `this.#ws.send(...)` (this path **bypasses** the offline
buffer; ACKs only make sense online).

> **Loop warning:** if your server also listens for `user:update-ack` and responds with
> another ack, you'll get an infinite ping-pong. Always make ack channels one-way.

## The `mounted` System Event

In the constructor, the client always registers a handler for the special event named
`'mounted'`:

```javascript
this.on('mounted', this.#handleMounted.bind(this));
```

When the server sends `["mounted", { id: "<some-id>" }]`, the client stores `#id` and
`#mountTime`. From that moment on, every outbound envelope from `send()` includes the
assigned id.

You can override the mounted handler in your own code if you want to react to the event,
but **don't forget** to keep the id assignment — the library currently does NOT chain
both your handler and the internal one, the last `on('mounted', ...)` wins.

## Examples

### 1. Bare-minimum handler

```javascript
ws.on('notice', {
  callback: (payload) => console.log('notice:', payload)
});

ws.send('notice', { kind: 'info', text: 'hello' });
```

### 2. ACK pattern

```javascript
ws.on('order:create', {
  ack: { originalEvent: true },                // ack name will be 'order:create-ack'
  callback: (payload) => {
    db.createOrder(payload);
  }
});
```

The server will receive — for every `order:create` it sends — a follow-up message:

```
["order:create-ack", { when: <ts>, id: "<client-id>", ...originalPayload }]
```

### 3. Soft-disable a handler temporarily

```javascript
ws.on('telemetry', { callback: (p) => buffer.push(p) });

// later, pause processing without losing the handler config:
ws.off('telemetry');     // sets handler.off = true; incoming messages are dropped

// re-enable by re-registering:
ws.on('telemetry', { callback: (p) => buffer.push(p) });
```

---

See **[Cycle Feature](14-cycle-feature.md)** for the most powerful event-handling
primitive in the library, and [Handlers](04-handlers.md) for handler internals.
