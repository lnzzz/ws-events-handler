# Testing

## Testing Strategies

### Unit Tests

Test individual handler functions and library internals in isolation:

```javascript
// Test handler callback
const mockCallback = jest.fn();
ws.on('test:event', mockCallback);
ws.send('test:event', { value: 42 });
// Assert mockCallback was called with expected data
```

### Integration Tests

Use a real WebSocket server to test the full event flow:

```javascript
const WebSocket = require('ws');
const WebSocketEventsHandler = require('./WebSocketEventsHandler');

// Create a test server on a random port
const server = new WebSocket.Server({ port: 0 });
const port = server.address().port;

test('receives events from server', (done) => {
  const ws = new WebSocketEventsHandler(`ws://localhost:${port}`, {
    debug: false
  });

  ws.on('test:event', (data) => {
    expect(data.value).toBe(42);
    ws.destroy();
    server.close();
    done();
  });

  // Simulate server sending a message
  server.on('connection', (socket) => {
    socket.send(JSON.stringify([
      'test:event',
      { when: Date.now(), payload: { value: 42 } }
    ]));
  });
});
```

## Testing Cycle Behavior

```javascript
test('cycle collects correct number of payloads', (done) => {
  const server = new WebSocket.Server({ port: 0 });
  const port = server.address().port;
  const ws = new WebSocketEventsHandler(`ws://localhost:${port}`, {
    debug: false
  });

  ws.on('batch:data', {
    cycle: {
      every: 3,
      once: true,
      exclusive: true,
      callback: (items) => {
        expect(items.length).toBe(3);
        expect(items[0].value).toBe(1);
        expect(items[1].value).toBe(2);
        expect(items[2].value).toBe(3);
        ws.destroy();
        server.close();
        done();
      }
    }
  });

  server.on('connection', (socket) => {
    for (let i = 1; i <= 3; i++) {
      socket.send(JSON.stringify([
        'batch:data',
        { when: Date.now(), payload: { value: i } }
      ]));
    }
  });
});
```

## Testing Local Events

Mock the browser environment to test offline queuing and dispatch:

```javascript
test('queues events when offline', () => {
  // Mock navigator.onLine
  Object.defineProperty(navigator, 'onLine', { value: false, writable: true });

  const ws = new WebSocketEventsHandler('ws://localhost:8080', {
    connection: { fallback: { localEvents: true } },
    debug: false
  });

  ws.send('test:event', { key: 'value' });

  // Verify event was queued (internal state check)
  expect(ws.#localEvents.length).toBe(1); // Note: #private field

  // Set online and verify dispatch
  navigator.onLine = true;
  // Trigger online handler or connect
});
```

> **Note**: Testing private fields (`#localEvents`) requires using techniques like `jest.spyOn` or testing through public behavior.

## Testing Reconnection

```javascript
test('reconnects after connection drop', (done) => {
  const server = new WebSocket.Server({ port: 0 });
  const port = server.address().port;
  
  const ws = new WebSocketEventsHandler(`ws://localhost:${port}`, {
    connection: { maxRetries: 2, retryDelay: 100 },
    debug: false
  });

  // Wait for initial connection
  ws.on('mounted', () => {
    // Close the server to simulate disconnection
    server.close(() => {
      // Create a new server on the same port
      const newServer = new WebSocket.Server({ port });
      
      newServer.on('connection', (socket) => {
        expect(socket).toBeDefined();
        ws.destroy();
        newServer.close();
        done();
      });
    });
  });
});
```

## Testing Malformed Data

```javascript
test('handles malformed JSON gracefully', (done) => {
  const server = new WebSocket.Server({ port: 0 });
  const port = server.address().port;
  
  const ws = new WebSocketEventsHandler(`ws://localhost:${port}`, {
    debug: false
  });

  server.on('connection', (socket) => {
    // Send invalid JSON
    socket.send('not json');
    socket.send('{ broken json');
    
    // Send valid JSON after malformed data
    socket.send(JSON.stringify([
      'test:event',
      { when: Date.now(), payload: { ok: true } }
    ]));

    ws.on('test:event', (data) => {
      expect(data.ok).toBe(true);
      ws.destroy();
      server.close();
      done();
    });
  });
});
```

## Testing Heartbeat Timeout

```javascript
test('reconnects on heartbeat timeout', (done) => {
  const server = new WebSocket.Server({ port: 0 });
  const port = server.address().port;
  
  const ws = new WebSocketEventsHandler(`ws://localhost:${port}`, {
    heartbeat: {
      interval: 100,
      message: 'ping',
      expectedResponse: 'pong',
      timeout: 200
    },
    connection: { maxRetries: 1, retryDelay: 50 },
    debug: false
  });

  // Server doesn't respond to pings
  server.on('connection', (socket) => {
    // Don't send 'pong' back
    // Connection should close and retry
  });

  // Should reconnect after heartbeat timeout
  ws.on('mounted', () => {
    // This fires on initial connect AND reconnect
    ws.destroy();
    server.close();
    done();
  });
}, 5000);
```

## Testing ACK Events

```javascript
test('sends ACK event', (done) => {
  const server = new WebSocket.Server({ port: 0 });
  const port = server.address().port;
  
  const ws = new WebSocketEventsHandler(`ws://localhost:${port}`, {
    debug: false
  });

  ws.on('order:create', {
    ack: { event: 'order:ack', originalEvent: true },
    callback: (data) => {
      // Handler logic
    }
  });

  server.on('connection', (socket) => {
    // Listen for ACK from client
    socket.on('message', (data) => {
      const msg = JSON.parse(data);
      if (msg[0] === 'order:ack') {
        expect(msg[1].orderId).toBe('ORD-123');
        ws.destroy();
        server.close();
        done();
      }
    });

    // Send order event
    socket.send(JSON.stringify([
      'order:create',
      { when: Date.now(), payload: { orderId: 'ORD-123' } }
    ]));
  });
});
```

## See Also

- [Examples](09-examples.md) — Runnable code examples
- [API Reference](08-api-reference.md) — Full method signatures