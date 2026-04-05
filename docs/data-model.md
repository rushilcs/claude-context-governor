# Data Model

All entities are stored in a single SQLite database at `${CLAUDE_PLUGIN_DATA}/governor.db`.

## MemoryItem

The primary entity. Each record is an atomic piece of knowledge extracted from a session.

### Schema

```sql
CREATE TABLE memory_items (
  id              TEXT PRIMARY KEY,  -- UUID v4
  category        TEXT NOT NULL,     -- decision | constraint | convention | bug-lesson
                                     -- (experimental: open-question | command-recipe | work-in-progress)
  content         TEXT NOT NULL,     -- The memory itself, plain text, 1-3 sentences
  rationale       TEXT NOT NULL,     -- Why this was captured (pattern match description)
  memory_source   TEXT NOT NULL,     -- transcript | compact_summary | user
  source_session_id TEXT NOT NULL,   -- FK to session_records.session_id
  created_at      TEXT NOT NULL,     -- ISO 8601
  confidence      REAL NOT NULL,     -- 0.0 - 1.0
  last_verified   TEXT NOT NULL,     -- ISO 8601, initially = created_at
  related_files   TEXT DEFAULT '[]', -- JSON array of file paths
  tags            TEXT DEFAULT '[]', -- JSON array of strings
  status          TEXT NOT NULL DEFAULT 'active',
                                     -- active | superseded | expired | rejected | dismissed
  pinned          INTEGER NOT NULL DEFAULT 0,  -- 0 or 1
  dismissed_at    TEXT,              -- ISO 8601 when user dismissed (nullable)
  fingerprint     TEXT NOT NULL,     -- SHA-256 for dedup
  superseded_by   TEXT,              -- ID of newer item (nullable)
  token_estimate  INTEGER NOT NULL,  -- Estimated tokens when serialized
  branch          TEXT,              -- Git branch (nullable, for future use)
  project_dir     TEXT NOT NULL      -- Absolute project directory
);

CREATE INDEX idx_memory_items_project_status ON memory_items(project_dir, status);
CREATE INDEX idx_memory_items_fingerprint ON memory_items(fingerprint);
```

### Field Details

#### category

Core MVP categories (enabled by default):

| Category | Signal | Example |
|----------|--------|---------|
| decision | "decided to", "going with", "chose" | "Decided to use PostgreSQL instead of MySQL for the main database" |
| constraint | "must not", "always", "never" | "Never use ORM for complex queries -- raw SQL only" |
| convention | "convention", "pattern", "we follow" | "All API endpoints follow the /v1/resource/:id pattern" |
| bug-lesson | "root cause", "fixed by", "the issue was" | "Race condition in webhook handler: must acquire lock before processing" |

Experimental categories (behind config flag, disabled by default):

| Category | Why Deferred |
|----------|-------------|
| open-question | Goes stale within hours -- questions get answered |
| command-recipe | Belongs in project docs, not memory |
| work-in-progress | Changes rapidly, becomes misleading when restored |

#### memory_source

| Source | Meaning | Base Confidence |
|--------|---------|----------------|
| transcript | Extracted from raw conversation JSONL by pattern matcher | 0.5 - 0.8 depending on pattern strength |
| compact_summary | Extracted from Claude's compaction summary | 0.6 - 0.85 (Claude already distilled this, higher base) |
| user | Explicitly created or confirmed by user via /memory-manage | 1.0 (user explicitly said this matters) |

#### status

| Status | Meaning | How Set |
|--------|---------|---------|
| active | Available for restore | Default on extraction |
| superseded | Replaced by a newer item | When fingerprint matches newer extraction |
| expired | Aged out (not restored for >30 days) | Automatic via stale-check in Stop hook |
| rejected | Conflicts with project instructions | Set by conflict detector |
| dismissed | Explicitly dismissed by user | Set via /memory-manage |

#### fingerprint

Deterministic hash for dedup and supersession:

```
fingerprint = SHA-256(lowercase(trim(content)) + "|" + category)
```

When a new extraction produces a fingerprint that matches an existing active item:
- If the new item is from the same session: skip (exact duplicate)
- If the new item is from a different session: supersede the older item (newer version wins)

This prevents duplicate memories from accumulating across sessions while allowing natural evolution.

#### pinned

Binary flag, orthogonal to status. A pinned item with status `active` is always included in restore, bypassing the scoring system. It still counts against the token budget.

User sets this via `/memory-manage pin <id>`.

### Example Records

**Decision from transcript**:
```json
{
  "id": "a1b2c3d4-...",
  "category": "decision",
  "content": "Using PostgreSQL for the main database. Chose it over MySQL for JSONB support and better concurrent write handling.",
  "rationale": "Matched pattern: 'chose it over' in assistant message",
  "memory_source": "transcript",
  "source_session_id": "sess-001",
  "created_at": "2026-04-03T14:22:00Z",
  "confidence": 0.8,
  "last_verified": "2026-04-03T14:22:00Z",
  "related_files": ["src/db/connection.ts", "docker-compose.yml"],
  "tags": ["database", "infrastructure"],
  "status": "active",
  "pinned": 0,
  "dismissed_at": null,
  "fingerprint": "e3b0c44298fc1c14...",
  "superseded_by": null,
  "token_estimate": 42,
  "branch": null,
  "project_dir": "/Users/dev/my-project"
}
```

