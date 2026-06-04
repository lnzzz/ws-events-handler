# Advanced Topics

## Cycle Feature (Batch Processing)

The cycle feature collects N messages for an event and then executes a callback with all collected payloads.

### Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `every` | number | — | Number of messages to collect per batch |
| `rounds` | number | ∞ | Number of batch cycles to run |
| `once` | boolean | false | Run exactly 1 batch (rounds=1) |
| `exclusive` | boolean | false | If true, skip main callback |
| `callback` | function | — | Batch callback |

### Internal Mechanism

```javascript
// Internal state tracked on the cycle config:
cycle.internalMessageCount  // Messages received so far in current cycle
cycle.internalCyclePayloads // Array of collected payloads
cycle.internalRoundCount    // Cycles completed so far

// When internalMessageCount === every:
//   1. Increment internalRoundCount
//   2. Execute callback with collected payloads
//   3. If rounds reached, set cycle = null (self-destruct)
//   4. Else reset internalMessageCount and internalCyclePayloads
```

## ACK Feature

When a handler has an `ack` config, the library automatically sends an acknowledgment event.

```javascript
#sendAck(eventName, ackConfig, originalEventPayload) {
  const ackMessage = {
    when: Date.now(),
    ...(this.#id) ? { id: this.#id } : null,
    ...(ackConfig.originalEvent) ? originalEventPayload : null
  };
  const ackEventName = ackConfig.event || `${eventName}-ack`;
  this.#ws.send(JSON.stringify([ackEventName, ackMessage]));
}
```

The ACK is sent **before** the handler callback is executed, so the server receives acknowledgment immediately.

## Local Events / Offline Storage

When `connection.fallback.localEvents = true`:

1. `send()` checks `navigator.onLine` (or network status)
2. If offline, events are pushed to `#localEvents[]` array
3. On reconnect (`#onOpen`), events are dispatched:
   - If `localEventsDelay` is set: dispatched one-by-one using `setInterval`
   - If no delay: dispatched in a loop (reversed order for FIFO)

```javascript
// With delay (one event per interval):
setInterval(() => {
  const event = this.#localEvents[0];
  this.send(event[0], event[1]);
  this.#localEvents.splice(0, 1);
}, localEventsDelay);

// Without delay (burst):
for (let i = length - 1; i >= 0; i--) {
  this.send(event[0], event[1]);
  this.#localEvents.splice(index, 1);
}
```

## NetworkQualityMonitor (Node.js)

For Node.js environments where `window` and `navigator` don't exist, the library uses `NetworkQualityMonitor` to detect network changes.

```javascript
class NetworkQualityMonitor extends EventEmitter {
  constructor(url = 'https://www.google.com', interval = 5000)
  
  startMonitoring()  // Start periodic checks
  stopMonitoring()   // Stop periodic checks
  checkNetworkQuality()  // HTTP GET check, emits:
    // 'online' if status === 200
    // 'offline' if error or non-200
    // 'quality' with { latency: ms } if online
}
```

## Handler Internals

The `#handlers` Map stores handlers with:

```javascript
{
  eventName: string,
  config: object|function,
  registeredOn: timestamp,
  off: boolean,        // When true, handler is skipped
  tracking: {          // Set on each trigger
    lastTrigger: timestamp
  }
}
```

The `#updateHandler()` method persists tracking updates back to the Map.

## Mount Event

On connection, the server can send a `mounted` event with an `id`:

```javascript
// Handler registered internally:
this.on('mounted', this.#handleMounted.bind(this));

#handleMounted(data) {
  this.#id = data.id || null;
  this.#mountTime = Date.now();
}
```

The `#id` is included in all subsequent messages and ACKs.