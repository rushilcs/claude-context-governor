# Technical Architecture

## System Overview

claude-context-governor is a Claude Code plugin composed of hooks (for automatic capture and restore) and skills (for user-invoked inspection and management). All data is stored locally in SQLite.

## Components

### Hooks (automatic pipeline)

| Hook | Event | Role | Sync/Async | Time Budget |
|------|-------|------|-----------|-------------|
| on-session-start | SessionStart | Restore: query, score, serialize, inject via additionalContext | Sync (critical path) | <3s target |
| on-pre-compact | PreCompact | Capture: read transcript, extract memory items | Async-safe (not user-blocking) | <60s timeout |
| on-post-compact | PostCompact | Capture: extract from compact_summary | Async-safe | <5s |
| on-stop | Stop | Session tracking: ensures session record exists. Turn snapshot and stale-check are planned but not yet implemented. | Async-safe | <2s |
| on-session-end | SessionEnd | No-op. The 1.5s hard timeout prevents meaningful work; all session tracking is handled by other hooks. | Sync (hard timeout) | <1.5s |
| on-instructions-loaded | InstructionsLoaded | Track: record which rule files are active | Async (fire-and-forget) | <100ms |

### Skills (user-invoked)

| Skill | Purpose |
|-------|---------|
| /memory-status | Read-only: item counts, last session, storage size |
| /memory-audit | Read-only: audit report for current/recent sessions |
| /memory-search | Read-only: query items by category, keyword, file, date |
| /memory-manage | Write: pin, dismiss, revive memory items |

### Internal Modules

| Module | Responsibility |
|--------|---------------|
| store/database | SQLite connection, schema init, migrations |
| extract/extractor | Accept text (from assistant messages in transcript, or compact_summary), run pattern extraction |
| extract/classifier | Assign category + confidence |
| extract/fingerprint | Compute SHA-256 fingerprint for dedup |
| extract/patterns | Regex/phrase patterns per category |
| conflict/detector | Check memory candidates against instruction fragments |
| conflict/instruction-parser | Parse CLAUDE.md and .claude/rules/ files into fragments |
| restore/selector | Query + score + budget-constrain memory items |
| restore/scorer | Scoring functions: recency, confidence, category priority. File relevance scoring is implemented but not wired into runtime (see Startup Path section) |
| restore/serializer | Format selected items as structured Markdown |
| audit/logger | Write AuditEntry records |
| audit/reporter | Generate Markdown + JSON reports |
| utils/tokens | Token estimation (~4 chars/token) |
| utils/config | Configuration with defaults |
| utils/transcript | Parse Claude Code transcript JSONL |
| utils/stdin | Read + parse JSON from hook stdin |

## Data Flow

```
                           ┌─────────────────────────────────────────────┐
                           │              CAPTURE PHASE                  │
                           │                                             │
 InstructionsLoaded ──────►│  Record active rule files ──► SQLite        │
                           │                                             │
 PreCompact ──────────────►│  Read transcript (assistant msgs only) ──►  │
                           │  Extract ──► Classify                       │
                           │  ──► Fingerprint ──► Conflict Check ──►     │
                           │  ──► Store in SQLite                        │
                           │                                             │
 PostCompact ─────────────►│  Read compact_summary ──► Extract ──►       │
                           │  Classify ──► Fingerprint ──► Conflict      │
                           │  Check ──► Store in SQLite                  │
                           │                                             │
 Stop ────────────────────►│  Ensure session record ──► SQLite            │
                           │  (snapshot + stale-check: planned, not yet  │
                           │   implemented)                              │
                           │                                             │
 SessionEnd ──────────────►│  No-op (hard 1.5s timeout)                  │
                           └─────────────────────────────────────────────┘

                           ┌─────────────────────────────────────────────┐
                           │              RESTORE PHASE                  │
                           │                                             │
 SessionStart ────────────►│  1. Open SQLite (fast)                      │
                           │  2. Query active + pinned items for cwd     │
                           │  3. Score remaining items                   │
                           │  4. Fill token budget (pinned first)        │
                           │  5. Serialize to Markdown                   │
                           │  6. Log audit entries                       │
                           │  7. Output additionalContext JSON           │
                           │                                             │
                           │  ALL SYNC, target <3s                       │
                           └─────────────────────────────────────────────┘

                           ┌─────────────────────────────────────────────┐
                           │            INSPECTION PHASE                 │
                           │                                             │
 /memory-status ──────────►│  Read from SQLite, format for display       │
 /memory-audit  ──────────►│  Read AuditEntry, generate report           │
 /memory-search ──────────►│  Query MemoryItem, filter, display          │
 /memory-manage ──────────►│  Update pinned/status/dismissed_at          │
                           └─────────────────────────────────────────────┘
```