**Constraint from compact_summary, pinned by user**:
```json
{
  "id": "f5e6d7c8-...",
  "category": "constraint",
  "content": "Never use ORM for complex queries. Use raw SQL with parameterized queries only.",
  "rationale": "Matched pattern: 'never use' in compact summary",
  "memory_source": "compact_summary",
  "source_session_id": "sess-002",
  "created_at": "2026-04-01T09:15:00Z",
  "confidence": 0.85,
  "last_verified": "2026-04-04T11:00:00Z",
  "related_files": ["src/db/queries/"],
  "tags": ["database", "sql"],
  "status": "active",
  "pinned": 1,
  "dismissed_at": null,
  "fingerprint": "abc123def456...",
  "superseded_by": null,
  "token_estimate": 28,
  "branch": null,
  "project_dir": "/Users/dev/my-project"
}
```

**Rejected item (conflict with CLAUDE.md)**:
```json
{
  "id": "99887766-...",
  "category": "convention",
  "content": "Use tabs for indentation in all TypeScript files.",
  "rationale": "Matched pattern: 'use tabs' in assistant message",
  "memory_source": "transcript",
  "source_session_id": "sess-003",
  "created_at": "2026-04-04T16:30:00Z",
  "confidence": 0.6,
  "last_verified": "2026-04-04T16:30:00Z",
  "related_files": [],
  "tags": ["style"],
  "status": "rejected",
  "pinned": 0,
  "dismissed_at": null,
  "fingerprint": "def789ghi012...",
  "superseded_by": null,
  "token_estimate": 18,
  "branch": null,
  "project_dir": "/Users/dev/my-project"
}
```

---

## SessionRecord

Tracks each Claude Code session the plugin observes.

```sql
CREATE TABLE session_records (
  session_id          TEXT PRIMARY KEY,
  started_at          TEXT NOT NULL,     -- ISO 8601
  ended_at            TEXT,              -- ISO 8601 (nullable until SessionEnd fires)
  project_dir         TEXT NOT NULL,
  compaction_count    INTEGER NOT NULL DEFAULT 0,
  items_extracted     INTEGER NOT NULL DEFAULT 0,
  items_restored      INTEGER NOT NULL DEFAULT 0,
  last_compact_summary TEXT              -- Latest compact_summary text (nullable)
);
```

---

## ActiveInstructionFile

Tracks which CLAUDE.md and .claude/rules/ files are loaded in the current session. Populated by InstructionsLoaded hook. Used by conflict detection.

```sql
CREATE TABLE active_instruction_files (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id    TEXT NOT NULL,        -- FK to session_records
  file_path     TEXT NOT NULL,        -- Absolute path to instruction file
  memory_type   TEXT NOT NULL,        -- User | Project | Local | Managed
  load_reason   TEXT NOT NULL,        -- session_start | nested_traversal | path_glob_match | include | compact
  loaded_at     TEXT NOT NULL         -- ISO 8601
);

CREATE INDEX idx_active_instructions_session ON active_instruction_files(session_id);
```

---

## AuditEntry

Immutable log of every action the system takes on memory items.

```sql
CREATE TABLE audit_entries (
  id              TEXT PRIMARY KEY,    -- UUID v4
  session_id      TEXT NOT NULL,
  timestamp       TEXT NOT NULL,       -- ISO 8601
  action          TEXT NOT NULL,       -- loaded | skipped | rejected | extracted | conflict-detected
                                       -- | pinned | dismissed | revived | superseded | expired
  memory_item_id  TEXT NOT NULL,       -- FK to memory_items
  reason          TEXT NOT NULL,       -- Human-readable explanation
  token_cost      INTEGER              -- Tokens consumed (for load actions, nullable otherwise)
);

CREATE INDEX idx_audit_entries_session ON audit_entries(session_id);
```

---

## ConflictRecord

Records detected conflicts between memory items and project instructions.

```sql
CREATE TABLE conflict_records (
  id                    TEXT PRIMARY KEY,  -- UUID v4
  memory_item_id        TEXT NOT NULL,     -- FK to memory_items
  conflict_source       TEXT NOT NULL,     -- claude-md | rules | memory-item
  conflict_source_path  TEXT,              -- File path of the conflicting rule (nullable)
  description           TEXT NOT NULL,     -- What the conflict is
  resolution            TEXT NOT NULL,     -- memory-rejected | memory-flagged | unresolved
  detected_at           TEXT NOT NULL      -- ISO 8601
);
```

---

## Configuration

Stored in plugin's `userConfig` (prompted at install) and/or in a config file at `${CLAUDE_PLUGIN_DATA}/config.json`.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| token_budget | number | 2000 | Max tokens for restored memory in SessionStart |
| experimental_categories | boolean | false | Enable open-question, command-recipe, work-in-progress |
| stale_threshold_days | number | 30 | Days after which unreferenced items are marked expired |
| max_items_per_restore | number | 20 | Hard cap on items restored per session |
| extraction_timeout_s | number | 60 | Max seconds for PreCompact extraction |
