# Testing

This guide shows how to test code that uses `ws-events-handler`, covering handler
behavior, the Cycle feature, reconnect logic, and offline buffering. Examples use
[Jest](https://jestjs.io/), but the patterns are runner-agnostic.

## Table of Contents

- [Choosing a Test Runner](#choosing-a-test-runner)
- [Mocking the WebSocket](#mocking-the-websocket)
- [Testing a Handler](#testing-a-handler)
- [Testing Cycle Behavior](#testing-cycle-behavior)
- [Testing Reconnect](#testing-reconnect)
- [Testing Offline Buffer](#testing-offline-buffer)
- [Testing Heartbeat Timeouts](#testing-heartbeat-timeouts)

---

## Choosing a Test Runner

The library has no opinion. We recommend:

- **Jest** — first-class fake timers (`jest.useFakeTimers()`), easy mocking.
- **Mocha + sinon** — equivalent feature set, smaller surface.
- **Vitest** — fast, Jest-compatible API.

Install Jest and a WebSocket mock:

```bash
npm i -D jest mock-socket
```

## Mocking the WebSocket

The library picks the WebSocket implementation at `#connect()` time:

```javascript
if (typeof WebSocket !== 'undefined') {
  this.#ws = new WebSocket(this.#wsUrl);
} else {
  const { WebSocket } = require('ws');
  this.#ws = new WebSocket(this.#wsUrl);
}
```

For tests, the easiest approach is `mock-socket`, which installs a global `WebSocket`
that matches the W3C interface and gives you a server-side `Server` object to drive it.

```javascript
const { Server, WebSocket: MockClient } = require('mock-socket');

beforeEach(() => {
  global.WebSocket = MockClient;   // satisfies the typeof check
});

afterEach(() => {
  delete global.WebSocket;
});
```

Alternative: stub the `ws` module via `jest.mock('ws', () => ({ WebSocket: MyFakeWS }))`.

## Testing a Handler

```javascript
const { Server } = require('mock-socket');
const WebSocketEventsHandler = require('ws-events-handler');

test('handler receives parsed payload', (done) => {
  const url = 'ws://localhost:1234';
  const server = new Server(url);

  server.on('connection', (socket) => {
    // Send an event to the client as soon as it connects
    socket.send(JSON.stringify(['hello', { name: 'world' }]));
  });

  const ws = new WebSocketEventsHandler(url);

  ws.on('hello', {
    callback: (payload) => {
      expect(payload).toEqual({ name: 'world' });
      ws.destroy('test done');
      server.stop(done);
    }
  });
});
```

## Testing Cycle Behavior

```javascript
test('cycle.callback fires every N messages', (done) => {
  const url = 'ws://localhost:1235';
  const server = new Server(url);
  const ws = new WebSocketEventsHandler(url);

  let batches = 0;

  ws.on('tick', {
    cycle: {
      every: 3,
      exclusive: true,
      callback: (batch) => {
        batches++;
        expect(batch.length).toBe(3);
        if (batches === 2) {
          ws.destroy('done');
          server.stop(done);
        }
      }
    }
  });

  server.on('connection', (socket) => {
    for (let i = 0; i < 6; i++) {
      socket.send(JSON.stringify(['tick', i]));
    }
  });
});
```

See **[Cycle Feature](14-cycle-feature.md)** for the exact rules that drive these
expectations (especially the "final round" payload size quirk).

## Testing Reconnect

Use fake timers to skip the exponential backoff delay.

```javascript
jest.useFakeTimers();

test('reconnects with exponential backoff', () => {
  const url = 'ws://localhost:1236';
  let server = new Server(url);

  const ws = new WebSocketEventsHandler(url, {
    connection: { retryDelay: 100, maxRetries: 3 }
  });

  // Kill the server to force a reconnect cycle
  server.stop();
  server.close();

  jest.advanceTimersByTime(100);       // first retry  (100ms)
  jest.advanceTimersByTime(200);       // second retry (200ms)
  jest.advanceTimersByTime(400);       // third retry  (400ms)

  // After 3 failed retries, destroy is called.
  // Assert via a spy on console.error, or wrap ws.destroy beforehand.
});
```

## Testing Offline Buffer

`#send` checks `navigator.onLine`. In Node, `navigator` is undefined for older versions
— so this test is most relevant in jsdom or with a manual shim.

```javascript
/**
 * @jest-environment jsdom
 */
test('events buffered while offline are replayed on reconnect', (done) => {
  const url = 'ws://localhost:1237';
  const server = new Server(url);

  const ws = new WebSocketEventsHandler(url, {
    connection: { fallback: { localEvents: true, localEventsDelay: 0 } }
  });

  // Force offline
  Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });

  ws.send('msg', { hello: 1 });
  ws.send('msg', { hello: 2 });

  // Back online + reconnect handshake
  Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
  window.dispatchEvent(new Event('online'));

  const seen = [];
  server.on('connection', (socket) => {
    socket.on('message', (raw) => {
      seen.push(JSON.parse(raw));
      if (seen.length === 2) {
        expect(seen.map(([n]) => n)).toEqual(['msg', 'msg']);
        ws.destroy('done');
        server.stop(done);
      }
    });
  });
});
```

## Testing Heartbeat Timeouts

```javascript
jest.useFakeTimers();

test('heartbeat timeout triggers close', () => {
  const url = 'ws://localhost:1238';
  const server = new Server(url);
  // Server NEVER replies to "ping"

  const ws = new WebSocketEventsHandler(url, {
    heartbeat: { interval: 100, timeout: 50 }
  });

  jest.advanceTimersByTime(100);  // first ping sent
  jest.advanceTimersByTime(50);   // pong not received → ws.close()

  // Assert the reconnect path was taken (counter incremented, etc.).
});
```

---

See also: [Examples](09-examples.md), **[Cycle Feature](14-cycle-feature.md)**.
