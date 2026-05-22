# Core Concepts

The WS-Events library is built upon several core concepts:

## Event-Driven Architecture

The library follows an event-driven architecture, where components communicate by emitting and subscribing to events. This allows for decoupled and scalable communication between different parts of your application.

## Event Structure and Lifecycle

Events in the WS-Events library have a specific structure:

```javascript
{
  id: 'unique-event-id',
  type: 'event-type',
  timestamp: Date.now(),
  payload: { /* event data */ },
  source: 'client-id',
  metadata: { /* optional metadata */ }
}
```

Events are created, emitted, processed by handlers, and may trigger side effects or new events.

## Handlers and Handler Registry

Handlers are functions that process specific event types. The handler registry is a mechanism for associating handlers with event types.

```javascript
wsHandler.on('eventName', (data) => {
  console.log('Event received:', data);
});
```

## Event Bus/Dispatcher Pattern

The event bus/dispatcher pattern is used to route events to the appropriate handlers. When an event is emitted, the dispatcher finds the registered handlers and invokes them.

## WebSocket Connection Management

The library manages WebSocket connections, including:

-   Automatic reconnection
-   Heartbeat mechanism
-   Connection state tracking
-   Handling disconnections and reconnections

## See Also

-   [Getting Started](01-getting-started.md)
-   [Event Handling](03-event-handling.md)
-   [Handlers](04-handlers.md)
