# claude-context-governor

**Memory governance for Claude Code** — selective, explainable, conflict-checked memory restoration with full audit trail.

> **Validated**: 61/61 automated tests + [10/10 manual Claude Code scenarios](tests/e2e/evidence/validation-2026-04-05.md) on Claude Code v2.1.78.

---

## Why This Exists

Claude Code loses context after compaction and across sessions. Without governance, you get one of two outcomes:

- **Nothing restored** — every session starts cold, repeating decisions you already made
- **Everything restored** — stale information, context bloat, and invisible drift from your project rules

Neither is acceptable. You need Claude to remember the *right* things, reject the *wrong* things, and prove why.

## What It Does

Install the plugin, work normally, and the governor handles the rest:

1. When `/compact` fires, it **extracts** decisions, constraints, conventions, and bug-lessons from your conversation
2. It **checks** each candidate against your `CLAUDE.md` and `.claude/rules/` — contradictions are rejected
3. On your next session start, it **restores** the highest-value items within a token budget
4. Every decision is **audited** — what loaded, what was skipped, what was rejected, and why

Zero configuration required. No cloud. Fully local.

## Install

```bash
git clone https://github.com/rushilcs/claude-context-governor.git
cd claude-context-governor
npm install
npm run build
```

Then start any Claude Code session with the plugin:

```bash
claude --plugin-dir /path/to/claude-context-governor
```

That's it. The governor is now active. Work normally — it captures and restores in the background.

## What You Get

### Governed memory across sessions

Decisions you make in one session carry forward to the next, scored by recency and confidence, within a token budget. Pinned items always restore first.

```
## Restored Memory (claude-context-governor)
3 loaded | 1 skipped | budget: 187/2000 tokens

### Decisions
- [2026-04-05] Use PostgreSQL for the database — JSONB support needed (confidence: 0.8)

### Constraints
- [2026-04-05] Never use ORM for complex queries — raw SQL only (confidence: 0.9, source: compact_summary, pinned)

### Conventions
- [2026-04-05] API endpoints follow /v1/resource/:id pattern (confidence: 0.8, source: compact_summary)
```

### Conflict detection against your project rules

When a memory candidate contradicts your `CLAUDE.md`, the governor catches it:

```
Memory extracted: "Use tabs for indentation"
  ↓
Conflict detected vs CLAUDE.md: "Always use spaces, never tabs"
  ↓
Item REJECTED — logged in audit trail with full reasoning
```

In live validation, the governor detected **52 conflicts** and rejected **25 items** that contradicted project rules.

### Full audit trail

Every decision is traceable. Run `/claude-context-governor:memory-audit` to see exactly what happened:

```
## Summary
- Extracted: 13
- Loaded: 54
- Skipped: 26
- Rejected: 6
- Conflicts detected: 3
- Total token cost: 3968

## Decision Log
| Time     | Action   | Item                              | Reason                    | Tokens |
|----------|----------|-----------------------------------|---------------------------|--------|
| 14:32:01 | loaded   | Use PostgreSQL for storage        | Score: 0.82, decision     | 12     |
| 14:32:01 | loaded   | Pinned: request-id header         | Pinned item restored      | 8      |
| 14:32:01 | skipped  | Working on auth module            | Budget full               | -      |
| 14:32:01 | rejected | Use tabs for indentation          | Conflicts with CLAUDE.md  | -      |
```

### User control over memory lifecycle

You decide what sticks:

```
/claude-context-governor:memory-manage pin dd6fc35a       → Pinned: always restores regardless of score
/claude-context-governor:memory-manage dismiss 2d659226   → Dismissed: removed from future restores
/claude-context-governor:memory-manage revive 2d659226    → Revived: back in the active pool
/claude-context-governor:memory-manage stale 8b44024d     → Expired: soft removal
```

## Skills Reference

Once the plugin is loaded, these skills are available in any Claude Code session:

