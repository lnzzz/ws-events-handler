# Connection Management

## Connection Lifecycle

The connection lifecycle from initialization to cleanup follows this flow:

```
Constructor → #connect() → WebSocket Open → Heartbeat Start
     │                                                   │
     │                                              [Connection Drops]
     │                                                   │
     │                                            #onClose() fires
     │                                                   │
     │                                      ┌────────────┼────────────┐
     │                                      │ retries    │ max retries│
     │                                      │ remaining  │ exhausted  │
     │                                      ▼            ▼            │
     │                                 #retryConnection()  destroy()  │
     │                                      │                         │
     │                                      ▼                         │
     │                                 #connect()                     │
     │                                      │                         │
     └──────────────────────────────────────┘                         │
                                                                      │
     [Network Offline] ──→ #handleOffline() ──→ Close WebSocket       │
     [Network Online]  ──→ #handleOnline()  ──→ #connect()            │
                                                                      │
     [destroy() called] ──→ Cleanup all listeners, intervals, etc.   │
```

### 1. Initialization (Constructor)

The constructor performs the following steps in order:

1. **Store URL**: Saves the WebSocket URL to `#wsUrl`
2. **Parse config**: Reads all configuration options (heartbeat, connection, debug, local events)
3. **Bind network listeners**: Creates bound references `#boundHandleOnline` and `#boundHandleOffline`
4. **Setup network listeners**: Calls `#setupNetworkListeners()`
5. **Connect**: Calls `#connect()`

### 2. Connection (`#connect`)

```javascript
#connect() {
  // Browser check: bail if offline
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    this.#log('warn', 'Network is offline. Cannot connect to WebSocket server.');
    return;
  }

  // Create WebSocket (browser native API or Node.js 'ws' library)
  if (typeof WebSocket !== 'undefined') {
    this.#ws = new WebSocket(this.#wsUrl);
  } else {
    const WebSocket = require('ws').WebSocket;
    this.#ws = new WebSocket(this.#wsUrl);
  }

  // Attach event listeners
  this.#ws.addEventListener('open', this.#onOpen);
  this.#ws.addEventListener('message', this.#onMessage);
  this.#ws.addEventListener('close', this.#onClose);
  this.#ws.addEventListener('error', this.#onError);

  // Register internal handler for server 'mounted' event
  this.on('mounted', this.#handleMounted.bind(this));
}
```

**Cross-environment detection**:
- **Browser**: Uses the native `WebSocket` global
- **Node.js**: Uses `require('ws').WebSocket` (dynamic require)

### 3. Open (`#onOpen`)

When the WebSocket connection is established:

1. Logs `"Connected to server"`
2. Starts heartbeat interval (if enabled)
3. Dispatches queued local events (if any and if `localEvents` is enabled)

### 4. Close (`#onClose`)

When the WebSocket connection closes:

1. Logs the close event
2. If retry count < max retries → calls `#retryConnection()`
3. If max retries reached → calls `destroy('Max retry attempts reached.')`

### 5. Reconnection (`#retryConnection`)

Uses **exponential backoff** to calculate the delay:

```javascript
const retryIn = this.#connectionRetryDelay * 2 ** (this.#connectionRetryCount - 1);
```

| Attempt | Delay (base: 1000ms) |
|---------|----------------------|
| 1 | 1,000 ms |
| 2 | 2,000 ms |
| 3 | 4,000 ms |
| 4 | 8,000 ms |
| 5 | 16,000 ms |

After the delay, `#connect()` is called again.

### 6. Heartbeat Cycle

While the connection is open:

```
setInterval (every heartbeat.interval ms)
  │
  ├── Send heartbeat message (JSON.stringify)
  ├── Start timeout (heartbeat.timeout ms)
  │     │
  │     ├── Response received → clear timeout
  │     │
  │     └── Timeout reached → close WebSocket → triggers reconnection
```

## Network Listeners

### Browser Environment

Uses `window.addEventListener` for `online` and `offline` events:

```javascript
if (typeof window !== 'undefined') {
  window.addEventListener('online', this.#boundHandleOnline);
  window.addEventListener('offline', this.#boundHandleOffline);
}
```

### Node.js Environment

Uses `NetworkQualityMonitor` which polls an HTTPS URL (default: `https://www.google.com`) every 5 seconds:

```javascript
const NetworkQualityMonitor = require('./NetworkQualityMonitor.js');
this.#nqm = new NetworkQualityMonitor();
this.#nqm.on('online', this.#boundHandleOnline);
this.#nqm.on('offline', this.#boundHandleOffline);
```

### Online Handler

When the network comes back online:

1. Logs `"Network is online. Attempting to reconnect..."`
2. Calls `#connect()` to establish a new WebSocket connection

### Offline Handler

When the network goes offline:

1. Logs `"Network is offline. Closing WebSocket connection."`
2. Clears the local events dispatch interval (if active)
3. Closes the WebSocket (with safe guard: `readyState < 2`)

## Local Events Dispatch

When the connection reopens and local events are queued:

- **With delay**: A `setInterval` dispatches one event every `localEventsDelay` milliseconds
- **Without delay**: Events are dispatched immediately in reverse order via a `for` loop

```javascript
if (this.#localEventsDelay) {
  // Delayed dispatch (one event per interval)
  this.#localEventsDispatchInterval = setInterval(() => {
    const event = this.#localEvents[0];
    this.send(event[0], event[1]);
    this.#localEvents.splice(0, 1);
  }, this.#localEventsDelay);
} else {
  // Immediate dispatch (reverse order)
  for (let i = this.#localEvents.length - 1; i >= 0; i--) {
    const event = this.#localEvents[i];
    this.send(event[0], event[1]);
    this.#localEvents.splice(this.#localEvents.indexOf(event), 1);
  }
}
```

## Cleanup (`destroy`)

Calling `destroy(reason?)` performs:

1. Removes browser `window` online/offline listeners (using stored bound references)
2. Removes `NetworkQualityMonitor` listeners (if in Node.js)
3. Removes all WebSocket event listeners (`message`, `open`, `close`, `error`)
4. Stops heartbeat (clears interval and timeout)
5. Closes WebSocket (with safe guard: `readyState < 2`)
6. Clears local events dispatch interval
7. Stops NetworkQualityMonitor polling
8. Logs destruction reason

## See Also

- [Error Handling](07-error-handling.md) — Error recovery and retry strategies
- [API Reference](08-api-reference.md) — Full configuration options
- [Advanced Topics](11-advanced-topics.md) — NetworkQualityMonitor deep dive