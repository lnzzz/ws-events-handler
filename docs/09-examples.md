# Examples

## Basic Initialization

```javascript
import WebSocketEventsHandler from 'ws-events-handler';

const ws = new WebSocketEventsHandler('ws://localhost:8080', {
  debug: true
});
```

## Minimal Configuration

```javascript
const ws = new WebSocketEventsHandler('ws://localhost:8080');
// All defaults: heartbeat enabled, 5 retries, 1s base delay
```

## Registering Event Handlers

### Simple Callback

```javascript
ws.on('chat:message', (data) => {
  console.log('Message:', data.message);
  console.log('From user:', data.user);
});
```

### Configuration Object

```javascript
ws.on('user:login', {
  callback: (data) => {
    console.log('User logged in:', data.username);
  }
});
```

## Sending Events

```javascript
// Send without payload
ws.send('system:ping');

// Send with payload
ws.send('chat:message', {
  text: 'Hello!',
  user: 'Alice'
});
```

The wire format transmitted over WebSocket:

```javascript
["chat:message", {
  when: 1712345678901,
  id: "abc-123",           // Only if 'mounted' event was received
  payload: { text: "Hello!", user: "Alice" }
}]
```

## Cycle Feature — Batch Processing

### Basic Cycle (Every N Messages)

```javascript
ws.on('telemetry:reading', {
  cycle: {
    every: 10,                 // Collect 10 readings
    rounds: 5,                 // Repeat 5 times (50 total)
    callback: (readings) => {
      const avg = readings.reduce((s, r) => s + r.temperature, 0) / readings.length;
      console.log('Batch average temperature:', avg);
    }
  },
  callback: (reading) => {
    console.log('Real-time reading:', reading.temperature);
  }
});
```

### Exclusive + Once Cycle

```javascript
ws.on('setup:init', {
  cycle: {
    every: 3,
    once: true,
    exclusive: true,
    callback: (messages) => {
      console.log('Initial setup complete with', messages.length, 'messages');
      // messages contains all 3 payloads
    }
  },
  callback: (data) => {
    // This will NOT be called because exclusive: true
  }
});
```

### Infinite Cycle (No Rounds)

```javascript
ws.on('analytics:pageview', {
  cycle: {
    every: 100,               // Batch every 100 pageviews
    exclusive: true,
    callback: (pageviews) => {
      console.log('100 pageviews collected:', pageviews.length);
      sendToAnalyticsService(pageviews);
    }
  }
});
// Runs indefinitely — no rounds limit
```

## ACK Acknowledgment

### Basic ACK

```javascript
ws.on('order:place', {
  ack: {
    event: 'order:placed-ack',   // Custom ACK event name
    originalEvent: true           // Include original payload
  },
  callback: (order) => {
    console.log('Processing order:', order.orderId);
  }
});
```

When server sends `order:place`, the client automatically sends:

```javascript
["order:placed-ack", {
  when: 1712345678901,
  id: "client-uuid",
  orderId: "ORD-123",
  amount: 99.99,
  // ... all other original payload fields
}]
```

### Default ACK Event Name

```javascript
ws.on('data:update', {
  ack: {
    originalEvent: false      // Only send metadata, not payload
  },
  callback: (data) => {
    console.log('Data updated:', data);
  }
});
// ACK event name defaults to 'data:update-ack'
```

## Local Events (Offline Support)

```javascript
const ws = new WebSocketEventsHandler('ws://server.com', {
  connection: {
    fallback: {
      localEvents: true,
      localEventsDelay: 2000    // 2 seconds between each event dispatch
    }
  }
});

// These will be queued if offline
ws.send('analytics:pageview', { page: '/home' });
ws.send('analytics:pageview', { page: '/about' });
ws.send('analytics:pageview', { page: '/contact' });

// On reconnect, dispatched one by one with 2s delay:
// "/home" → (2s) → "/about" → (2s) → "/contact"
```

## Custom Error Handler

```javascript
const ws = new WebSocketEventsHandler('ws://server.com');

ws.onerror = (error) => {
  console.error('Custom error handler:', error.message);
  sendToMonitoringService(error);
};

// To reset to default:
// ws.onerror = false;
```

## Destroy and Cleanup

```javascript
const ws = new WebSocketEventsHandler('ws://server.com');

// Later, when shutting down:
ws.destroy('Application shutting down');
// All listeners removed, heartbeat stopped, WebSocket closed
```

## Node.js Specific Setup

```javascript
// In Node.js, the library uses NetworkQualityMonitor
// No additional configuration needed — it's automatic
const ws = new WebSocketEventsHandler('ws://server.com');

// The NetworkQualityMonitor polls https://www.google.com every 5s
// You can see its activity by enabling debug mode:
const ws = new WebSocketEventsHandler('ws://server.com', {
  debug: true
});
```

## Full Lifecycle Example

```javascript
import WebSocketEventsHandler from 'ws-events-handler';

// Configure the handler
const ws = new WebSocketEventsHandler('ws://server.com', {
  heartbeat: {
    interval: 10000,
    message: 'ping',
    expectedResponse: 'pong',
    timeout: 5000
  },
  connection: {
    maxRetries: 3,
    retryDelay: 2000
  },
  debug: true
});

// Set custom error handler
ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

// Register handlers
ws.on('user:login', (data) => {
  console.log('User logged in:', data.username);
  ws.send('user:online', { userId: data.id });
});

ws.on('chat:message', {
  ack: { event: 'chat:ack', originalEvent: true },
  callback: (data) => {
    console.log(`${data.user}: ${data.text}`);
  }
});

ws.on('telemetry:batch', {
  cycle: {
    every: 5,
    rounds: 10,
    exclusive: true,
    callback: (readings) => {
      const avg = readings.reduce((s, r) => s + r.value, 0) / readings.length;
      console.log('Average telemetry:', avg);
    }
  }
});

ws.on('system:shutdown', (data) => {
  console.log('Server shutting down:', data.reason);
  ws.destroy('Server shutdown');
});
```

## See Also

- [API Reference](08-api-reference.md) — Full method signatures and configuration
- [Handlers](04-handlers.md) — Detailed handler configuration
- [Testing](10-testing.md) — Testing strategies and patterns