## Hook Coverage: Evaluated Hooks

### Included in MVP

| Hook | Justification |
|------|--------------|
| SessionStart | Only reliable injection point for restoring memory into Claude's context via additionalContext |
| PreCompact | Access to transcript_path for full extraction before context is compressed |
| PostCompact | Access to compact_summary -- a complementary extraction source already distilled by Claude |
| Stop | Non-blocking point for session tracking. Turn state snapshot and stale-item maintenance are planned for a future milestone. |
| SessionEnd | Registered but currently a no-op due to the hard 1.5s timeout. All meaningful session tracking happens in other hooks. |
| InstructionsLoaded | Tracks which CLAUDE.md and .claude/rules/ files are actually loaded, including conditional rules. Directly feeds conflict detection with authoritative rule set. Lightweight (just record a file path). |

### Evaluated and Deferred

#### CwdChanged -- deferred

Fires when Claude executes `cd` to change directory. Could enable directory-scoped memory (different memories for `src/frontend/` vs `src/backend/`).

**Why deferred**: MVP already captures `project_dir` from SessionStart's `cwd` field, which is sufficient for project-level scoping. Directory-level granularity adds complexity to scoring (need to decide how to weight memories from parent vs child directories) with marginal value for most projects. Note: the scorer has file relevance logic implemented, but it is not wired into runtime because SessionStart input does not provide a recent-files list. File relevance scoring is a post-MVP enhancement.

**When to add**: post-MVP, when supporting multi-project workspaces or monorepo subdirectory scoping.

#### FileChanged -- deferred

Watches specific files for on-disk changes. Could watch CLAUDE.md for mid-session edits.

**Why deferred**: InstructionsLoaded already fires when rule files are loaded or reloaded (including after compaction). FileChanged would be redundant for rule tracking. The only incremental value would be detecting CLAUDE.md edits that haven't triggered a reload yet, which is an edge case. Adding another hook increases maintenance surface with minimal value.

**When to add**: only if a real user need emerges for reacting to specific file changes during a session.

## Startup Path Optimization

The SessionStart hook is the only hook on the user's critical path. Every other hook runs while Claude is processing or after a response.

### What happens on SessionStart (sync, <3s target)

1. Read JSON from stdin (~0ms)
2. Open SQLite connection (~1ms, better-sqlite3 is synchronous)
3. Query: `SELECT * FROM memory_items WHERE project_dir = ? AND (status = 'active' OR pinned = 1)` (~1-5ms with index)
4. Score items in memory (~1ms for hundreds of items)
5. Greedy budget fill (~0ms)
6. Serialize to Markdown (~1ms)
7. Write audit entries (~1-5ms)
8. Output JSON to stdout (~0ms)

Total: well under 3s for any reasonable memory store size. The bottleneck would only appear with thousands of active items, which is unlikely and mitigable with query limits.

### What does NOT happen on SessionStart

- No transcript parsing (happens in PreCompact)
- No extraction (happens in PreCompact/PostCompact)
- No conflict detection (happens at extraction time)
- No stale-item cleanup (deferred to a future milestone)
- No fingerprint computation (happens at extraction time)
- No file system reads beyond SQLite (no transcript reading, no CLAUDE.md reading)

## Storage Design

### SQLite via better-sqlite3

Location: `${CLAUDE_PLUGIN_DATA}/governor.db`

`${CLAUDE_PLUGIN_DATA}` resolves to `~/.claude/plugins/data/claude-context-governor/` and persists across plugin updates.

**Why better-sqlite3**:
- Synchronous API -- no async overhead in hook scripts that need fast I/O
- Single file -- local-first, easy to inspect, backup, or delete
- Queryable -- efficient filtering by category, project_dir, status, confidence
- Indexable -- add indexes as query patterns emerge
- Future: FTS5 for text search without external dependencies

**Schema**: see [data-model.md](data-model.md) for full DDL.

**Indexes** (created at init):
- `idx_memory_items_project_status` on `(project_dir, status)` -- the primary restore query
- `idx_memory_items_fingerprint` on `(fingerprint)` -- dedup lookups
- `idx_audit_entries_session` on `(session_id)` -- audit report queries

