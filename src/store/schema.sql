CREATE TABLE IF NOT EXISTS memory_items (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK(category IN ('decision','constraint','convention','bug-lesson','open-question','command-recipe','work-in-progress')),
  content TEXT NOT NULL,
  rationale TEXT NOT NULL DEFAULT '',
  memory_source TEXT NOT NULL CHECK(memory_source IN ('transcript','compact_summary','user')),
  source_session_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  last_verified TEXT NOT NULL,
  related_files TEXT NOT NULL DEFAULT '[]',
  tags TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','superseded','expired','rejected','dismissed')),
  pinned INTEGER NOT NULL DEFAULT 0,
  dismissed_at TEXT,
  fingerprint TEXT NOT NULL,
  superseded_by TEXT,
  token_estimate INTEGER NOT NULL DEFAULT 0,
  branch TEXT,
  project_dir TEXT NOT NULL,
  FOREIGN KEY (source_session_id) REFERENCES sessions(session_id),
  FOREIGN KEY (superseded_by) REFERENCES memory_items(id)
);

CREATE INDEX IF NOT EXISTS idx_memory_project_status ON memory_items(project_dir, status);
CREATE INDEX IF NOT EXISTS idx_memory_fingerprint ON memory_items(fingerprint);
CREATE INDEX IF NOT EXISTS idx_memory_category ON memory_items(category);
CREATE INDEX IF NOT EXISTS idx_memory_session ON memory_items(source_session_id);

CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  project_dir TEXT NOT NULL,
  compaction_count INTEGER NOT NULL DEFAULT 0,
  items_extracted INTEGER NOT NULL DEFAULT 0,
  items_restored INTEGER NOT NULL DEFAULT 0,
  last_compact_summary TEXT
);

CREATE TABLE IF NOT EXISTS active_instruction_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  memory_type TEXT NOT NULL,
  load_reason TEXT NOT NULL,
  loaded_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);

CREATE INDEX IF NOT EXISTS idx_instructions_session ON active_instruction_files(session_id);

CREATE TABLE IF NOT EXISTS audit_entries (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('loaded','skipped','rejected','extracted','conflict-detected','pinned','dismissed','revived','superseded','expired')),
  memory_item_id TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  token_cost INTEGER,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id),
  FOREIGN KEY (memory_item_id) REFERENCES memory_items(id)
);

CREATE INDEX IF NOT EXISTS idx_audit_session ON audit_entries(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_item ON audit_entries(memory_item_id);

CREATE TABLE IF NOT EXISTS conflict_records (
  id TEXT PRIMARY KEY,
  memory_item_id TEXT NOT NULL,
  conflict_source TEXT NOT NULL CHECK(conflict_source IN ('claude-md','rules','memory-item')),
  conflict_source_path TEXT,
  description TEXT NOT NULL,
  resolution TEXT NOT NULL CHECK(resolution IN ('memory-rejected','memory-flagged','unresolved')),
  detected_at TEXT NOT NULL,
  FOREIGN KEY (memory_item_id) REFERENCES memory_items(id)
);

CREATE INDEX IF NOT EXISTS idx_conflict_item ON conflict_records(memory_item_id);
