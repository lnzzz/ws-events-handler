# Deployment

## Publishing to npm

```bash
# Build and publish
npm publish

# Or for scoped packages
npm publish --access public
```

## Production Checklist

### 1. Use Secure WebSockets (WSS)

```javascript
const ws = new WebSocketEventsHandler('wss://api.example.com', { ... });
```

### 2. Configure Retry Limits

Set realistic retry limits to avoid excessive reconnection attempts:

```javascript
{
  connection: {
    maxRetries: 10,
    retryDelay: 2000
  }
}
```

### 3. Process Management (Node.js)

Use a process manager like PM2:

```bash
npm install -g pm2
pm2 start app.js --name "ws-client"
pm2 save
pm2 startup
```

### 4. Logging and Monitoring

```javascript
const ws = new WebSocketEventsHandler('wss://api.example.com', {
  debug: true  // Enable for production logging
});

// Set custom error handler
ws.onerror = (error) => {
  // Send to monitoring service (Sentry, Datadog, etc.)
};
```

### 5. Scaling

For multiple instances, ensure:
- Each client has a unique ID (use the `mounted` event's ID)
- Offline events are stored per-instance
- Heartbeat intervals are staggered to avoid thundering herd