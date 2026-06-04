# Handlers

## Handler Configuration

Handlers accept either a **simple function** or a **configuration object**.

### Simple Function

```javascript
wsHandler.on('chat:message', (data) => {
  console.log('Message received:', data);
});
```

When a function is passed, it is used directly as the callback for every matching event.

### Configuration Object

```javascript
wsHandler.on('chat:message', {
  callback: (data) => {
    console.log('Message received:', data);
  },
  cycle: { /* cycle config */ },
  ack: { /* ack config */ }
});
```

## Handler Lifecycle

### 1. Registration (`on`)

When `on(eventName, config)` is called:

1. Checks if a handler already exists for this event name in the `#handlers` Map
2. Creates/updates the handler entry with:
   - `eventName`: The event name
   - `config`: The passed configuration (function or object)
   - `registeredOn`: Timestamp (preserved from first registration)
   - `off`: Set to `false`

```javascript
on(eventName, config) {
  const existingHandler = this.#handlers.get(eventName);
  this.#handlers.set(eventName, {
    ...existingHandler,
    eventName,
    config,
    registeredOn: existingHandler?.registeredOn || Date.now(),
    off: false
  });
}
```

### 2. Processing (`#processHandler`)

When an event arrives and the handler is found:

1. If `config.ack` exists → calls `#sendAck()` to send acknowledgement
2. Updates `handler.tracking.lastTrigger` to current timestamp
3. Saves updated handler back to Map via `#updateHandler()`
4. If `config.cycle` exists → calls `#processCycle()` for batch accumulation
5. If cycle is **not exclusive** → invokes the callback:
   - If `config` is a function → calls `config(payload)`
   - If `config.callback` exists → calls `config.callback(payload)`

### 3. Deactivation (`off`)

When `off(eventName)` is called, the handler's `off` flag is set to `true`. The handler remains in the Map but is skipped during event routing:

```javascript
off(eventName) {
  const handler = this.#handlers.get(eventName);
  if (handler) {
    this.#handlers.set(eventName, { ...handler, off: true });
  }
}
```

### 4. Cleanup (`destroy`)

Calling `destroy()` removes all WebSocket listeners, stops heartbeat, clears intervals, and detaches network listeners. It does **not** clear the handler Map — handlers persist but become unreachable once the instance is discarded.

## Cycle Feature

The cycle system batches multiple event payloads before invoking a callback.

### Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `every` | number | required | Number of messages to collect per cycle |
| `rounds` | number | infinite | Number of cycles to complete |
| `once` | boolean | `false` | Shorthand for `rounds: 1` |
| `exclusive` | boolean | `false` | Skip root callback when `true` |
| `callback` | function | required | Called with array of accumulated payloads |

### Example: Batch Processing

```javascript
wsHandler.on('telemetry:reading', {
  cycle: {
    every: 10,
    rounds: 5,
    callback: (allReadings) => {
      const avg = allReadings.reduce((s, r) => s + r.temperature, 0) / allReadings.length;
      console.log('Average temperature:', avg);
    }
  },
  callback: (reading) => {
    console.log('Real-time reading:', reading.temperature);
  }
});
```

This configuration:
- Collects 10 readings per cycle
- Repeats for 5 cycles (50 readings total)
- Calls both the cycle callback (every 10 messages) and the root callback (every message)

### Example: Exclusive + Once

```javascript
wsHandler.on('setup:init', {
  cycle: {
    every: 3,
    once: true,
    exclusive: true,
    callback: (messages) => {
      console.log('Initial setup complete with', messages.length, 'messages');
    }
  },
  callback: (data) => {
    // This will NOT be called because exclusive: true
  }
});
```

### Internal Mechanics

```javascript
#processCycle(handler, payload) {
  const { cycle } = handler.config;

  // Initialize tracking fields on first call
  if (!cycle.internalMessageCount) {
    cycle.internalMessageCount = 0;
    cycle.internalCyclePayloads = [];
  }
  if (!cycle.internalRoundCount && (cycle.rounds || cycle.once)) {
    cycle.internalRoundCount = 0;
  }

  cycle.internalMessageCount++;
  cycle.internalCyclePayloads.push(payload);

  if (cycle.internalMessageCount === cycle.every) {
    cycle.internalRoundCount++;

    if (cycle.rounds && cycle.internalRoundCount === cycle.rounds) {
      // Last round: send all accumulated payloads and destroy cycle
      callback(cycle.internalCyclePayloads.slice(0, (cycle.every * cycle.internalRoundCount)));
      handler.config.cycle = null;  // Self-destruct
    } else {
      // Normal cycle: send payloads and reset counters
      callback(cycle.internalCyclePayloads);
      cycle.internalMessageCount = 0;
      cycle.internalCyclePayloads = [];
    }
  }
}
```

## Acknowledgement (ACK)

The ACK system automatically sends a response event back to the server when a matching event is received.

### Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `event` | string | `'{eventName}-ack'` | Custom ACK event name |
| `originalEvent` | boolean | `false` | Include original payload in ACK |

### Example

```javascript
wsHandler.on('order:create', {
  ack: {
    event: 'order:create-ack',
    originalEvent: true
  },
  callback: (data) => {
    console.log('Processing order:', data);
  }
});
```

When an `order:create` event is received, the library automatically sends:

```javascript
["order:create-ack", {
  when: Date.now(),
  id: "client-uuid",
  ...originalPayload
}]
```

## Tracking

Each handler stores a `tracking` object with runtime metadata:

```javascript
handler.tracking = {
  lastTrigger: Date.now()  // Timestamp of last handler invocation
}
```

## See Also

- [Event Handling](03-event-handling.md) — How events flow through the system
- [API Reference](08-api-reference.md) — Full method signatures
- [Examples](09-examples.md) — Runnable code examples