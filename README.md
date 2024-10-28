
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
npm install your-module-name
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

## License

This project is licensed under the MIT License.
