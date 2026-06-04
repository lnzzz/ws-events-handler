# API Reference

## WebSocketEventsHandler

### Constructor

```javascript
new WebSocketEventsHandler(url, options?)
```

Creates a new WebSocketEventsHandler instance, sets up network listeners, and initiates the WebSocket connection.

**Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | `string` | Yes | WebSocket server URL (e.g., `ws://localhost:8080` or `wss://example.com/ws`) |
| `options` | `object` | No | Configuration object (see below) |

**Configuration Options**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `heartbeat` | `object` | `{}` | Heartbeat configuration. Set to `false` to disable. |
| `heartbeat.interval` | `number` | `15000` | Interval between heartbeat messages (ms) |
| `heartbeat.message` | `string` | `'ping'` | Heartbeat message to send |
| `heartbeat.expectedResponse` | `string` | `'pong'` | Expected heartbeat response from server |
| `heartbeat.timeout` | `number` | `10000` | Timeout for expected response before reconnecting (ms) |
| `connection.maxRetries` | `number` | `5` | Maximum reconnection attempts |
| `connection.retryDelay` | `number` | `1000` | Base delay for exponential backoff (ms) |
| `connection.fallback.localEvents` | `boolean` | `false` | Enable offline event storage and dispatch |
| `connection.fallback.localEventsDelay` | `number` | `1000` | Delay between dispatching stored local events (ms) |
| `debug` | `boolean` | `false` | Enable verbose console logging |

### Methods

#### `on(eventName, config)`

Registers an event handler for the specified event name.

**Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `eventName` | `string` | Name of the event to listen for |
| `config` | `function` or `object` | Handler function or configuration object |

**Simple function syntax:**

```javascript
wsHandler.on('eventName', (data) => {
  console.log('Received:', data);
});
```

**Configuration object syntax:**

```javascript
wsHandler.on('eventName', {
  callback: (data) => { /* handler logic */ },
  cycle: {
    every: 5,             // Messages per cycle (required)
    rounds: 3,            // Number of cycles (optional, infinite if omitted)
    once: false,          // Single cycle (shorthand for rounds: 1)
    exclusive: false,     // Skip root callback when true
    callback: (payloads) => { /* batch handler */ }
  },
  ack: {
    event: 'customAck',   // Custom ACK event name (default: '{eventName}-ack')
    originalEvent: false  // Include original payload in ACK
  }
});
```

**Returns:** `void`

#### `off(eventName)`

Deactivates a registered handler. The handler stays in the Map but is skipped during event routing.

**Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `eventName` | `string` | Name of the event handler to deactivate |

**Returns:** `void`

#### `send(eventName, payload?)`

Sends an event to the WebSocket server. If the network is offline and `localEvents` is enabled, the event is queued for later dispatch.

**Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `eventName` | `string` | Yes | Name of the event to send |
| `payload` | `any` | No | Data payload to send with the event |

**Wire format** (sent as JSON):

```javascript
["eventName", {
  when: 1712345678901,
  id: "client-uuid",    // Only if mounted
  payload: { /* data */ }
}]
```

**Returns:** `void`

#### `destroy(reason?)`

Destroys the WebSocket connection and cleans up all resources. Call this when shutting down the application.

**Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `reason` | `string` | No | Reason for destruction (logged in debug mode) |

**Cleanup actions:**
- Removes browser `window` online/offline event listeners
- Removes `NetworkQualityMonitor` listeners (Node.js)
- Removes all WebSocket event listeners (`message`, `open`, `close`, `error`)
- Stops heartbeat interval and timeout
- Closes the WebSocket connection (with safe guard)
- Clears local events dispatch interval
- Stops NetworkQualityMonitor polling

**Returns:** `void`

### Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `onerror` | `function` or `false` | `false` | Custom error handler. Set to a function to override default error logging. Set back to `false` to restore default. |

### Private Methods (Internal)

These methods are private (`#` prefix) and not accessible externally:

| Method | Description |
|--------|-------------|
| `#connect()` | Creates WebSocket connection and attaches listeners |
| `#onOpen` | Handles WebSocket open event (starts heartbeat, dispatches local events) |
| `#onMessage` | Parses incoming messages, intercepts heartbeat responses, routes events |
| `#onClose` | Handles disconnection with retry logic |
| `#onError` | Handles WebSocket errors (delegates to `onerror` if set) |
| `#startHeartbeat()` | Starts ping interval timer |
| `#stopHeartbeat()` | Clears ping interval and timeout |
| `#retryConnection()` | Implements exponential backoff retry |
| `#handleOnline()` | Network online handler (triggers reconnect) |
| `#handleOffline()` | Network offline handler (closes WebSocket) |
| `#processHandler(handler, payload)` | Routes payload to handler logic (ack, cycle, callback) |
| `#processCycle(handler, payload)` | Cycle accumulation and batch callback logic |
| `#sendAck(eventName, ackConfig, payload)` | Sends acknowledgement event |
| `#setupNetworkListeners()` | Sets up browser or Node.js network listeners |
| `#updateHandler(handler, config)` | Updates handler in Map |
| `#handleMounted(data)` | Processes server's `mounted` event (stores client ID) |
| `#log(level, message, payload)` | Conditional debug logging |

## NetworkQualityMonitor

A Node.js-only class used for network status detection. Extends `EventEmitter`.

### Constructor

```javascript
new NetworkQualityMonitor(url?, interval?)
```

**Parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `url` | `string` | `'https://www.google.com'` | URL to ping for connectivity checks |
| `interval` | `number` | `5000` | Check interval in milliseconds |

### Methods

| Method | Description |
|--------|-------------|
| `startMonitoring()` | Starts the periodic network check interval |
| `stopMonitoring()` | Stops the periodic network check interval |
| `checkNetworkQuality()` | Performs a single HTTPS request to check connectivity |

### Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `isOnline` | `boolean` | `true` | Current online/offline status |
| `latency` | `number` or `null` | `null` | Last measured network latency in ms |
| `url` | `string` | `'https://www.google.com'` | URL being polled |
| `interval` | `number` | `5000` | Polling interval in ms |

### Events (EventEmitter)

| Event | Payload | Description |
|-------|---------|-------------|
| `online` | none | Emitted when network becomes available (HTTP 200) |
| `offline` | none | Emitted when network becomes unavailable |
| `quality` | `{ latency: number }` | Emitted with latency measurement when online |

### Internal Method

- `#checkInterval`: Internal `setInterval` reference for polling

## Event Format Specification

### Wire Format (JSON Array)

```javascript
["eventName", {
  when: <number>,           // Unix timestamp (ms) — always present
  id: <string>,             // Client ID — present after 'mounted' event
  payload: <any>            // Event data — present in outgoing events
}]
```

### Handler Config Object

```javascript
{
  callback: (data) => {},    // Root handler callback
  cycle: {                   // Optional: cycle/ batch config
    every: <number>,         // Messages per cycle (required for cycle)
    rounds: <number>,        // Number of cycles (optional)
    once: <boolean>,         // Single cycle (optional)
    exclusive: <boolean>,    // Skip root callback (optional)
    callback: (payloads) => {}  // Cycle batch callback
  },
  ack: {                     // Optional: ACK config
    event: <string>,         // Custom ACK event name (optional)
    originalEvent: <boolean> // Include original payload (optional)
  }
}
```

## See Also

- [Getting Started](01-getting-started.md) — Installation and basic setup
- [Handlers](04-handlers.md) — Detailed handler configuration
- [Examples](09-examples.md) — Runnable code examples