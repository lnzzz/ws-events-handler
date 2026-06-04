# Testing

## Unit Testing Setup

Recommended tools:
- **Jest** or **Mocha** for test runner
- **ws** library for creating test WebSocket servers

## Integration Test Example

```javascript
const { WebSocketServer } = require('ws');
const WebSocketEventsHandler = require('./WebSocketEventsHandler');

describe('WebSocketEventsHandler', () => {
  let server, client;
  
  beforeEach((done) => {
    server = new WebSocketServer({ port: 0 });
    server.on('listening', () => {
      const port = server.address().port;
      client = new WebSocketEventsHandler(`ws://localhost:${port}`);
      server.on('connection', (ws) => {
        done();
      });
    });
  });
  
  afterEach(() => {
    client.destroy();
    server.close();
  });
  
  test('should send and receive messages', (done) => {
    server.on('connection', (ws) => {
      ws.on('message', (raw) => {
        const [event, data] = JSON.parse(raw.toString());
        expect(event).toBe('test');
        expect(data.payload.msg).toBe('hello');
        done();
      });
    });
    client.send('test', { msg: 'hello' });
  });
  
  test('should handle cycles', (done) => {
    let callCount = 0;
    client.on('batch', {
      cycle: { every: 3, rounds: 1, exclusive: true, callback: (payloads) => {
        expect(payloads.length).toBe(3);
        done();
      }}
    });
    client.send('batch', { n: 1 });
    client.send('batch', { n: 2 });
    client.send('batch', { n: 3 });
  });
});
```

## Testing Offline / Local Events

```javascript
test('should queue events when offline', () => {
  // Mock navigator.onLine
  Object.defineProperty(navigator, 'onLine', { value: false });
  
  client.send('offlineTest', { key: 'value' });
  
  // Event should be stored locally
  expect(client.#localEvents.length).toBe(1);
});
```