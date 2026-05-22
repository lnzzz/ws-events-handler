# Getting Started

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn

## Installation

```bash
npm install ws-events-handler
# or
yarn add ws-events-handler
```

## Setup

1.  Create a new JavaScript file (e.g., `index.js`).
2.  Import the `WebSocketEventsHandler` class:

    ```javascript
    import WebSocketEventsHandler from 'ws-events-handler';
    ```
3.  Initialize the `WebSocketEventsHandler` with your WebSocket URL and configuration options:

    ```javascript
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

## Verification

1.  Run your JavaScript file:

    ```bash
    node index.js
    ```
2.  Check the console for connection messages and any errors.

## Next Steps

- Explore the [Core Concepts](02-core-concepts.md) to understand the library's architecture.
- Learn about [Event Handling](03-event-handling.md) to manage WebSocket events.
