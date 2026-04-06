# claude-context-governor

> This file is for **plugin development** — people working on the governor codebase itself.
> End users loading the plugin via `claude --plugin-dir` don't need this file; the plugin reads
> your project's own CLAUDE.md and .claude/rules/ for conflict detection.

## Code style
- Use 2-space indentation (TypeScript/JSON)
- ESM only (`"type": "module"` in package.json)
- Use `node:` prefix for Node.js built-in imports

## Architecture
- All hooks read JSON from stdin, write JSON to stdout
- SQLite database path comes from `CLAUDE_PLUGIN_DATA` env var (set by Claude Code)
- Fallback data dir: `~/.claude-context-governor/`
- Pure functions go in `src/utils/`, `src/extract/`, `src/restore/`, `src/conflict/`
- Side-effecting code (DB, filesystem) goes in `src/store/`, `src/hooks/`, `src/skills/`

## Testing
- `npm test` runs all unit + simulation tests
- Unit tests use in-memory SQLite via `createTestDatabase()`
- Fixtures live in `tests/fixtures/`
- E2E tests require a live Claude Code session (see `tests/e2e/VALIDATION.md`)
