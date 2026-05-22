# Event Handling

## Event Types and Classifications

Events in the WS-Events library can be classified based on their purpose or origin. Common event types include:

-   Connection events (e.g., `connect`, `disconnect`)
-   Message events (e.g., `message`)
-   Error events (e.g., `error`)

## Event Payload Structure

The event payload contains the data associated with the event. The structure of the payload depends on the event type.

```javascript
{
  key: 'value',
  data: {},
  message: 'example message'
}
```

## Creating and Emitting Events

To create and emit events, use the `send` method:

```javascript
wsHandler.send('eventName', { key: 'value' });
```

## Event Validation

Before processing events, it is important to validate the event payload to ensure it meets the expected structure and data types.

## Asynchronous Event Processing

Event handlers are typically processed asynchronously to avoid blocking the main thread.

## Event Prioritization (if supported)

(Note: The current implementation does not explicitly support event prioritization.)

## See Also

-   [Core Concepts](02-core-concepts.md)
-   [Handlers](04-handlers.md)
