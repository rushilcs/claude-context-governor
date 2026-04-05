# Repo Structure

```
claude-context-governor/
│
├── .claude-plugin/
│   └── plugin.json                     # Plugin manifest: name, version, description, author
│
├── hooks/
│   └── hooks.json                      # Hook event configuration (all 6 MVP hooks)
│
├── skills/
│   ├── memory-status/
│   │   └── SKILL.md                    # /memory-status: show item counts, last session, storage size
│   ├── memory-audit/
│   │   └── SKILL.md                    # /memory-audit: display audit report for recent sessions
│   ├── memory-search/
│   │   └── SKILL.md                    # /memory-search: query items by category, keyword, file, date
│   └── memory-manage/
│       └── SKILL.md                    # /memory-manage: pin, dismiss, revive memory items
│
├── spike/                              # M0 Platform Validation Spike
│   ├── README.md                       # Spike goals, validation checklist, results
│   ├── .claude-plugin/
│   │   └── plugin.json                 # Minimal plugin manifest for spike testing
│   ├── hooks/
│   │   └── hooks.json                  # Minimal hook config (SessionStart, PreCompact, PostCompact)
│   └── scripts/
│       ├── echo-session-start.sh       # Return hardcoded additionalContext
│       ├── read-transcript.sh          # Read transcript_path, log contents to spike/results/
│       ├── capture-compact.sh          # Capture compact_summary, log to spike/results/
│       └── log-instructions-loaded.sh  # Log InstructionsLoaded event data
│
├── src/
│   ├── hooks/                          # Hook handler entry points (compiled to dist/)
│   │   ├── on-session-start.ts         # Restore: query + score + serialize + output
│   │   ├── on-pre-compact.ts           # Capture: read transcript, extract items
│   │   ├── on-post-compact.ts          # Capture: extract from compact_summary
│   │   ├── on-stop.ts                  # Snapshot: save turn state, stale-check
│   │   ├── on-session-end.ts           # Finalize: update session record
│   │   └── on-instructions-loaded.ts   # Track: record active rule files
│   │
│   ├── store/
│   │   ├── database.ts                 # SQLite connection, init, migrations
│   │   └── schema.sql                  # CREATE TABLE statements and indexes
│   │
│   ├── extract/
│   │   ├── extractor.ts                # Accept text from any source, run extraction pipeline
│   │   ├── classifier.ts               # Assign category + confidence with source calibration
│   │   ├── patterns.ts                 # Regex/phrase patterns for core + experimental categories
│   │   └── fingerprint.ts              # SHA-256 fingerprint computation, dedup logic
│   │
│   ├── conflict/
│   │   ├── detector.ts                 # Check candidates against instruction fragments
│   │   └── instruction-parser.ts       # Parse CLAUDE.md and .claude/rules/ into fragments
│   │
│   ├── restore/
│   │   ├── selector.ts                 # Orchestrate: pinned first, then scored fill
│   │   ├── scorer.ts                   # Scoring: recency, confidence, category, file relevance
│   │   └── serializer.ts               # Format items as structured Markdown for injection
│   │
│   ├── audit/
│   │   ├── logger.ts                   # Write AuditEntry records to SQLite
│   │   └── reporter.ts                 # Generate Markdown + JSON audit reports
│   │
│   └── utils/
│       ├── tokens.ts                   # Token estimation (~4 chars/token heuristic)
│       ├── config.ts                   # Read config from ${CLAUDE_PLUGIN_DATA}/config.json
│       ├── transcript.ts               # Parse Claude Code transcript JSONL format
│       └── stdin.ts                    # Read + parse JSON from hook stdin
│
├── tests/
│   ├── fixtures/
│   │   ├── transcripts/                # Sample JSONL transcripts for extraction tests
│   │   ├── compact-summaries/          # Sample compact_summary texts
│   │   ├── claude-md/                  # Sample CLAUDE.md files for conflict tests
│   │   └── rules/                      # Sample .claude/rules/ files
│   │
│   ├── unit/                           # Tier 1: pure function tests (no I/O, no SQLite)
│   │   ├── extractor.test.ts
│   │   ├── classifier.test.ts
│   │   ├── fingerprint.test.ts
│   │   ├── detector.test.ts
│   │   ├── scorer.test.ts
│   │   ├── serializer.test.ts
│   │   └── tokens.test.ts
│   │
│   ├── simulation/                     # Tier 2: hook stdin/stdout with SQLite
│   │   ├── session-start.test.ts       # Seed DB, pipe stdin, assert stdout
│   │   ├── pre-compact.test.ts         # Pipe stdin with transcript, assert DB writes
│   │   ├── post-compact.test.ts        # Pipe stdin with compact_summary, assert DB writes
│   │   └── instructions-loaded.test.ts # Pipe stdin, assert ActiveInstructionFile record
│   │
│   └── e2e/
│       └── VALIDATION.md              # Tier 3: manual validation scenarios for real Claude Code
│
├── docs/                              # Planning documentation (you are here)
│   ├── prd.md
│   ├── architecture.md
│   ├── data-model.md
│   ├── repo-structure.md
│   ├── test-strategy.md
│   ├── mvp-milestones.md
│   ├── risks-and-open-questions.md
│   ├── demo-plan.md
│   └── todo.md
│
├── package.json                       # Dependencies: better-sqlite3, uuid; devDeps: typescript, vitest, tsup
├── tsconfig.json                      # Strict TypeScript, target ES2022, module NodeNext
├── tsup.config.ts                     # Bundle each hook handler as separate entry point
├── vitest.config.ts                   # Test configuration
├── README.md                          # Project overview, installation, status
├── LICENSE                            # MIT
└── .gitignore                         # node_modules, dist, *.db, spike/results/
```