| Skill | What it does | Example |
|-------|-------------|---------|
| `/claude-context-governor:memory-status` | Item counts, categories, last session, storage size | See active vs rejected vs dismissed breakdown |
| `/claude-context-governor:memory-audit` | Full audit report for a session or project-wide | `/claude-context-governor:memory-audit` or `/claude-context-governor:memory-audit <session-id>` |
| `/claude-context-governor:memory-search` | Query items by keyword, category, or status | `/claude-context-governor:memory-search PostgreSQL` or `/claude-context-governor:memory-search --category=decision` |
| `/claude-context-governor:memory-manage` | Pin, dismiss, revive, or mark items as stale | `/claude-context-governor:memory-manage pin <item-id>` |

## Memory Categories

| Category | What it captures | Example |
|----------|-----------------|---------|
| **decision** | Architectural and implementation choices | "Decided to use PostgreSQL for the main database" |
| **constraint** | Hard rules and requirements | "Must always use 2-space indentation" |
| **convention** | Team patterns and standards | "Convention: use kebab-case for API endpoints" |
| **bug-lesson** | Root causes and fixes | "Race condition in webhook handler: acquire lock first" |

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

The plugin hooks into 6 Claude Code lifecycle events. Capture happens automatically when you `/compact` or when auto-compaction fires. Restore happens automatically on every session start. All data stays in a local SQLite database.

## Configuration

Works out of the box with sensible defaults. There is no runtime config file yet — to change these, edit `src/utils/config.ts` and rebuild:

| Setting | Default | Description |
|---------|---------|-------------|
| `tokenBudget` | 2000 | Max tokens for restored memory per session |
| `recencyDays` | 7 | Items older than this score lower (exponential decay) |
| `confidenceThreshold` | 0.3 | Minimum confidence to accept an extracted item |
| `experimentalCategories` | false | Enable open-question, command-recipe, work-in-progress categories |

## Key Design Decisions

| Aspect | Approach | Why |
|--------|----------|-----|
| **Storage** | SQLite via `better-sqlite3` | Single file, local-first, synchronous for fast hooks |
| **Extraction** | Pattern-based heuristics | Deterministic, fast, no API calls, no LLM cost |
| **Deduplication** | SHA-256 fingerprint | Content + category hash prevents accumulation across sessions |
| **Conflict detection** | Keyword overlap + polarity/value-pair | Catches tabs-vs-spaces, MySQL-vs-PostgreSQL, etc. |
| **Scoring** | Recency + confidence + category priority | Exponential decay keeps context fresh |
| **Trust model** | CLAUDE.md always wins | Project rules are explicit and versioned; extracted memories are heuristic |

## Validation Results

Validated on 2026-04-05, Claude Code v2.1.78, macOS.

| Layer | Tests | Status |
|-------|-------|--------|
| Unit tests | 39 | All passing |
| Simulation tests | 15 | All passing |
| Skill CLI tests | 7 | All passing |
| **Claude Code E2E** | **10 scenarios** | **All passing** |

Live validation produced: **77 memory items**, **52 conflict detections**, **639 audit entries** across **10 sessions**. Full evidence: [validation report](tests/e2e/evidence/validation-2026-04-05.md).

## Development

```bash
npm install
npm run verify    # typecheck + build + test (61/61 from a fresh clone)
npm test          # build + test
npm run test:fast # tests only (skip build, for rapid iteration)
npm run typecheck # TypeScript checking only
npm run build     # build hooks + skills to dist/
```

Prerequisites: Node.js >= 18, npm.

## Status

Early MVP / prototype. The core pipeline works end-to-end and has been validated in real Claude Code sessions. Areas for future improvement:

- Semantic extraction (LLM-based) to complement pattern matching
- FTS5 full-text search across memory items
- Branch-aware memory (schema supports it, not yet wired)
- File-relevance scoring during restore (implemented but not wired into runtime)
- Web dashboard for memory inspection (audit reporter already produces JSON)

## License

MIT
