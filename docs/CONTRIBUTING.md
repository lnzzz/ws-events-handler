# Contributing to WS-Events

We welcome contributions! Here's how to get started.

## Development Setup

```bash
git clone https://github.com/lnzzz/ws-events-handler.git
cd ws-events-handler
npm install
```

## Branch Naming

- `feature/` — New features
- `bugfix/` — Bug fixes
- `hotfix/` — Urgent fixes
- `docs/` — Documentation changes

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add cycle batch processing
fix: handle malformed JSON gracefully
docs: update API reference
test: add cycle unit tests
refactor: migrate handlers to Map
```

## Pull Request Process

1. Create a feature branch
2. Make your changes
3. Run tests: `npm test`
4. Submit a PR with a clear description

## Code Style

- Use `async/await` over raw promises
- Use JSDoc comments for public methods
- Don't mutate event objects
- Follow single-responsibility for handlers
- Use `#` private fields for internal state

## Testing Requirements

- Unit tests for new handlers and utilities
- Integration tests for event flow
- Minimum 70% code coverage
- All existing tests must pass

## Code Review Checklist

- [ ] Error handling implemented
- [ ] Events are immutable
- [ ] No blocking operations in handlers
- [ ] Logging includes context
- [ ] Tests pass
- [ ] No hardcoded values