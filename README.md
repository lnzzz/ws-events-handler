
# WS-Events

Event handler system for managing WebSocket-based event processing and communication

## Table of Contents

- [Getting Started](docs/01-getting-started.md)
- [Core Concepts](docs/02-core-concepts.md)
- [Event Handling](docs/03-event-handling.md)
- [Handlers](docs/04-handlers.md)
- [Middleware](docs/05-middleware.md)
- [Connections](docs/06-connections.md)
- [Error Handling](docs/07-error-handling.md)
- [API Reference](docs/08-api-reference.md)
- [Examples](docs/09-examples.md)
- [Testing](docs/10-testing.md)
- [Advanced Topics](docs/11-advanced-topics.md)
- [Deployment](docs/12-deployment.md)
- [Troubleshooting](docs/13-troubleshooting.md)
- [Contributing](docs/CONTRIBUTING.md)

## Installation

```bash
npm install ws-events-handler
# or
yarn add ws-events-handler
```

## Quick Start

```javascript
import WebSocketEventsHandler from 'ws-events-handler';

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

wsHandler.on('eventName', (data) => {
  console.log('Event received:', data);
});

wsHandler.send('eventName', { key: 'value' });

wsHandler.destroy('Reason for destruction');
```

## Detailed Documentation

For more detailed information, please refer to the [documentation files](docs/).


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

## Cycle Feature

  65| The cycle feature allows you to repeat an event handler a certain number of times or until a specific condition is met.

  66| ### Configuration Options

  67| *   `every`: The number of messages to collect before executing the callback.
  68| *   `rounds`: The number of times to repeat the cycle. If not specified, the cycle will repeat indefinitely.
  69| *   `once`: If true, the cycle will only run once, equivalent to rounds: 1.
  70| *   `exclusive`: If true, the original callback will not be executed, only the cycle callback.
  71| *   `callback`: The callback function to execute at the end of each cycle.

  72| ### Usage Example

  73| ```javascript
  74| ws.on('myEvent', {
  75|   cycle: {
  76|     every: 5,
  77|     rounds: 3,
  78|     callback: (payloads) => {
  79|       console.log('Cycle completed with payloads:', payloads);
  80|     }
  81|   }
  82| });
  83| ```

  84| In this example, the `myEvent` handler will collect 5 payloads, then execute the callback function. This cycle will repeat 3 times.
  85| 
  85| ## Usage
   85| 
   85| ### Basic Initialization
   85| 
   85| ```javascript
   86| import WebSocketEventsHandler from './WebSocketEventsHandler';
   87| 
   88| const wsHandler = new WebSocketEventsHandler('ws://your-websocket-url', {
   89|   heartbeat: { 
   90|     interval: 15000, 
   91|     message: 'ping', 
   92|     expectedResponse: 'pong', 
   93|     timeout: 10000 
   94|   },
   95|   connection: { 
   96|     maxRetries: 5, 
   97|     retryDelay: 1000 
   98|   },
   99|   debug: true
  100| });
  101| ```
  102| 
  103| ### Configuration Options

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

## Resolved Errors and Fixes

The following issues were fixed in the current implementation:

1. **Node.js safety for `navigator` usage**
   - `send()` now checks `typeof navigator !== 'undefined'` before reading `navigator.onLine`.

2. **Node.js safety for `window` usage**
   - `destroy()` now checks `typeof window !== 'undefined'` before removing browser listeners.

3. **Correct listener teardown**
   - Online/offline listeners are now stored as bound references and removed using the same references.
   - Node monitor (`NetworkQualityMonitor`) listeners are explicitly detached on `destroy()`.

4. **Safe message parsing**
   - `#onMessage()` now uses `try/catch` around `JSON.parse(...)` to avoid runtime crashes on malformed data.

5. **Safe WebSocket close on offline**
   - `#handleOffline()` and `destroy()` now guard WebSocket closing with null/state checks.

6. **Improved event handler complexity**
   - Handler storage migrated from array lookups to `Map`, improving average lookup/update complexity from **O(n)** to **O(1)**.

## License

This project is licensed under the MIT License.
