# claude-context-governor

**Memory governance for Claude Code** — selective, explainable, conflict-checked memory restoration with full audit trail.

> **Validated**: 63 automated tests + [10/10 manual Claude Code scenarios](tests/e2e/evidence/validation-2026-04-05.md) on Claude Code v2.1.78.

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

## Integration with Existing Setups

The plugin is fully self-contained and designed to coexist with your existing Claude Code configuration.

**No file conflicts.** The plugin never writes to your `CLAUDE.md`, `.claude/settings.json`, or `.claude/rules/`. It only reads them (to detect conflicts with extracted memories).

**Hooks don't collide.** Claude Code merges plugin hooks alongside any user-defined hooks in `.claude/settings.json`. Your existing hooks continue to work exactly as before.

**Skills are namespaced.** All slash commands use the `/claude-context-governor:` prefix, so they won't collide with other plugins or user-defined skills.

**Database is isolated.** All data lives in `~/.claude/plugins/data/claude-context-governor-<hash>/governor.db`, managed entirely by the plugin. Multiple projects share the same DB file, scoped by `project_dir`.

**Works alongside Claude's native memory.** Claude Code has its own flat-file memory system (`~/.claude/projects/.../memory/`). The governor operates independently — it injects governed context via `additionalContext` during `SessionStart`. When a memory item was rejected by the governor (because it conflicts with your `CLAUDE.md`), the restored context includes an explicit **Corrections** section instructing Claude to disregard any conflicting native memories. `CLAUDE.md` always wins.

**Multiple plugins.** You can load multiple plugins simultaneously — each `--plugin-dir` flag adds a separate plugin.

## Configuration

Works out of the box with sensible defaults. There is no runtime config file yet — to change these, edit `src/utils/config.ts` and rebuild:

| Setting | Default | Description |
|---------|---------|-------------|
| `tokenBudget` | 2000 | Max tokens for restored memory per session |
| `recencyDays` | 7 | Items older than this score lower (exponential decay) |
| `confidenceThreshold` | 0.3 | Minimum confidence to accept an extracted item |
| `experimentalCategories` | false | Enable open-question, command-recipe, work-in-progress categories |

## Direct Database Access

All data lives in a single SQLite file. The default location is:

```
~/.claude/plugins/data/claude-context-governor-<hash>/governor.db
```

You can query it directly with `sqlite3`:

```bash
# Find your database
DB=$(ls ~/.claude/plugins/data/claude-context-governor-*/governor.db 2>/dev/null | head -1)

# List all active memory items
sqlite3 "$DB" "SELECT id, category, content FROM memory_items WHERE status='active' ORDER BY created_at DESC"

# See what was restored in the last session
sqlite3 "$DB" "SELECT action, reason FROM audit_entries WHERE session_id = (SELECT session_id FROM sessions ORDER BY started_at DESC LIMIT 1) AND action IN ('loaded','skipped') ORDER BY timestamp"

# Show conflict history
sqlite3 "$DB" "SELECT mi.content, cr.description, cr.resolution FROM conflict_records cr JOIN memory_items mi ON cr.memory_item_id = mi.id ORDER BY cr.detected_at DESC LIMIT 10"

# Count items by status
sqlite3 "$DB" "SELECT status, COUNT(*) FROM memory_items GROUP BY status"

# Count items by category (active only)
sqlite3 "$DB" "SELECT category, COUNT(*) FROM memory_items WHERE status='active' GROUP BY category"

# View all sessions
sqlite3 "$DB" "SELECT session_id, started_at, items_extracted, items_restored, compaction_count FROM sessions ORDER BY started_at DESC"

# Full audit trail for a session (replace SESSION_ID)
sqlite3 "$DB" "SELECT timestamp, action, reason FROM audit_entries WHERE session_id='SESSION_ID' ORDER BY timestamp"

# Find pinned items
sqlite3 "$DB" "SELECT id, content FROM memory_items WHERE pinned=1"
```

### Tables

| Table | What it stores |
|-------|---------------|
| `memory_items` | Extracted memories with category, confidence, status, pinned flag |
| `sessions` | Session metadata: start time, extraction/restore counts, compaction count |
| `audit_entries` | Every load, skip, reject, extract, pin, dismiss, revive action |
| `conflict_records` | Detected conflicts: source rule, description, resolution |
| `active_instruction_files` | Which CLAUDE.md / .claude/rules/ files were active per session |

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
| Unit tests | 41 | All passing |
| Simulation tests | 15 | All passing |
| Skill CLI tests | 7 | All passing |
| **Claude Code E2E** | **10 scenarios** | **All passing** |

Live validation produced: **77 memory items**, **52 conflict detections**, **639 audit entries** across **10 sessions**. Full evidence: [validation report](tests/e2e/evidence/validation-2026-04-05.md).

## Development

```bash
npm install
npm run verify    # typecheck + build + test (63 tests from a fresh clone)
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
