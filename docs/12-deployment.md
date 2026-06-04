# Deployment

## Environment Configuration

Use environment variables to configure the library in different environments:

```bash
# WebSocket Server
WS_URL=wss://production-server.com/ws

# Heartbeat
WS_HEARTBEAT_INTERVAL=30000
WS_HEARTBEAT_MESSAGE=ping
WS_HEARTBEAT_EXPECTED_RESPONSE=pong
WS_HEARTBEAT_TIMEOUT=15000

# Connection
WS_MAX_RETRIES=10
WS_RETRY_DELAY=2000

# Local Events
WS_LOCAL_EVENTS=true
WS_LOCAL_EVENTS_DELAY=1000

# Logging
NODE_ENV=production
LOG_LEVEL=error
```

### Loading from .env

```javascript
import 'dotenv/config';
import WebSocketEventsHandler from 'ws-events-handler';

const ws = new WebSocketEventsHandler(process.env.WS_URL, {
  heartbeat: {
    interval: parseInt(process.env.WS_HEARTBEAT_INTERVAL) || 30000,
    message: process.env.WS_HEARTBEAT_MESSAGE || 'ping',
    expectedResponse: process.env.WS_HEARTBEAT_EXPECTED_RESPONSE || 'pong',
    timeout: parseInt(process.env.WS_HEARTBEAT_TIMEOUT) || 15000
  },
  connection: {
    maxRetries: parseInt(process.env.WS_MAX_RETRIES) || 10,
    retryDelay: parseInt(process.env.WS_RETRY_DELAY) || 2000,
    fallback: {
      localEvents: process.env.WS_LOCAL_EVENTS === 'true',
      localEventsDelay: parseInt(process.env.WS_LOCAL_EVENTS_DELAY) || 1000
    }
  },
  debug: process.env.NODE_ENV !== 'production'
});
```

## Production Checklist

- [ ] **Use WSS** — Always use `wss://` (WebSocket Secure) instead of `ws://` in production
- [ ] **Disable debug** — Set `debug: false` in production to avoid verbose console output
- [ ] **Configure retry limits** — Set reasonable `maxRetries` and `retryDelay` to avoid overwhelming the server
- [ ] **Set heartbeat appropriately** — Adjust intervals based on expected network conditions
- [ ] **Enable local events** — If message loss is unacceptable, enable `localEvents: true`
- [ ] **Set custom error handler** — Use `onerror` to route errors to your monitoring system
- [ ] **Handle cleanup** — Call `destroy()` on application shutdown

## Node.js Deployment

### Production Install

```bash
npm install --production
```

### Running the Application

```bash
node index.js
```

### Process Manager (Recommended)

Use a process manager to ensure high availability:

**PM2**:
```bash
npm install -g pm2
pm2 start index.js --name "ws-events-app"
pm2 save
pm2 startup
```

**Forever**:
```bash
npm install -g forever
forever start index.js
```

### Graceful Shutdown

```javascript
process.on('SIGINT', () => {
  console.log('Shutting down...');
  ws.destroy('Process terminated');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down...');
  ws.destroy('Process terminated');
  process.exit(0);
});
```

## Browser Deployment

### Bundling

The library can be bundled with any modern bundler (webpack, rollup, vite, esbuild). The dynamic `require()` for Node.js-specific code (`ws` library, `NetworkQualityMonitor`) is tree-shakeable and will be excluded in browser builds.

```javascript
// webpack.config.js
module.exports = {
  target: 'web',             // Ensures Node.js modules are excluded
  // ...
};
```

### CDN Usage

```html
<script type="module">
  import WebSocketEventsHandler from 'https://cdn.example.com/ws-events-handler.js';

  const ws = new WebSocketEventsHandler('wss://server.com');
  ws.on('message', (data) => console.log(data));
</script>
```

## Monitoring

### Error Monitoring

```javascript
ws.onerror = (error) => {
  // Send to monitoring service (Sentry, DataDog, etc.)
  monitoringService.captureException(error);
};
```

### Network Quality Monitoring

In Node.js, you can listen to `NetworkQualityMonitor` events:

```javascript
// Access is internal, but you can monitor through the debug logs
```

### Health Check Endpoint

```javascript
const http = require('http');

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      wsConnected: ws.readyState === 1,      // Note: #ws is private
      uptime: process.uptime()
    }));
  }
});
```

> **Note**: Since `#ws` is a private field, you may need to expose connection status through a public method or wrapper class.

## Scaling Considerations

### Single Connection per Instance

Each `WebSocketEventsHandler` instance manages **one** WebSocket connection. For multiple connections, create multiple instances:

```javascript
const connections = [
  new WebSocketEventsHandler('wss://server1.com'),
  new WebSocketEventsHandler('wss://server2.com'),
  new WebSocketEventsHandler('wss://server3.com')
];
```

### Horizontal Scaling

For applications running multiple instances:

1. Each instance manages its own WebSocket connection
2. Use Redis or similar pub/sub for cross-instance event sharing
3. Consider sticky sessions if the server tracks client connections

## See Also

- [Advanced Topics](11-advanced-topics.md) — Architecture and performance
- [Error Handling](07-error-handling.md) — Error recovery strategies
- [Getting Started](01-getting-started.md) — Installation and basic setup