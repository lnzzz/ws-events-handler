
# WebSocketEventsHandler

The `WebSocketEventsHandler` class is a comprehensive JavaScript handler for managing WebSocket connections, including automatic reconnection, heartbeat management, event handling, and offline event storage. This class provides robust support for WebSocket applications, ensuring seamless communication even in unstable network environments.

## Features

- **Automatic Reconnection**: Attempts to reconnect with exponential backoff if the connection drops.
- **Heartbeat Support**: Regularly pings the server to maintain connection, with configurable intervals and timeouts.
- **Event Handling**: Allows registration of custom event handlers and triggers them on incoming messages.
- **Local Event Storage**: Caches events when offline and dispatches them once reconnected.
- **Debug Mode**: Logs detailed information about the WebSocket connection and events for troubleshooting.
- **Network Detection**: Listens for network status changes to handle online and offline events.

## Installation

Install this module via npm:

```bash
npm install ws-events-handler
```

## Usage

### Basic Initialization

```javascript
import WebSocketEventsHandler from './WebSocketEventsHandler';

const wsHandler = new WebSocketEventsHandler('ws://your-websocket-url', {
  heartbeat: { 
    interval: 15000, 
    message: 'ping', 
    expectedResponse: 'pong', 
    timeout: 10000 
  },
  connection: { 
    maxRetries: 5, 
    retryDelay: 1000 
  },
  debug: true
});
```

### Configuration Options

- **heartbeat** (object):
  - `interval`: Interval between heartbeats in milliseconds.
  - `message`: Message sent as heartbeat.
  - `expectedResponse`: Expected response from server.
  - `timeout`: Time to wait for a response before reconnecting.
  
- **connection** (object):
  - `maxRetries`: Maximum number of reconnection attempts.
  - `retryDelay`: Delay between reconnection attempts.
  - `fallback.localEvents`: Enable storing events locally when offline.

- **debug** (boolean): Enable verbose logging.

### Event Handling

Register an event handler for a specific event:

```javascript
wsHandler.on('eventName', (data) => {
  console.log('Event received:', data);
});
```

#### Cyclic event handling

Register an event handler for a specific event in cycles.

```javascript
  wsEvents.on('eventName', { 
    cycle: { 
      every: 3,
      exclusive: true,
      once: true,
      callback: (data) => {
        console.log(data);
      }
    },
    callback: (data) => {
      console.log("this won't fire as cycle is configured to be exclusive.")
    }
  })
```

This configuration will fire callback once 3 messages for 'eventName' have arrived.

#### Configuration options for cycles
- `every`: Cycle will be executed every N messages.
- `exclusive`: Cycle will only execute it's internal callback and not the root callback defined in the handler configuration. If false, root callback will be called every time a message arrives to 'eventName'.
- `rounds`: Cycle will run N times and then it will self-destruct.
- `once`: Cycle will run only once. (similar to setting rounds = 1)



Unregister an event:

```javascript
wsHandler.off('eventName');
```

### Sending Events

To send an event with optional payload:

```javascript
wsHandler.send('eventName', { key: 'value' });
```

### Destroying the WebSocket Connection

To clean up resources and close the WebSocket connection:

```javascript
wsHandler.destroy('Reason for destruction');
```

## Methods

- **`on(eventName, config)`**: Registers an event handler.
- **`off(eventName)`**: Unregisters an event handler.
- **`send(eventName, payload)`**: Sends an event with an optional payload.
- **`destroy(reason)`**: Destroys the WebSocket connection and cleans up resources.

## Known Errors and Potential Bugs

The following issues were detected in the current implementation and should be considered before production usage:

1. **`navigator` access in non-browser environments (Node.js)**
   - **Location**: `WebSocketEventsHandler.send()`
   - **Issue**: `navigator` is referenced without a `typeof navigator !== 'undefined'` guard.
   - **Impact**: Can throw `ReferenceError: navigator is not defined` in Node.js.
   - **Workaround**: Guard navigator access with `typeof navigator !== 'undefined'`.

2. **`window` access in non-browser environments (Node.js)**
   - **Location**: `WebSocketEventsHandler.destroy()`
   - **Issue**: `if (window)` is used instead of checking if `window` exists.
   - **Impact**: Can throw `ReferenceError: window is not defined` in Node.js.
   - **Workaround**: Use `if (typeof window !== 'undefined')`.

3. **Listener cleanup mismatch (potential memory leak)**
   - **Location**: `#setupNetworkListeners()` + `destroy()`
   - **Issue**: Listeners are attached with `.bind(...)` but removed with unbound methods.
   - **Impact**: Online/offline listeners may remain active after `destroy()`.
   - **Workaround**: Store bound listener references and remove those exact references.

4. **Unsafe JSON parse path in message handling**
   - **Location**: `#onMessage()`
   - **Issue**: `JSON.parse(event.data)` is executed without `try/catch`.
   - **Impact**: Malformed payloads can break the message loop.
   - **Workaround**: Wrap parse with `try/catch` and fallback safely.

5. **Potential null/undefined WebSocket close call**
   - **Location**: `#handleOffline()`
   - **Issue**: `this.#ws.close()` is called without checking `this.#ws`.
   - **Impact**: Can throw when offline event fires before socket initialization.
   - **Workaround**: Guard with `if (this.#ws)`.

6. **Handler lookup scales linearly**
   - **Location**: `#handlers` + lookups via `.find()` / `.findIndex()`
   - **Issue**: Event handler operations are O(n).
   - **Impact**: Throughput can degrade with many registered handlers.
   - **Workaround**: Replace array-based registry with a `Map` for O(1) average lookups.

## License

This project is licensed under the MIT License.
