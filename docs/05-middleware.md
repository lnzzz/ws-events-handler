# Middleware

## Current Status

The WS-Events library **does not include built-in middleware support**. There is no middleware chain or interceptor pipeline.

However, you can implement middleware-like behavior using these patterns:

## Pattern 1: Wrapper Functions

```javascript
function withLogging(handler) {
  return (payload) => {
    console.log('[Middleware] Event received:', payload);
    handler(payload);
  };
}

ws.on('myEvent', withLogging((payload) => {
  console.log('Handler:', payload);
}));
```

## Pattern 2: Pre-processing Before Handler

```javascript
ws.on('myEvent', (payload) => {
  // Pre-processing (middleware logic)
  const validated = validatePayload(payload);
  if (!validated) return;
  
  // Actual handler logic
  processPayload(payload);
});
```

## Pattern 3: Event Interception via `onerror`

```javascript
ws.onerror = (error) => {
  console.error('[Global Error Handler]:', error);
  // Log, send alert, etc.
};
```

## Pattern 4: Custom Event Bus Wrapper

```javascript
class EventBusWithMiddleware {
  constructor(wsHandler) {
    this.ws = wsHandler;
    this.middleware = [];
  }
  use(fn) { this.middleware.push(fn); }
  on(event, cb) { this.ws.on(event, (payload) => {
    this.middleware.forEach(mw => mw(payload));
    cb(payload);
  }); }
}
```