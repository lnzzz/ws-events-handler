# Examples

## 1. Chat Client

```javascript
import WebSocketEventsHandler from 'ws-events-handler';

const chat = new WebSocketEventsHandler('wss://chat.example.com', {
  heartbeat: { interval: 15000, message: 'ping', expectedResponse: 'pong', timeout: 10000 },
  connection: { maxRetries: 10, retryDelay: 2000 },
  debug: true
});

chat.on('chat:message', (data) => {
  console.log(`${data.payload.user}: ${data.payload.text}`);
});

chat.on('chat:join', (data) => {
  console.log(`${data.payload.user} joined the room`);
});

chat.send('chat:message', { text: 'Hello everyone!', user: 'Alice' });
```

## 2. Cycle / Batch Processing

```javascript
ws.on('analytics:click', {
  cycle: {
    every: 10,             // Batch every 10 clicks
    rounds: 3,             // Run 3 batches, then stop
    exclusive: true,       // Don't fire the root callback
    callback: (payloads) => {
      console.log(`Processing ${payloads.length} clicks:`);
      console.log(payloads);
      // Send batch to analytics service
    }
  },
  callback: (data) => {
    // This won't fire because exclusive: true
  }
});
```

## 3. ACK Configuration

```javascript
ws.on('order:create', {
  callback: (data) => {
    console.log('Order created:', data);
  },
  ack: {
    event: 'order:created-ack',
    originalEvent: true    // Include original payload in ACK
  }
});

// Server receives: ['order:create-ack', { when: ..., id: ..., ...originalPayload }]
```

## 4. Offline Resilience

```javascript
const ws = new WebSocketEventsHandler('ws://server.com', {
  connection: {
    fallback: {
      localEvents: true,
      localEventsDelay: 500  // Dispatch 1 event every 500ms on reconnect
    }
  }
});

// These will be queued if offline, sent on reconnect
ws.send('analytics', { action: 'pageview' });
ws.send('analytics', { action: 'click' });
```

## 5. Complete Node.js Client + Server

```javascript
// server.js
const { WebSocketServer } = require('ws');
const wss = new WebSocketServer({ port: 8080 });
wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    const [event, data] = JSON.parse(raw.toString());
    console.log(`Received: ${event}`, data);
    ws.send(JSON.stringify([`${event}-ack`, { received: true }]));
  });
});

// client.js
const WebSocketEventsHandler = require('ws-events-handler');
const client = new WebSocketEventsHandler('ws://localhost:8080', { debug: true });
client.on('mounted', (data) => console.log('Mounted with ID:', data.id));
client.send('hello', { msg: 'World' });
```

## 6. Browser Usage

```html
<script type="importmap">
{
  "imports": {
    "ws-events-handler": "./node_modules/ws-events-handler/WebSocketEventsHandler.js"
  }
}
</script>
<script type="module">
import WebSocketEventsHandler from 'ws-events-handler';

const ws = new WebSocketEventsHandler('ws://localhost:8080', {
  heartbeat: { interval: 30000, message: 'ping', expectedResponse: 'pong', timeout: 5000 },
  debug: true
});

ws.on('notification', (data) => {
  document.getElementById('notifications').innerHTML += `<div>${data.payload.message}</div>`;
});
</script>
```