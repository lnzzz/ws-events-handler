# Handler Development

## Handler Function Signature and Contract

Handlers are functions that process specific event types. The handler function signature is:

```javascript
(data) => { }
```

## Handler Lifecycle

Handlers are registered, invoked when an event of the corresponding type is emitted, and can be unregistered.

## Accessing Event Context

Handlers can access the event context through the `data` parameter:

```javascript
wsHandler.on('eventName', (data) => {
  console.log('Event received:', data);
});
```

## Returning Results and Emitting Side Events

Handlers can return results or emit side events using the `send` method:

```javascript
wsHandler.send('newEventName', { key: 'newValue' });
```

## Handler Registration and Discovery

Handlers are registered using the `on` method:

```javascript
wsHandler.on('eventName', (data) => { });
```

## Handler Isolation and Dependencies

Handlers should be isolated and have minimal dependencies to ensure they are reusable and testable.

## See Also

-   [Event Handling](03-event-handling.md)
-   [Core Concepts](02-core-concepts.md)