## Conflict Detection Design

### Input
- Memory candidate (from extraction pipeline)
- Active instruction files (from InstructionsLoaded records in ActiveInstructionFile table)

### Process

Conflict detection is **heuristic-based**, designed as an MVP safeguard rather than semantic reasoning. It catches common contradictions (polarity inversions, known technology alternatives) but may miss subtle or context-dependent conflicts.

1. Query ActiveInstructionFile for the current session to get file paths (falls back to scanning `CLAUDE.md` and `.claude/rules/*.md` from disk if the table is empty)
2. Read each file from disk, parse into instruction fragments (one per non-empty line/bullet)
3. For each memory candidate, extract keywords (with stop-word filtering) and scan instruction fragments for contradictions:
   - **Polarity conflict**: negation mismatch on overlapping keywords (threshold: keyword overlap >= 0.25). E.g., memory says "use tabs" but instruction says "never use tabs."
   - **Value conflict**: 8 hardcoded technology-alternative pairs (tabs/spaces, MySQL/PostgreSQL, REST/GraphQL, jest/vitest, npm/pnpm, yarn/pnpm, SQL/ORM, monorepo/single-package). Triggered when memory mentions one value and instruction mentions the opposing value.
4. Assign conflict severity:
   - **Hard conflict** (keyword overlap >= 0.4 or any value-pair match): memory item status = `rejected`
   - **Soft conflict** (polarity conflict with overlap 0.25-0.4): memory item remains `active`, ConflictRecord created for user review via /memory-audit

### Principle
CLAUDE.md and .claude/rules/ always win. They are explicit, versioned, team-owned project instructions. Memory items are automatically extracted with imperfect heuristics. When they conflict, the project instructions are authoritative.

## Assumptions vs Confirmed Design

### Confirmed (via M0 spike, 2026-04-05, Claude Code v2.1.78)

- Plugin loads via `--plugin-dir` and appears in /plugin list
- SessionStart additionalContext injection works: Claude sees and references injected text
- transcript_path is readable by hook process: 22-line JSONL, 16KB, no sandboxing issues
- compact_summary is rich structured XML with `<analysis>` and `<summary>` sections (2,664 chars in test)
- All hooks receive documented fields plus bonus fields:
  - SessionStart: `cwd`, `hook_event_name`, `model`, `session_id`, `source`, `transcript_path`
  - PreCompact: `custom_instructions`, `cwd`, `hook_event_name`, `session_id`, `transcript_path`, `trigger`
  - PostCompact: `compact_summary`, `cwd`, `hook_event_name`, `session_id`, `transcript_path`, `trigger`
  - Stop: `cwd`, `hook_event_name`, `last_assistant_message`, `permission_mode`, `session_id`, `stop_hook_active`, `transcript_path`
  - SessionEnd: `cwd`, `hook_event_name`, `reason`, `session_id`, `transcript_path`
- /reload-plugins picks up hooks.json changes without session restart
- Plugin hooks are configured in hooks/hooks.json
- Skills are directories with SKILL.md in skills/
- ${CLAUDE_PLUGIN_DATA} persists across plugin updates

### Not Yet Validated

- InstructionsLoaded: did not fire in spike (CLAUDE.md was in plugin dir, not project root). Will retest in M2. Fallback of reading from disk is available.

### compact_summary XML Structure (discovered in spike)

The compact_summary is NOT plain text. It has predictable XML structure:

```xml
<analysis>
... Claude's internal reasoning about the session ...
</analysis>

<summary>
1. Primary Request and Intent: ...
2. Key Technical Concepts: ...
3. Files and Code Sections: ...
4. Errors and fixes: ...
5. Problem Solving: ...
6. All user messages: ...
7. Pending Tasks: ...
8. Current Work: ...
9. Optional Next Step: ...
</summary>
```

The extractor should parse this XML structure to extract from the `<summary>` section, which is highly structured and maps well to our memory categories:
- "Key Technical Concepts" -> decisions, conventions
- "Errors and fixes" -> bug-lesson
- "Current Work" / "Pending Tasks" -> work-in-progress (experimental category)

### Future Extensions (architecture supports but not built)

- Branch-aware memory: `branch` field exists on MemoryItem, not used in queries
- Semantic search: SQLite FTS5 can be added without schema changes
- LLM-based extraction: extractor interface can accept alternative implementations
- Team sharing: SQLite can be synced via git-tracked export/import
- Web dashboard: audit reporter already produces JSON suitable for rendering