## Directory Rationale

| Directory | Why It Exists |
|-----------|--------------|
| `.claude-plugin/` | Required by Claude Code plugin system. Contains the manifest. |
| `hooks/` | Required by Claude Code. `hooks.json` configures which events trigger which scripts. |
| `skills/` | Required by Claude Code. Each subdirectory with `SKILL.md` becomes an invocable `/command`. |
| `spike/` | M0 validation spike. Self-contained, disposable after validation. Not part of the final plugin. |
| `src/hooks/` | TypeScript entry points for each hook handler. Each compiles to a standalone JS file. |
| `src/store/` | SQLite database layer. Schema and connection management. |
| `src/extract/` | Memory extraction pipeline: patterns, classification, fingerprinting. |
| `src/conflict/` | Conflict detection: instruction parsing and contradiction checking. |
| `src/restore/` | Selective restore: scoring, selection, serialization. |
| `src/audit/` | Audit trail: logging and report generation. |
| `src/utils/` | Shared utilities: token estimation, config, transcript parsing, stdin reading. |
| `tests/fixtures/` | Test data files that simulate real Claude Code artifacts. |
| `tests/unit/` | Tier 1 tests: pure functions, no I/O. |
| `tests/simulation/` | Tier 2 tests: hook handlers with mock stdin and real SQLite. |
| `tests/e2e/` | Tier 3: manual validation checklists for real Claude Code testing. |
| `docs/` | Planning documentation. Not shipped with the plugin. |

## Build Output

`tsup` compiles TypeScript to `dist/`:

```
dist/
├── hooks/
│   ├── on-session-start.js
│   ├── on-pre-compact.js
│   ├── on-post-compact.js
│   ├── on-stop.js
│   ├── on-session-end.js
│   └── on-instructions-loaded.js
├── store/
│   └── database.js
├── extract/
│   └── ...
└── ...
```

`hooks/hooks.json` references these via:
```json
{
  "command": "node ${CLAUDE_PLUGIN_ROOT}/dist/hooks/on-session-start.js"
}
```
