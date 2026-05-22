# API Reference

## Classes

### WebSocketEventsHandler

```javascript
import WebSocketEventsHandler from 'ws-events-handler';

const wsHandler = new WebSocketEventsHandler(url, options);
```

#### Constructor

-   `url` (string): WebSocket server URL.
-   `options` (object): Configuration options.

#### Methods

-   `on(eventName, config)`: Registers an event handler.
-   `off(eventName)`: Unregisters an event handler.
-   `send(eventName, payload)`: Sends an event with an optional payload.
-   `destroy(reason)`: Destroys the WebSocket connection and cleans up resources.

## Events

-   `connect`: Emitted when the WebSocket connection is established.
-   `disconnect`: Emitted when the WebSocket connection is closed.
-   `message`: Emitted when a message is received from the server.
-   `error`: Emitted when an error occurs.

## Configuration Options

-   `heartbeat` (object):
    -   `interval` (number): Interval between heartbeats in milliseconds.
    -   `message` (string): Message sent as heartbeat.
    -   `expectedResponse` (string): Expected response from server.
    -   `timeout` (number): Time to wait for a response before reconnecting.
-   `connection` (object):
    -   `maxRetries` (number): Maximum number of reconnection attempts.
    -   `retryDelay` (number): Delay between reconnection attempts.
-   `debug` (boolean): Enable verbose logging.
