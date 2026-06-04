# Troubleshooting

## Connection Refused

**Symptom:** WebSocket connection fails immediately.
**Causes & Solutions:**
- Server is not running → Start the WebSocket server
- Wrong URL → Verify `ws://` or `wss://` protocol and port
- Firewall blocking → Check network/firewall settings
- CORS → Ensure server allows cross-origin WebSocket connections

## WebSocket Closes Unexpectedly

**Symptom:** Connection drops after some time.
**Causes & Solutions:**
- No heartbeat → Enable heartbeat with reasonable interval
- Server timeout → Configure `heartbeat.interval` to be less than server timeout
- Network instability → Increase `connection.maxRetries`
- Heartbeat response not received → Check `heartbeat.expectedResponse` matches server

## Events Not Being Received

**Symptom:** Handlers don't fire for incoming messages.
**Causes & Solutions:**
- Message format incorrect → Server must send `['eventName', { ... }]` (JSON array)
- Handler is off → Call `on()` again (sets `off = false`)
- JSON parse error → Check for malformed JSON (enable debug mode to see errors)
- Wrong event name → Verify case-sensitive event name match

## Cycle Not Firing

**Symptom:** Cycle callback never executes.
**Causes & Solutions:**
- `every` not set → Cycle requires `every` number
- Not enough messages → Cycle fires only after `every` messages received
- Cycle completed → After `rounds` cycles, the cycle self-destructs (cycle = null)
- Off flag → Check handler wasn't disabled with `off()`

## ACK Not Sent

**Symptom:** No acknowledgment event sent.
**Causes & Solutions:**
- ACK not configured → Add `ack: { event: 'myEvent-ack' }` to handler config
- WebSocket not open → ACK requires an open connection

## Local Events Not Dispatching

**Symptom:** Events queued offline are not sent on reconnect.
**Causes & Solutions:**
- `localEvents` not enabled → Set `connection.fallback.localEvents: true`
- Delay not triggering → Check `localEventsDelay` value
- Events empty → Events are dispatched once; check `#localEvents` array

## NetworkQualityMonitor Issues (Node.js)

**Symptom:** Incorrect online/offline detection in Node.js.
**Causes & Solutions:**
- URL unreachable → Default URL (google.com) may be blocked; configure a custom URL
- Interval too long → Reduce interval for faster detection
- Proxy issues → Ensure HTTP requests can reach the target URL

## Debug Mode

Enable debug logging to see detailed internal state:

```javascript
const ws = new WebSocketEventsHandler('ws://...', { debug: true });
```

This logs:
- Connection status changes
- Heartbeat send/receive
- Local event dispatch
- Handler registration
- Parse errors
- Retry attempts