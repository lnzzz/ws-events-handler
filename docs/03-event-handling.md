# Event Handling

## Message Format

The library uses a compact **array of two elements**:

```
[eventName, payload]
```

### Sending

```javascript
ws.send('chat:message', { text: 'Hello', user: 'Alice' });
// Wire format → '["chat:message",{"when":1700000000000,"id":"abc123","payload":{"text":"Hello","user":"Alice"}}]'
```

### Receiving

Incoming messages are parsed and the first element is treated as the event name, the second as the payload. If only one element exists, it is treated as the event name with no payload.

## Event Lifecycle

1. **Message received** → `#onMessage` is triggered
2. **Parse JSON** → `JSON.parse(data)` wrapped in try/catch
3. **Heartbeat check** → If data matches `expectedResponse`, reset timeout and return
4. **Route to handler** → `#onEvent(data)` looks up event name in `#handlers` Map
5. **Skip if off** → If `handler.off === true`, the event is ignored
6. **Process** → `#processHandler()` executes the configured callback

## Skipped Events (off flag)

```javascript
ws.on('myEvent', callback);
ws.off('myEvent');    // Sets handler.off = true
// Future 'myEvent' messages are ignored
```

## Heartbeat Response Handling

If the incoming parsed message equals the `heartbeat.expectedResponse` string, the heartbeat timeout is cleared and the message is **not** forwarded to any handler.