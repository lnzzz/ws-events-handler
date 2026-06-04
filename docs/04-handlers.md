# Handlers

## Registering a Handler

### Simple callback

```javascript
ws.on('myEvent', (payload) => {
  console.log('Received:', payload);
});
```

### Configuration object

```javascript
ws.on('myEvent', {
  callback: (payload) => { /* do something */ },
  cycle: { ... },       // Optional batch processing
  ack: { event: 'ackEvent', originalEvent: true }  // Optional ACK
});
```

## Handler Internal Structure

When a handler is registered via `on()`, it is stored in the `#handlers` Map as:

```javascript
{
  eventName: 'myEvent',
  config: fn | { callback, cycle?, ack? },
  registeredOn: 1700000000000,
  off: false
}
```

On each event trigger, a `tracking` object is added:

```javascript
tracking: { lastTrigger: Date.now() }
```

## Unregistering a Handler

```javascript
ws.off('myEvent');  // Sets handler.off = true (does NOT remove from Map)
```

The handler remains in the registry (with `off: true`) so it won't be re-created if `on()` is called again — it reuses the existing entry.

## Calling `on()` on an existing handler

If `on()` is called for an already-registered event, the existing handler is **merged** with the new config:

```javascript
const existing = this.#handlers.get(eventName);
this.#handlers.set(eventName, {
  ...existing,         // Preserves registeredOn
  eventName,
  config,
  off: false           // Re-enables if previously off'd
});
```