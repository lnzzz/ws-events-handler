# Deployment

Practical guidance for shipping `ws-events-handler` to production, both in the browser
and on the server side.

## Table of Contents

- [Browser Bundling](#browser-bundling)
- [Node Production](#node-production)
- [Environment Variables](#environment-variables)
- [Reverse Proxy (nginx)](#reverse-proxy-nginx)
- [TLS / WSS](#tls--wss)
- [Health Checks via Heartbeat](#health-checks-via-heartbeat)
- [Load Balancing & Sticky Sessions](#load-balancing--sticky-sessions)
- [Observability](#observability)

---

## Browser Bundling

The library exports CommonJS. Most bundlers handle interop automatically.

### webpack

```javascript
// webpack.config.js
module.exports = {
  resolve: {
    fallback: {
      // ws is a Node-only package; tell webpack to skip it for browser builds.
      ws: false,
      // NetworkQualityMonitor uses Node's https + events modules.
      https: false,
      events: require.resolve('events/')
    }
  }
};
```

### rollup

```javascript
import commonjs from '@rollup/plugin-commonjs';
import nodePolyfills from 'rollup-plugin-polyfill-node';

export default {
  plugins: [commonjs(), nodePolyfills({ include: ['events'] })],
  external: ['ws']        // browser builds don't need it
};
```

### vite

```javascript
export default defineConfig({
  optimizeDeps: { exclude: ['ws'] },
  resolve: { alias: { ws: 'data:text/javascript,export default {}' } }
});
```

> In the browser, the `typeof WebSocket !== 'undefined'` check ensures the native
> WebSocket is used; the `require('ws')` line is dead code.

## Node Production

### Process Manager (pm2)

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'ws-bot',
    script: './bot.js',
    instances: 1,           // ws-events-handler is single-connection
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000,
    env_production: {
      NODE_ENV: 'production',
      WS_URL: 'wss://api.example.com/ws',
      LOG_LEVEL: 'info'
    }
  }]
};
```

```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### systemd

```ini
# /etc/systemd/system/ws-bot.service
[Unit]
Description=ws-events-handler bot
After=network.target

[Service]
Environment=NODE_ENV=production
Environment=WS_URL=wss://api.example.com/ws
ExecStart=/usr/bin/node /srv/ws-bot/bot.js
Restart=on-failure
RestartSec=5
User=ws-bot

[Install]
WantedBy=multi-user.target
```

Since the library calls `destroy('Max retry attempts reached.')` and exits cleanly after
exhausting retries, pairing it with `Restart=on-failure` gives you a self-healing
deployment.

## Environment Variables

The library itself does not read env vars. Conventionally:

| Variable                  | Purpose                                        |
| ------------------------- | ---------------------------------------------- |
| `WS_URL`                  | Target server URL (`wss://...`).               |
| `WS_HEARTBEAT_INTERVAL`   | Override `heartbeat.interval`.                 |
| `WS_HEARTBEAT_TIMEOUT`    | Override `heartbeat.timeout`.                  |
| `WS_MAX_RETRIES`          | Override `connection.maxRetries`.              |
| `WS_RETRY_DELAY`          | Override `connection.retryDelay`.              |
| `LOG_LEVEL`               | If you wire it into your own logger.           |
| `NODE_ENV`                | `production` ⇒ disable `debug: true`.          |

```javascript
require('dotenv').config();

const ws = new WebSocketEventsHandler(process.env.WS_URL, {
  heartbeat: {
    interval: Number(process.env.WS_HEARTBEAT_INTERVAL) || 15000,
    timeout:  Number(process.env.WS_HEARTBEAT_TIMEOUT)  || 10000
  },
  connection: {
    maxRetries: Number(process.env.WS_MAX_RETRIES) || 5,
    retryDelay: Number(process.env.WS_RETRY_DELAY) || 1000
  },
  debug: process.env.NODE_ENV !== 'production'
});
```

## Reverse Proxy (nginx)

WebSocket connections require the `Upgrade` and `Connection` headers to be forwarded:

```nginx
upstream ws_backend {
  server 127.0.0.1:8080;
  keepalive 32;
}

server {
  listen 443 ssl http2;
  server_name api.example.com;

  ssl_certificate     /etc/ssl/certs/api.crt;
  ssl_certificate_key /etc/ssl/private/api.key;

  location /ws {
    proxy_pass http://ws_backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade    $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host       $host;
    proxy_set_header X-Real-IP  $remote_addr;

    # Long-lived: bump these well above your heartbeat interval.
    proxy_read_timeout  3600s;
    proxy_send_timeout  3600s;
  }
}
```

> **Critical:** `proxy_read_timeout` must be larger than `heartbeat.interval`, otherwise
> nginx will close the idle connection just before the next ping.

## TLS / WSS

- Use `wss://` in production. Mixed content (https page + ws connection) is blocked by
  browsers.
- For Node clients, the `ws` package validates the server cert by default; pass
  `{ rejectUnauthorized: false }` to the underlying socket **only** in dev.
- Behind a TLS-terminating proxy (nginx, cloudflare, ELB), the upstream can stay `ws://`
  on the loopback interface.

## Health Checks via Heartbeat

Your reverse proxy / load balancer's TCP health check is not enough — it just checks
that the port is open. Use the heartbeat itself as a liveness signal at the application
layer:

- Configure your server's WS handler to respond to `"ping"` with `"pong"`.
- Configure clients with `heartbeat.timeout` shorter than your acceptable outage SLA.
- If the server crashes, all clients will reconnect within `interval + timeout` ms.

For server-side liveness probes (k8s `livenessProbe`), use a separate HTTP `/healthz`
endpoint — don't conflate it with the WebSocket layer.

## Load Balancing & Sticky Sessions

When multiple WebSocket server instances sit behind a load balancer:

- **Use sticky sessions** if your application stores per-connection state in memory. The
  `id` assigned by the server in the `mounted` event is per-connection; without sticky
  sessions a reconnect will land on a different node with no session.
- **Or externalize state** to Redis / Postgres / etc. and let any node serve any client.

Configure stickiness:

- **nginx:** `ip_hash;` in the upstream block (simple) or the `sticky` directive
  (NGINX Plus).
- **AWS ALB / NLB:** enable target group stickiness, choose duration > your max
  connection lifetime.
- **HAProxy:** `cookie SERVERID insert indirect nocache` + per-server cookies.

## Observability

### Error reporting

```javascript
ws.onerror = (err) => Sentry.captureException(err);
```

### Metrics

Wrap `on`, `send`, `destroy` in a metrics decorator:

```javascript
const Counter = require('prom-client').Counter;
const evIn  = new Counter({ name: 'ws_events_in_total',  help: 'Inbound events',  labelNames: ['name'] });
const evOut = new Counter({ name: 'ws_events_out_total', help: 'Outbound events', labelNames: ['name'] });

const origOn = ws.on.bind(ws);
ws.on = (name, cfg) => origOn(name, {
  ...cfg,
  callback: (p) => { evIn.inc({ name }); return cfg.callback?.(p); }
});

const origSend = ws.send.bind(ws);
ws.send = (name, p) => { evOut.inc({ name }); origSend(name, p); };
```

### Tracing

Inject a request id into every `send()` payload and correlate on the server. The
library's auto-generated `when` and `id` fields give you a free first-class trace
context.

---

See also: [Connections](06-connections.md), [Troubleshooting](13-troubleshooting.md),
[Advanced Topics](11-advanced-topics.md).
