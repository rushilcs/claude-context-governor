# claude-context-governor

> **Status**: Early MVP / prototype. All tests pass (61/61 automated + 10/10 manual Claude Code scenarios). See [validation results](tests/e2e/VALIDATION.md).

**Memory governance for Claude Code** — selective, explainable, conflict-checked memory restoration with audit trail.

Claude Code already has memory. But should it remember *everything*? `claude-context-governor` is a Claude Code plugin that extracts structured candidate memories from transcripts and compaction summaries, checks them against project instructions, and restores selected items on session start.

## Quickstart

**Prerequisites**: Node.js >= 18, npm, Claude Code CLI installed and authenticated.

```bash
git clone https://github.com/rushilcs/claude-context-governor.git
cd claude-context-governor
npm install
npm run verify    # typecheck + build + test (61/61 tests)
```

Run the plugin with Claude Code:

```bash
claude --plugin-dir /path/to/claude-context-governor
```

### Available commands

| Command | What it does |
|---------|-------------|
| `npm run verify` | Full validation: typecheck, build, and test (run this first) |
| `npm test` | Build + run all tests |
| `npm run test:fast` | Run tests without rebuilding (requires prior build) |
| `npm run build` | Build hook and skill scripts to `dist/` |
| `npm run typecheck` | TypeScript type checking only |

### What is automated vs manual

| What | Status |
|------|--------|
| Unit tests (39 tests) | Automated, passing |
| Simulation tests (15 tests) | Automated, passing |
| Skill CLI tests (7 tests) | Automated, passing (require build artifacts) |
| Claude Code E2E (10 scenarios) | [Validated 2026-04-05](tests/e2e/evidence/validation-2026-04-05.md) |

Skill CLI tests shell out to compiled scripts in `dist/`. Both `npm test` and `npm run verify` build first, so this works from a fresh clone.

## The Problem

Claude Code loses context after compaction and across sessions. The naive fix — dump everything back in — causes context bloat, stale information, and invisible drift from project rules. There is no built-in mechanism to inspect what context was restored or why, or whether it contradicts your `CLAUDE.md`.

## What This Does

`claude-context-governor` intercepts Claude Code's session and compaction lifecycle to provide **governed memory**:

1. **Capture** — Extracts structured candidate memories from assistant messages in session transcripts and from compaction summaries
2. **Classify** — Categorizes items as decisions, constraints, conventions, or bug lessons
3. **Conflict-check** — Detects contradictions between memory items and your `CLAUDE.md` / `.claude/rules/`
4. **Restore selectively** — Scores items by recency, confidence, and category priority within a token budget
5. **Audit everything** — Every load, skip, and rejection is logged with reasoning and token cost

## Key Differentiator

This is not "persistent memory." This is **memory governance**:

| Feature | Generic Memory | claude-context-governor |
|---------|---------------|------------------------|
| Storage | Save everything | Classify and deduplicate |
| Restore | Dump all items | Score and budget tokens |
| Conflicts | Ignore | Detect and reject/flag |
| Trust | Hope it's right | Prove every decision |
| Control | None | Pin, dismiss, revive |

## How It Works

```
┌─────────────────────────────────────────────────────────┐
│                    Capture Phase                         │
│  PreCompact ──→ Parse transcript ──→ Extract memories   │
│  PostCompact ──→ Parse compact_summary ──→ Extract      │
│  Both ──→ Classify ──→ Fingerprint ──→ Conflict check   │
│  InstructionsLoaded ──→ Track active rules               │
└──────────────────────────┬──────────────────────────────┘
                           │
                     ┌─────▼─────┐
                     │  SQLite   │
                     └─────┬─────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│                    Restore Phase                         │
│  SessionStart ──→ Query items ──→ Score ──→ Budget      │
│  Pinned first ──→ Fill by score ──→ Serialize           │
│  ──→ additionalContext JSON ──→ Claude Code context     │
└─────────────────────────────────────────────────────────┘
```

## Memory Categories

| Category | What it captures | Example |
|----------|-----------------|---------|
| **decision** | Architectural and implementation choices | "Decided to use PostgreSQL for the main database" |
| **constraint** | Hard rules and requirements | "Must always use 2-space indentation" |
| **convention** | Team patterns and standards | "Convention: use kebab-case for API endpoints" |
| **bug-lesson** | Root causes and fixes | "The issue was a race condition in webhook handler" |

## Skills

| Command | Description |
|---------|-------------|
| `/memory-status` | Current item counts by status and category |
| `/memory-audit` | Full audit report: loaded, skipped, rejected, and why |
| `/memory-search` | Query memory items by keyword, category, or status |
| `/memory-manage` | Pin, dismiss, revive, or mark items as stale |

## Conflict Detection

When a candidate memory item contradicts your project rules, the governor's heuristic detector catches it:

```
Memory extracted: "Use tabs for indentation"
  ↓
Conflict detected vs CLAUDE.md: "Always use spaces, never tabs"
  ↓
Item REJECTED — logged in audit trail with full reasoning
```

## Audit Trail

Every decision is traceable:

```markdown
## Summary
- Extracted: 8
- Loaded: 5
- Skipped: 2 (low score / budget full)
- Rejected: 1 (conflict with CLAUDE.md)
- Token cost: 1,847 / 2,000

## Decision Log
| Time     | Action   | Item                          | Reason                    |
|----------|----------|-------------------------------|---------------------------|
| 14:23:01 | loaded   | Use PostgreSQL for storage    | Score: 0.92, decision     |
| 14:23:01 | loaded   | Never use raw SQL queries     | Score: 0.88, constraint   |
| 14:23:01 | skipped  | Working on auth module        | Score: 0.31, budget full  |
| 14:23:01 | rejected | Use tabs for indentation      | Conflicts with CLAUDE.md  |
```

## Configuration

The governor uses sensible defaults. Key settings:

| Setting | Default | Description |
|---------|---------|-------------|
| `tokenBudget` | 2000 | Max tokens for restored memory |
| `recencyDays` | 7 | Items older than this score lower |
| `expirationDays` | 30 | Auto-expire unverified items |
| `experimentalCategories` | false | Enable open-question, command-recipe, work-in-progress |

## Architecture

- **Storage**: SQLite via `better-sqlite3` in `${CLAUDE_PLUGIN_DATA}/governor.db`
- **Hooks**: SessionStart (restore), PreCompact (extract), PostCompact (extract), InstructionsLoaded (rule tracking), Stop (session tracking), SessionEnd (no-op due to timeout)
- **Extraction**: Pattern-based classification from assistant messages in transcripts and from compaction summaries
- **Deduplication**: SHA-256 fingerprint of normalized content + category
- **Conflict detection**: Heuristic keyword overlap + polarity/value-pair analysis against project instruction files

## License

MIT
