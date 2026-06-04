# Event Handling

## Wire Format

Events are transmitted as **JSON arrays** over the WebSocket connection:

```javascript
["eventName", {
  when: 1712345678901,
  id: "client-uuid",
  payload: { /* data */ }
}]
```

The `when` field is always present (Unix timestamp in milliseconds). The `id` field is present after the `mounted` event is received from the server. The `payload` field contains the actual event data.

## Message Flow

### 1. Server Sends Message

The WebSocket `message` event fires with raw data.

### 2. Parsing (`#onMessage`)

The raw data is parsed with `JSON.parse()` inside a `try/catch` block:

```javascript
#onMessage = (event) => {
  let data;
  try {
    data = JSON.parse(event.data);
  } catch (error) {
    this.#log('warn', 'Failed to parse message data.', error);
    return;  // Malformed data is safely ignored
  }
  // ...
}
```

### 3. Heartbeat Interception

If the parsed data matches the configured `heartbeat.expectedResponse` (default: `'pong'`), the heartbeat timeout is cleared and the message is **not** routed to any handler:

```javascript
if (data === this.#heartbeatExpectedResponse) {
  clearTimeout(this.#heartbeatExpectedResponseTimeout);
  return;
}
```

### 4. Event Routing (`#onEvent`)

The data is passed to `#onEvent()` which:

1. Extracts the event name and payload from the array:
   ```javascript
   const [eventName, payload] = Array.isArray(eventData) ? eventData : [eventData];
   ```
2. Looks up the handler in the `#handlers` Map using the event name (O(1) lookup)
3. If no handler is found, logs a warning and returns
4. If the handler is marked `off: true`, skips it

### 5. Handler Processing (`#processHandler`)

The handler processes the event:

1. If `ack` is configured → sends an acknowledgement event
2. Updates tracking info (`lastTrigger` timestamp)
3. If `cycle` is configured → processes cycle accumulation
4. If cycle is **not exclusive** → invokes the root callback

```
                     ┌─────────────────┐
                     │  Server Message  │
                     └────────┬────────┘
                              │
                     ┌────────▼────────┐
                     │  JSON.parse()   │
                     │  (try/catch)    │
                     └────────┬────────┘
                              │
                     ┌────────▼────────┐
                     │ Is heartbeat    │
                     │ response?       │──Yes──→ Clear timeout, return
                     └────────┬────────┘
                              │ No
                     ┌────────▼────────┐
                     │  #onEvent()     │
                     │  Extract        │
                     │  [name, payload]│
                     └────────┬────────┘
                              │
                     ┌────────▼────────┐
                     │ Lookup handler  │
                     │ in Map by name  │
                     └────────┬────────┘
                              │
                     ┌────────▼────────┐
                     │#processHandler()│
                     │  → Send ACK?    │
                     │  → Cycle?       │
                     │  → Callback?    │
                     └─────────────────┘
```

## Sending Events

The `send(eventName, payload?)` method builds the wire-format array and sends it:

```javascript
send(eventName, payload) {
  const message = [eventName, {
    when: Date.now(),
    ...(this.#id) ? { id: this.#id } : null,
    payload
  }];
  // ...
  this.#ws.send(JSON.stringify(message));
}
```

### Offline Handling

If the environment is a browser and `navigator.onLine === false`, and `connection.fallback.localEvents` is enabled, the message is queued in `#localEvents[]` instead of being sent:

```javascript
if (typeof navigator !== 'undefined' && !navigator.onLine && this.#useLocalEvents) {
  this.#localEvents.push(message);
  return;
}
```

## See Also

- [Handlers](04-handlers.md) — Handler configuration and lifecycle
- [Connections](06-connections.md) — Connection lifecycle details
- [API Reference](08-api-reference.md) — Full method signatures