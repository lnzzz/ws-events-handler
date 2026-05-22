# Examples

A collection of complete, runnable recipes that demonstrate the real `ws-events-handler`
API. All snippets use CommonJS `require()` so they run on Node 14+ without bundling.

> Pair these with the tiny echo server in
> [Getting Started → Verifying Locally](01-getting-started.md#verifying-locally).

## Table of Contents

1. [Basic register + send](#1-basic-register--send)
2. [Heartbeat tuning](#2-heartbeat-tuning)
3. [Reconnect with exponential backoff](#3-reconnect-with-exponential-backoff)
4. [Offline buffering & replay](#4-offline-buffering--replay)
5. [ACK request/response pattern](#5-ack-requestresponse-pattern)
6. [Cycle — every-N batching](#6-cycle--every-n-batching)
7. [Cycle — rounds + exclusive](#7-cycle--rounds--exclusive)
8. [Cycle — once](#8-cycle--once)
9. [Custom `onerror` hook (Sentry)](#9-custom-onerror-hook-sentry)
10. [Custom NetworkQualityMonitor URL](#10-custom-networkqualitymonitor-url)
11. [Graceful destroy on SIGINT](#11-graceful-destroy-on-sigint)

---

## 1. Basic register + send

```javascript
const WebSocketEventsHandler = require('ws-events-handler');

const ws = new WebSocketEventsHandler('ws://localhost:8080', { debug: true });

ws.on('chat:message', {
  callback: (msg) => console.log('chat:', msg)
});

ws.send('chat:message', { text: 'hello' });
// Expected console:
//   Connected to server
//   chat: { text: 'hello' }    (echo server)
```

## 2. Heartbeat tuning

```javascript
const ws = new WebSocketEventsHandler('wss://example.com/ws', {
  heartbeat: {
    interval: 5_000,        // ping every 5s
    message: { kind: 'ping' },   // can be an object, not just a string
    expectedResponse: { kind: 'pong' },
    timeout: 3_000          // very aggressive; reconnect fast
  },
  debug: true
});
```

> The message and expected response are compared with deep JSON equality by the server
> side. The client only checks **strict equality after `JSON.parse`** of the inbound
> message against the configured `expectedResponse`.

## 3. Reconnect with exponential backoff

```javascript
const ws = new WebSocketEventsHandler('ws://flaky-host:9000', {
  connection: {
    maxRetries: 10,
    retryDelay: 500    // 0.5s, 1s, 2s, 4s, 8s, 16s, ...
  },
  debug: true
});
```

If the host is down on first connect, you'll see in the logs:

```
Retrying connection in 0.5 seconds (Attempt 1 of 10)
Retrying connection in 1   seconds (Attempt 2 of 10)
Retrying connection in 2   seconds (Attempt 3 of 10)
...
```

## 4. Offline buffering & replay

> Browser-only feature (depends on `navigator.onLine`).

```javascript
const ws = new WebSocketEventsHandler('wss://api.example.com/ws', {
  connection: {
    fallback: {
      localEvents: true,
      localEventsDelay: 200   // replay one buffered event every 200ms
    }
  }
});

// User drafts a message while offline:
ws.send('msg', { body: 'sent while offline' });
//   ws-events-handler logs: "Network is offline. Storing event locally."

// When connectivity returns, the message is replayed automatically.
```

## 5. ACK request/response pattern

```javascript
ws.on('order:create', {
  ack: { event: 'order:create-ack', originalEvent: true },
  callback: (payload) => persistOrder(payload)
});

// Server flow:
//   ① server: ["order:create", { ...order }]
//   ② client autosends: ["order:create-ack", { when, id, ...order }]
//   ③ client callback runs persistOrder(payload)
```

## 6. Cycle — every-N batching

```javascript
ws.on('metric:tick', {
  callback: (p) => console.log('tick', p.value),
  cycle: {
    every: 10,
    callback: (batch) => {
      const avg = batch.reduce((s, x) => s + x.value, 0) / batch.length;
      console.log('avg over 10 ticks:', avg);
    }
  }
});
```

The per-message callback fires for every tick; the cycle callback fires once per 10 ticks.

## 7. Cycle — rounds + exclusive

```javascript
ws.on('frame', {
  callback: () => console.log('this WILL NOT print, cycle.exclusive=true'),
  cycle: {
    every: 24,           // one second of frames at 24fps
    rounds: 5,           // collect for 5 seconds total, then self-destruct
    exclusive: true,
    callback: (batch) => {
      // On the *final* round, batch contains EVERY frame collected (24 * 5 = 120).
      // On earlier rounds, batch contains the most recent 24 frames.
      console.log('frames in batch:', batch.length);
    }
  }
});
```

See **[Cycle Feature](14-cycle-feature.md)** for why the final batch is larger.

## 8. Cycle — once

```javascript
ws.on('boot:complete', {
  cycle: {
    every: 1,
    once: true,           // equivalent to rounds: 1
    exclusive: true,
    callback: ([payload]) => console.log('booted with', payload)
  }
});
```

After one message, the handler's cycle config is set to `null` — the handler itself
remains registered but inert (unless you registered a `callback` outside the cycle).

## 9. Custom `onerror` hook (Sentry)

```javascript
const Sentry = require('@sentry/node');
Sentry.init({ dsn: process.env.SENTRY_DSN });

const ws = new WebSocketEventsHandler('wss://api.example.com/ws');
ws.onerror = (err) => {
  Sentry.captureException(err);
};
```

## 10. Custom NetworkQualityMonitor URL

If `https://www.google.com` is blocked on your network, replace it. The
`WebSocketEventsHandler` constructs the NQM with defaults, so to customize you must use
the NQM directly:

```javascript
const NQM = require('ws-events-handler/NetworkQualityMonitor');

const monitor = new NQM('https://internal.health.example.com/ping', 10_000);

monitor.on('online',  () => console.log('back online'));
monitor.on('offline', () => console.warn('offline'));
monitor.on('quality', ({ latency }) => {
  if (latency > 1000) console.warn('high latency', latency);
});
```

## 11. Graceful destroy on SIGINT

```javascript
const WebSocketEventsHandler = require('ws-events-handler');

const ws = new WebSocketEventsHandler('wss://api.example.com/ws', { debug: true });

ws.on('mounted', () => console.log('ready'));

process.on('SIGINT', () => {
  console.log('shutting down...');
  ws.destroy('SIGINT');
  process.exit(0);
});
```

`ws.destroy()` removes all listeners, stops the heartbeat, stops the NetworkQualityMonitor
and closes the underlying WebSocket — leaving no dangling handles.

---

See also: **[Cycle Feature](14-cycle-feature.md)**, [API Reference](08-api-reference.md),
[Testing](10-testing.md).
