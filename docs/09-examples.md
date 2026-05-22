# Examples

## Basic Event Handler Creation

```javascript
wsHandler.on('eventName', (data) => {
  console.log('Event received:', data);
});
```

## WebSocket Server Setup

(Note: This example requires a WebSocket server implementation.)

## Client-Server Communication Pattern

```javascript
// Client (sending event)
wsHandler.send('eventName', { key: 'value' });

// Server (receiving event)
wsServer.on('eventName', (data) => {
  console.log('Event received:', data);
});
```

## Error Handling in Practice

```javascript
try {
  wsHandler.send('eventName', { key: 'value' });
} catch (error) {
  console.error('Error sending event:', error);
}
```
