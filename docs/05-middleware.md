# Middleware & Extension Points

> **Note**: The WS-Events library does **not** include a built-in middleware pipeline. However, there are several extension points for adding custom logic and behavior.

## Extension Points

### 1. `onerror` Callback

The `onerror` property allows you to override the default error handling behavior:

```javascript
const wsHandler = new WebSocketEventsHandler('ws://localhost:8080');

wsHandler.onerror = (error) => {
  console.error('Custom error handler:', error);
  sendToMonitoringService(error);
  // Custom logic: metrics, logging, alerts
};
```

When set, this function is called instead of the default debug logging on WebSocket errors:

```javascript
#onError = (error) => {
  if (this.onerror) return this.onerror(error);
  this.#log('error', 'WebSocket Error:', error);
}
```

To reset to default behavior, set `onerror = false` (the initial default value).

### 2. NetworkQualityMonitor Events (Node.js)

In Node.js environments, the library uses `NetworkQualityMonitor` which emits:

| Event | Payload | Description |
|-------|---------|-------------|
| `online` | none | Network became available |
| `offline` | none | Network became unavailable |
| `quality` | `{ latency: number }` | Network performance metric |

These events are used internally to trigger reconnection on `online` and connection close on `offline`.

### 3. Custom Wrapper Pattern

For pre/post processing, validation, or logging, wrap the library in your own class:

```javascript
class MyAppHandler {
  constructor(url, config) {
    this.ws = new WebSocketEventsHandler(url, config);
  }

  on(event, handler) {
    this.ws.on(event, (data) => {
      // Pre-processing: validation, logging, transformation
      console.log(`[${event}]`, data);

      // Call the original handler
      handler(data);

      // Post-processing: metrics, audit trail
      this.recordMetric(event);
    });
  }

  send(event, payload) {
    // Validate before sending
    if (!this.validatePayload(event, payload)) {
      console.error(`Invalid payload for ${event}`);
      return;
    }
    this.ws.send(event, payload);
  }

  destroy() {
    this.ws.destroy();
  }

  validatePayload(event, payload) {
    // Custom validation logic
    return true;
  }

  recordMetric(event) {
    // Custom metrics logic
  }
}
```

### 4. Direct WebSocket Access

The WebSocket instance is private (`#ws`), but you can extend behavior by listening to the `mounted` event:

```javascript
wsHandler.on('mounted', (data) => {
  console.log('Connected with ID:', data.id);
  // Custom initialization logic
});
```

## Architectural Notes

While there is no middleware chain, the library's architecture provides:

- **Handler isolation**: Each handler has its own callback scope — errors in one don't affect others
- **Separation of concerns**: Event routing, cycle management, ACK logic, and connection management are in separate private methods
- **Non-blocking**: All operations are asynchronous (WebSocket is inherently async)

## See Also

- [Advanced Topics](11-advanced-topics.md) — Deep dives into architecture
- [Error Handling](07-error-handling.md) — Error sources and recovery
- [API Reference](08-api-reference.md) — Full API documentation