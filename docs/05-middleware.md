# Middleware (User-Land Pattern)

> **Note:** `ws-events-handler` does **not** ship a middleware engine. There is no
> `ws.use()` API, no built-in interceptor chain, and no request/response context. This
> document shows how to *emulate* middleware on top of the existing `on(name, config)`
> API.

## Table of Contents

- [Why No Built-in Middleware?](#why-no-built-in-middleware)
- [The `compose` Helper](#the-compose-helper)
- [Common Use Cases](#common-use-cases)
- [Error Handling Inside Wrappers](#error-handling-inside-wrappers)
- [Composing with ACK and Cycle](#composing-with-ack-and-cycle)

---

## Why No Built-in Middleware?

The library favors a minimal surface area: it exposes `on`, `off`, `send`, and
`destroy`, and lets you compose behavior in your application code. This keeps the core
small, predictable, and easy to test.

If you need cross-cutting concerns (logging, validation, auth, metrics, etc.), build a
wrapper function and pass the result as `config.callback`.

## The `compose` Helper

```javascript
// compose(mw1, mw2, mw3)(finalHandler) is equivalent to
//   (payload) => mw1(payload, (p1) => mw2(p1, (p2) => mw3(p2, finalHandler)))
const compose = (...mws) => (final) =>
  mws.reduceRight(
    (next, mw) => (payload) => mw(payload, next),
    final
  );

// A middleware has the signature (payload, next) => any
const logger = (payload, next) => {
  console.log('[in]', payload);
  const result = next(payload);
  console.log('[out]', payload);
  return result;
};

const validate = (payload, next) => {
  if (!payload || typeof payload.id !== 'string') {
    throw new Error('invalid payload, missing id');
  }
  return next(payload);
};

const auth = (payload, next) => {
  if (!payload.token) throw new Error('unauthenticated');
  return next(payload);
};

const handleOrder = (payload) => {
  console.log('order processed', payload.id);
};

ws.on('order:new', {
  callback: compose(logger, validate, auth)(handleOrder)
});
```

Execution order for an incoming `order:new`:

```
incoming
   │
   ▼
 logger ─► validate ─► auth ─► handleOrder
   ▲                                  │
   └─────── (return value flows back) ┘
```

## Common Use Cases

### Logging

```javascript
const logging = (label) => (payload, next) => {
  const t0 = Date.now();
  try {
    return next(payload);
  } finally {
    console.log(`[${label}] took ${Date.now() - t0}ms`);
  }
};

ws.on('search', { callback: compose(logging('search'))(doSearch) });
```

### Schema Validation (with zod / joi)

```javascript
const schema = require('zod').object({ q: require('zod').string() });

const withSchema = (s) => (payload, next) => {
  const parsed = s.safeParse(payload);
  if (!parsed.success) {
    ws.send('error', { source: 'search', issues: parsed.error.issues });
    return;
  }
  return next(parsed.data);
};

ws.on('search', { callback: compose(withSchema(schema))(doSearch) });
```

### Auth Token Check

```javascript
const requireToken = (payload, next) => {
  if (!payload?.token || !verify(payload.token)) {
    ws.send('auth:denied', { reason: 'invalid token' });
    return;
  }
  return next(payload);
};
```

### Rate Limiting (user-land)

```javascript
const throttle = (ms) => {
  let last = 0;
  return (payload, next) => {
    const now = Date.now();
    if (now - last < ms) return;          // drop
    last = now;
    return next(payload);
  };
};

ws.on('mousemove', {
  callback: compose(throttle(100))((p) => render(p))
});
```

## Error Handling Inside Wrappers

Because the library does NOT wrap `config.callback` in a try/catch, an exception inside a
middleware will bubble out and may break subsequent message processing. Catch it at the
boundary:

```javascript
const safe = (payload, next) => {
  try {
    return next(payload);
  } catch (err) {
    console.error('handler error', err);
    ws.send('error:report', { message: err.message, stack: err.stack });
  }
};

ws.on('any', {
  callback: compose(safe, logger, validate)(realHandler)
});
```

Put `safe` **first** so it catches errors from everything downstream.

## Composing with ACK and Cycle

Middleware composes only with `callback`. The `ack` and `cycle` sub-configs are unaware
of it. If you want a middleware-wrapped cycle batch callback:

```javascript
ws.on('metric', {
  cycle: {
    every: 100,
    callback: compose(logging('metric-batch'), safe)((batch) => persistBatch(batch))
  }
});
```

This is a clean way to keep the per-batch logic separate from the per-message logic.

---

See also: [Event Handling](03-event-handling.md), [Error Handling](07-error-handling.md),
**[Cycle Feature](14-cycle-feature.md)**.
