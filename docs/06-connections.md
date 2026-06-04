# Connection Management

## Connection Lifecycle

### 1. Construction

```javascript
new WebSocketEventsHandler(url, config);
```

The constructor:
- Stores the URL and config
- Sets up network listeners (window.online/offline or NetworkQualityMonitor)
- Calls `#connect()`

### 2. Connecting (`#connect`)

```javascript
#connect() {
  // 1. Check browser online status (skip if offline)
  // 2. Create WebSocket (browser 'ws' or require('ws'))
  // 3. Attach event listeners: open, message, close, error
  // 4. Register internal 'mounted' handler
}
```

### 3. Connected (`#onOpen`)

- Resets `onerror = false`
- Starts heartbeat interval (if enabled)
- Dispatches any queued local events (one-by-one or batched)
- Logs 'Connected to server'

### 4. Disconnected (`#onClose`)

- Logs the close event
- If retry count < maxRetries → calls `#retryConnection()`
- If max retries reached → calls `destroy()`

### 5. Reconnection (`#retryConnection`)

Uses **exponential backoff**:

```javascript
const retryIn = retryDelay * 2 ** (retryCount - 1);
// Attempt 1: 1000ms
// Attempt 2: 2000ms
// Attempt 3: 4000ms
// Attempt 4: 8000ms
// Attempt 5: 16000ms
```

## Heartbeat (`#startHeartbeat`)

```javascript
setInterval(() => {
  if (ws.readyState === 1) {  // OPEN
    ws.send(JSON.stringify(heartbeatMessage));
    setTimeout(() => { ws.close(); }, heartbeatTimeout);
  }
}, heartbeatInterval);
```

If no expected response is received within `heartbeatTimeout`, the connection is closed (triggering reconnect).

## Destroy (`destroy`)

Cleans up everything:
1. Remove window event listeners
2. Detach NetworkQualityMonitor listeners
3. Remove WebSocket event listeners
4. Stop heartbeat
5. Close WebSocket
6. Clear local events dispatch interval
7. Stop NQM monitoring