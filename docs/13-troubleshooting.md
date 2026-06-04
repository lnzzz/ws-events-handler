# Troubleshooting

## Common Issues

### "Failed to parse message data"

**Symptom**: Warning log: `"Failed to parse message data."`

**Cause**: The WebSocket server sent malformed or non-JSON data. The library safely catches the `JSON.parse` error and ignores the message.

**Solutions**:
- Verify the server is sending valid JSON
- Enable `debug: true` to see raw data in logs
- Check for binary data or compressed messages that need decoding

### Connection Won't Establish

**Symptom**: No connection after calling constructor.

**Possible Causes**:

1. **Wrong URL**: Check the protocol (`ws://` vs `wss://`) and port number
2. **Server not running**: Verify the WebSocket server is accessible
3. **Network offline** (browser): `navigator.onLine === false` prevents connection
4. **Max retries exhausted**: After `connection.maxRetries` attempts, `destroy()` is called

**Debug Steps**:
```javascript
const ws = new WebSocketEventsHandler('ws://localhost:8080', {
  debug: true,   // Enable logs
  connection: { maxRetries: 10 }
});
// Look for "Retrying connection in X seconds" logs
```

### Heartbeat Timeout / Frequent Reconnections

**Symptom**: Connection keeps closing and reconnecting.

**Possible Causes**:
- `heartbeat.interval` too short — generates too many pings
- `heartbeat.timeout` too short — doesn't allow for normal latency
- Server doesn't respond with the configured `heartbeat.expectedResponse`
- Network has high latency or packet loss

**Solutions**:
```javascript
// For high-latency networks
const ws = new WebSocketEventsHandler('ws://server.com', {
  heartbeat: {
    interval: 30000,    // Longer interval
    message: 'ping',
    expectedResponse: 'pong',
    timeout: 20000       // Longer timeout
  }
});
```

### "Cannot read property 'send' of null" During Destroy

**Symptom**: Error when calling `destroy()` or during cleanup.

**Status**: ✅ **Fixed** — The library now checks `ws.readyState < 2` before calling `ws.close()`:

```javascript
if (this.#ws && this.#ws.readyState < 2) this.#ws.close();
```

### "navigator is not defined" in Node.js

**Symptom**: `ReferenceError: navigator is not defined`

**Status**: ✅ **Fixed** — The library checks `typeof navigator !== 'undefined'` before accessing `navigator.onLine`:

```javascript
if (typeof navigator !== 'undefined' && !navigator.onLine && this.#useLocalEvents) {
  // Browser offline logic
}
```

### "window is not defined" in Node.js

**Symptom**: `ReferenceError: window is not defined`

**Status**: ✅ **Fixed** — The library checks `typeof window !== 'undefined'` before adding/removing browser listeners:

```javascript
if (typeof window !== 'undefined') {
  window.addEventListener('online', this.#boundHandleOnline);
}
```

### Handler Not Firing

**Symptom**: Registered handler callback is not being invoked.

**Possible Causes**:

1. **Event name mismatch** — Handler names are case-sensitive. `'chat:message'` ≠ `'chat:Message'`
2. **Handler deactivated** — `off()` was called for this event name
3. **Cycle exclusive mode** — If `cycle.exclusive: true`, only the cycle callback runs, not the root callback
4. **Cycle self-destructed** — The cycle completed all its `rounds` and set `cycle = null`
5. **Handler registered after event** — Events sent before handler registration are lost

**Debug Steps**:
```javascript
const ws = new WebSocketEventsHandler('ws://server.com', { debug: true });
ws.on('test:event', (data) => console.log('Received:', data));
// Check logs for "Handler not found for event 'test:event'"
```

### Local Events Not Dispatching

**Symptom**: Events queued offline are never sent.

**Possible Causes**:
- `connection.fallback.localEvents` not set to `true`
- Network never came back online
- `destroy()` was called before dispatch completed
- In Node.js, `navigator.onLine` is not available — offline detection may not work

**Solution**:
```javascript
const ws = new WebSocketEventsHandler('ws://server.com', {
  connection: {
    fallback: {
      localEvents: true,
      localEventsDelay: 2000
    }
  }
});
```

### Memory Leaks

**Symptom**: Application memory usage grows over time.

**Cause**: Not calling `destroy()` on application shutdown, causing listeners and intervals to remain active.

**Solution**: Always call `ws.destroy()` when cleaning up:

```javascript
process.on('SIGINT', () => {
  ws.destroy('Process terminated');
  process.exit(0);
});
```

## Debug Mode

Enable debug mode to see detailed logs of all internal operations:

```javascript
const ws = new WebSocketEventsHandler('ws://server.com', {
  debug: true
});
```

### What Debug Mode Shows

| Event | Log Level | Example Message |
|-------|-----------|----------------|
| Connection | `info` | `Connected to server` |
| Disconnection | `info` | `Connection closed { code: 1006, reason: '' }` |
| Retry | `info` | `Retrying connection in 2 seconds (Attempt 2 of 5)` |
| Heartbeat | `warn` | `No heartbeat expected response, reconnecting...` |
| Message parse error | `warn` | `Failed to parse message data. SyntaxError: ...` |
| Handler not found | `warn` | `Handler not found for event 'unknown:event'` |
| WebSocket error | `error` | `WebSocket Error: Event { type: 'error' }` |
| Network online | `info` | `Network is online. Attempting to reconnect...` |
| Network offline | `info` | `Network is offline. Closing WebSocket connection.` |
| Local events | `info` | `Dispatching local events (1 / 3)...` |
| Max retries | `error` | `Max retry attempts reached. Connection closed permanently.` |

## Known Issues

### No Built-in Payload Validation

The library does not validate incoming payloads. Add validation in your handler callbacks:

```javascript
ws.on('user:create', (data) => {
  if (!data.username || !data.email) {
    console.error('Invalid payload:', data);
    return;
  }
  // Process valid data
});
```

### Single Connection per Instance

Each instance manages exactly one WebSocket connection. For multiple connections, create multiple instances.

### No Middleware Pipeline

There is no built-in middleware chain. See [Middleware & Extension Points](05-middleware.md) for workarounds.

## See Also

- [Error Handling](07-error-handling.md) — Error sources and recovery strategies
- [API Reference](08-api-reference.md) — Full configuration options
- [Debug Mode](#debug-mode) — Verbose logging for troubleshooting