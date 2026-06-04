# Error Handling

## Error Types

1. **WebSocket Errors** — Network failures, server crashes
2. **Parse Errors** — Malformed JSON messages
3. **Connection Timeouts** — Heartbeat not received
4. **Max Retries Exceeded** — Connection permanently closed

## WebSocket Errors (`#onError`)

```javascript
#onError(error) {
  if (this.onerror) return this.onerror(error);
  this.#log('error', 'WebSocket Error:', error);
}
```

Set a custom error handler:

```javascript
ws.onerror = (error) => {
  // Custom error handling
  sendAlert(error);
};
```

If `onerror` is not set, errors are only logged (in debug mode).

## Parse Errors (`#onMessage`)

```javascript
try {
  data = JSON.parse(event.data);
} catch (error) {
  this.#log('warn', 'Failed to parse message data.', error);
  return;  // Silently skip malformed messages
}
```

Malformed messages are safely skipped without crashing.

## Connection Retry Exhaustion

```javascript
if (retryCount >= maxRetries) {
  // Logs: 'Max retry attempts reached. Connection closed permanently.'
  this.destroy('Max retry attempts reached.');
}
```

## Heartbeat Timeout

```javascript
setTimeout(() => {
  this.#log('warn', 'No heartbeat expected response, reconnecting...');
  this.#ws.close();  // Triggers reconnect
}, heartbeatTimeout);
```

## Guards and Safety Checks

The library includes safety checks for cross-platform compatibility:

- `typeof navigator !== 'undefined'` before using `navigator.onLine`
- `typeof window !== 'undefined'` before using DOM events
- `readyState` checks before closing WebSocket
- Try/catch around all JSON parsing