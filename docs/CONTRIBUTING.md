# Contributing to WS-Events

Thank you for considering contributing to WS-Events! This document outlines the contribution guidelines to help you get started.

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork:
   ```bash
   git clone https://github.com/your-username/ws-events-handler.git
   ```
3. **Install dependencies**:
   ```bash
   cd ws-events-handler
   npm install
   ```
4. **Create a feature branch** (see branch naming below)

## Branch Naming

Use descriptive branch names with a type prefix:

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feature/` | New features | `feature/cycle-exclusive-mode` |
| `bugfix/` | Bug fixes | `bugfix/navigator-undefined-node` |
| `hotfix/` | Critical/hot fixes | `hotfix/security-parse-fix` |
| `docs/` | Documentation | `docs/api-reference-update` |
| `test/` | Test additions | `test/cycle-unit-tests` |
| `refactor/` | Code refactoring | `refactor/handlers-map-migration` |

## Commit Messages

Use **conventional commits** format:

```bash
feat: add cycle exclusive mode
fix: handle navigator undefined in Node.js
docs: update API reference with all options
test: add cycle integration tests
refactor: migrate handlers storage to Map
chore: update dependencies
```

**Types**: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `style`, `perf`, `ci`

## Pull Request Process

1. **Update documentation** if you change the public API
2. **Add or update tests** to cover your changes
3. **Ensure all tests pass** before submitting
4. **Update the README.md** if needed (new features, configuration changes)
5. **Submit your PR** for review

### PR Template Checklist

- [ ] Code follows existing style conventions
- [ ] JSDoc comments added for new public methods
- [ ] Documentation updated (README.md and/or docs/*.md)
- [ ] Tests added/updated
- [ ] All tests pass
- [ ] No hardcoded values (use configuration)
- [ ] Error handling implemented
- [ ] Events are immutable (no mutation of event objects)
- [ ] No blocking operations (async/await used throughout)
- [ ] Logging includes context

## Code Style

### JavaScript Conventions

- Use **ES6+ syntax**: classes, arrow functions, template literals, destructuring
- Use **private fields** with `#` prefix for internal state
- Use **JSDoc comments** for public methods and API

```javascript
/**
 * Registers an event handler.
 * @param {string} eventName - The name of the event to listen for
 * @param {Function|Object} config - Handler function or configuration object
 * @returns {void}
 */
on(eventName, config) {
  // ...
}
```

- Use **async/await** over callback chains
- Use **try/catch** for all external input parsing (JSON, network data)
- Use **early returns** to reduce nesting

### Naming

| Element | Convention | Example |
|---------|------------|---------|
| Classes | PascalCase | `WebSocketEventsHandler` |
| Files | kebab-case | `event-handler.js` |
| Private fields | camelCase with `#` | `#handlers`, `#wsUrl` |
| Public methods | camelCase | `send()`, `destroy()` |
| Constants | UPPER_SNAKE_CASE | `MAX_EVENT_QUEUE_SIZE` |
| Event names | colon-delimited | `'chat:message'`, `'user:login'` |

## Testing Requirements

### Test Coverage

- **Unit tests**: For utility functions, handler callbacks, configuration parsing
- **Integration tests**: For WebSocket event flow, cycle behavior, ACK, reconnection
- **Environment tests**: Both browser and Node.js paths where applicable

### Testing Tools

The project uses (or should use) **Jest** or **Mocha** for testing.

### Test Structure

```
tests/
├── unit/
│   ├── handlers.test.js
│   ├── cycle.test.js
│   └── config.test.js
├── integration/
│   ├── websocket-flow.test.js
│   ├── reconnection.test.js
│   └── local-events.test.js
└── fixtures/
    └── test-server.js
```

### Testing Guidelines

1. **Test both success and failure paths**
2. **Mock WebSocket connections** for integration tests
3. **Test edge cases**: malformed JSON, connection drops, timeout scenarios
4. **Test cycle mechanics**: accumulation, rounds, exclusive mode, self-destruction
5. **Test local events**: queuing, dispatch, delay behavior
6. **Test environment detection**: browser vs Node.js code paths

## Documentation Requirements

- Update relevant `docs/*.md` files for API changes
- Add JSDoc comments to new public methods
- Update `docs/09-examples.md` if adding new features
- Keep `docs/08-api-reference.md` in sync with the actual API

## Questions?

If you have questions about contributing, open an issue on GitHub.

## See Also

- [README.md](../README.md) — Project overview
- [API Reference](08-api-reference.md) — Full API documentation
- [Examples](09-examples.md) — Runnable code examples