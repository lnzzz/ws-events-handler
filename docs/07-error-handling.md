# Error Handling

## Error Sources

### 1. Message Parsing Errors

Incoming messages are parsed with `JSON.parse()`. If the data is malformed (not valid JSON), the error is caught and logged as a warning. The event is **not** processed:

```javascript
#onMessage = (event) => {
  let data;
  try {
    data = JSON.parse(event.data);
  } catch (error) {
    this.#log('warn', 'Failed to parse message data.', error);
    return;  // Safely ignore malformed data
  }
  // ...
}
```

### 2. WebSocket Errors

When the WebSocket `error` event fires, the `#onError` handler checks:

1. If `wsHandler.onerror` is set (user-defined callback) → delegates to it
2. Otherwise → logs the error via debug mode

```javascript
#onError = (error) => {
  if (this.onerror) return this.onerror(error);
  this.#log('error', 'WebSocket Error:', error);
}
```

### 3. Connection Errors (Close)

When the WebSocket `close` event fires, `#onClose` handles recovery:

```javascript
#onClose = (event) => {
  this.#log('info', 'Connection closed', event);
  if (this.#connectionRetryCount < this.#connectionMaxRetries) {
    this.#retryConnection();
  } else {
    this.#log('error', 'Max retry attempts reached. Connection closed permanently.');
    this.destroy('Max retry attempts reached.');
  }
}
```

- If retries remain → calls `#retryConnection()` with exponential backoff
- If max retries exhausted → calls `destroy()` with permanent close message

### 4. Invalid Handler Config

If a handler is found but has no `config` property, an error is thrown:

```javascript
#processHandler(handler, payload) {
  const { config } = handler;
  if (!config) throw new Error(`No config found for handler of event type: ${handler.eventName}`);
  // ...
}
```

### 5. Safe Close Guards

Before calling `ws.close()`, the library checks `ws.readyState < 2` to avoid errors on already-closed or closing connections:

```javascript
if (this.#ws && this.#ws.readyState < 2) this.#ws.close();
```

## Recovery Strategies

### Exponential Backoff Retry

When a connection drops, retries follow an exponential backoff pattern:

```
Delay = baseDelay × 2^(attempt - 1)
```

| Attempt | Delay (base: 1000ms) |
|---------|----------------------|
| 1 | 1,000 ms |
| 2 | 2,000 ms |
| 3 | 4,000 ms |
| 4 | 8,000 ms |
| 5 | 16,000 ms |

### Network Recovery

When the network transitions from offline to online:

- **Browser**: `window` `online` event fires → `#handleOnline()` → `#connect()`
- **Node.js**: `NetworkQualityMonitor` detects connectivity → `online` event → `#handleOnline()` → `#connect()`

### Heartbeat Timeout Recovery

If the expected heartbeat response is not received within the configured timeout:

1. Timeout fires → logs warning: `"No heartbeat expected response, reconnecting..."`
2. WebSocket is closed via `this.#ws.close()`
3. `#onClose` fires → triggers reconnection loop

## Handler Isolation

Each handler has its own callback scope. An error in one handler does **not** affect other handlers or the event routing system. If a handler callback throws, it will not propagate to other handlers.

## Best Practices

1. **Always enable debug mode** during development to see error details
2. **Set `onerror`** in production to route errors to your monitoring system
3. **Configure reasonable retry limits** — too many retries can overwhelm the server
4. **Set appropriate heartbeat timeouts** — too short causes false reconnections, too long delays detection
5. **Validate payloads** in handler callbacks before processing

## See Also

- [Troubleshooting](13-troubleshooting.md) — Common issues and solutions
- [Connections](06-connections.md) — Connection lifecycle details
- [API Reference](08-api-reference.md) — Configuration options