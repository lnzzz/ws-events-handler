# Advanced Topics

## NetworkQualityMonitor

In Node.js environments, the library uses `NetworkQualityMonitor` to detect network status changes, since the browser's `window.online`/`offline` events and `navigator.onLine` API are not available.

### How It Works

The monitor extends Node.js `EventEmitter` and periodically polls an HTTPS endpoint:

1. A `setInterval` runs every `interval` ms (default: 5000)
2. Each tick calls `checkNetworkQuality()` which makes an HTTPS GET request
3. If `res.statusCode === 200` → network is online
4. If the request fails (error event) → network is offline
5. Emits `online`/`offline` events only when status **changes**
6. Emits `quality` with `{ latency: number }` on each successful check

```javascript
checkNetworkQuality() {
  const startTime = Date.now();

  https.get(this.url, (res) => {
    const responseTime = Date.now() - startTime;
    const currentlyOnline = res.statusCode === 200;

    if (currentlyOnline !== this.isOnline) {
      this.isOnline = currentlyOnline;
      this.emit(currentlyOnline ? 'online' : 'offline');
    }
    if (this.isOnline) {
      this.latency = responseTime;
      this.emit('quality', { latency: responseTime });
    }
  }).on('error', () => {
    if (this.isOnline !== false) {
      this.isOnline = false;
      this.emit('offline');
    }
  });
}
```

### Custom Configuration

```javascript
const NetworkQualityMonitor = require('./NetworkQualityMonitor');

// Custom URL and interval
const nqm = new NetworkQualityMonitor('https://api.myapp.com/health', 3000);

nqm.on('quality', ({ latency }) => {
  console.log('Network latency:', latency, 'ms');
});

nqm.on('offline', () => {
  console.log('Network is down!');
});

nqm.on('online', () => {
  console.log('Network is back!');
});

// Manual control
nqm.stopMonitoring();
// ... later
nqm.startMonitoring();
```

## Cross-Environment Architecture

The library is designed to work in both **browser** and **Node.js** environments, detecting the runtime at execution time.

### Environment Detection

| Feature | Browser | Node.js |
|---------|---------|---------|
| WebSocket API | Native `WebSocket` global | `require('ws').WebSocket` |
| Network detection | `window.addEventListener('online'/'offline')` | `NetworkQualityMonitor` HTTPS polling |
| Online check | `navigator.onLine` | Not available (fallback: always assumed online) |
| Module system | ESM (import/export) | CommonJS (`require`) with ESM support |

### Code Paths

**WebSocket creation:**
```javascript
if (typeof WebSocket !== 'undefined') {
  this.#ws = new WebSocket(this.#wsUrl);           // Browser
} else {
  const WebSocket = require('ws').WebSocket;
  this.#ws = new WebSocket(this.#wsUrl);            // Node.js
}
```

**Network listener setup:**
```javascript
if (typeof window !== 'undefined') {
  window.addEventListener('online', this.#boundHandleOnline);  // Browser
  window.addEventListener('offline', this.#boundHandleOffline);
} else {
  const nqm = require('./NetworkQualityMonitor.js');
  this.#nqm = new nqm();                                       // Node.js
  this.#nqm.on('online', this.#boundHandleOnline);
  this.#nqm.on('offline', this.#boundHandleOffline);
}
```

**Online check in `send()`:**
```javascript
if (typeof navigator !== 'undefined' && !navigator.onLine && this.#useLocalEvents) {
  // Browser offline — queue event
  this.#localEvents.push(message);
  return;
}
```

## Cycle Feature Deep Dive

### Internal Mechanics

Each cycle maintains three internal tracking fields on the `cycle` config object:

```javascript
cycle.internalMessageCount = 0;     // Messages received in current cycle
cycle.internalCyclePayloads = [];   // Accumulated payloads
cycle.internalRoundCount = 0;       // Completed cycles (only if rounds/once set)
```

### Processing Flow

```
Event arrives → handler found → #processHandler()
  → #processCycle(handler, payload)
    → internalMessageCount++
    → internalCyclePayloads.push(payload)
    → if internalMessageCount === every:
        → internalRoundCount++
        → if rounds and internalRoundCount === rounds:
            → callback(all accumulated payloads)
            → cycle = null (self-destruct)
        → else:
            → callback(current payloads)
            → reset internalMessageCount = 0
            → reset internalCyclePayloads = []
```

### Auto-Destruction

When the cycle reaches its target `rounds`, `handler.config.cycle` is set to `null`. This means:
- No more cycle processing for this handler
- Future events only trigger the root callback (unless exclusive was true)
- The cycle cannot be restarted without re-registering the handler

### Callback Resolution

The cycle callback is resolved with this priority:

```javascript
let callback = (cycle.exclusive) 
  ? cycle.callback 
  : (cycle.callback) 
    ? cycle.callback 
    : handler.config.callback;
```

## Performance Considerations

### O(1) Handler Lookup

Handler storage was migrated from array-based iteration (O(n)) to `Map`-based lookup (O(1)):

```javascript
// Before: O(n) array iteration
this.#handlers.find(h => h.eventName === eventName);

// After: O(1) Map lookup
this.#handlers.get(eventName);
```

### Memory Efficiency

- Single `JSON.parse` per incoming message — no unnecessary serialization
- Handler config objects are stored by reference, not cloned on every event
- Cycle payload arrays accumulate only until `every` is reached, then are cleared

## Memory Management

### The `destroy()` Method

Proper cleanup is essential to prevent memory leaks. `destroy()` ensures:

1. **Listener cleanup**: WebSocket event listeners (`message`, `open`, `close`, `error`) are removed via `removeEventListener`
2. **Network listener cleanup**: Browser `window` listeners use stored bound references (`#boundHandleOnline`, `#boundHandleOffline`) for exact removal
3. **NetworkQualityMonitor cleanup**: Node.js listeners are detached with `nqm.off()` or `nqm.removeListener()`, and polling is stopped with `nqm.stopMonitoring()`
4. **Timer cleanup**: Heartbeat interval, heartbeat timeout, and local events dispatch interval are all cleared
5. **WebSocket cleanup**: Connection is closed with a safe guard (`readyState < 2`)

### Why Bound References Matter

```javascript
// Correct: stored bound reference for later removal
this.#boundHandleOnline = this.#handleOnline.bind(this);
window.addEventListener('online', this.#boundHandleOnline);
// ...
window.removeEventListener('online', this.#boundHandleOnline); // Works!

// Wrong: anonymous function — cannot remove
window.addEventListener('online', () => this.#handleOnline());
// ...
window.removeEventListener('online', /* ??? */); // Can't remove!
```

## Security Considerations

### Input Validation

- All incoming WebSocket data is parsed via `JSON.parse()` inside a `try/catch` block — malformed JSON cannot crash the application
- No automatic execution of callbacks without explicit handler registration via `on()`
- The WebSocket URL is user-provided — validate it before passing to the constructor (ensure correct `ws://` or `wss://` protocol)

### Handler Isolation

Each handler operates in its own scope. An exception in one handler's callback does not prevent other handlers from executing.

## See Also

- [Error Handling](07-error-handling.md) — Error sources and recovery
- [Deployment](12-deployment.md) — Production deployment considerations
- [API Reference](08-api-reference.md) — Full API documentation