# API Reference

## WebSocketEventsHandler

### `new WebSocketEventsHandler(url, options)`

Creates a new WebSocket handler and connects to the server.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | Yes | WebSocket server URL (ws:// or wss://) |
| `options` | object | No | Configuration object |

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `heartbeat.interval` | number | 15000 | Heartbeat interval in ms |
| `heartbeat.message` | string | 'ping' | Heartbeat message |
| `heartbeat.expectedResponse` | string | 'pong' | Expected response |
| `heartbeat.timeout` | number | 10000 | Timeout in ms |
| `connection.maxRetries` | number | 5 | Max reconnection attempts |
| `connection.retryDelay` | number | 1000 | Initial retry delay (ms) |
| `connection.fallback.localEvents` | boolean | false | Enable offline storage |
| `connection.fallback.localEventsDelay` | number | 1000 | Dispatch delay (ms) |
| `debug` | boolean | false | Enable verbose logging |

### `on(eventName, config)`

Register an event handler.

| Param | Type | Description |
|-------|------|-------------|
| `eventName` | string | Event name |
| `config` | function \| object | Handler function or config object |

Config object can have:
- `callback` (function): Main handler
- `cycle` (object): Cycle/batch processing (see Advanced Topics)
- `ack` (object): Auto-acknowledgment config

### `off(eventName)`

Unregister an event handler (sets `off: true` flag).

### `send(eventName, payload)`

Send an event. If offline and `localEvents` is enabled, queues the event.

### `destroy(reason)`

Destroy the connection and clean up all resources.

### `onerror`

Optional callback property for custom error handling:
```javascript
ws.onerror = (error) => { /* handle */ };
```

## NetworkQualityMonitor

Used internally for Node.js network detection.

```javascript
const nqm = new NetworkQualityMonitor(url, interval);
nqm.on('online', callback);
nqm.on('offline', callback);
nqm.startMonitoring();
nqm.stopMonitoring();
```