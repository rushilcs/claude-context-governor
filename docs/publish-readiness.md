# Publish Readiness Assessment

Last updated: 2026-04-06

## What Is Truly Working Now

### Core Pipeline
- **Extraction**: Pattern-based extraction from assistant messages in transcripts (PreCompact) and from compaction summaries (PostCompact). 4 core categories: decision, constraint, convention, bug-lesson.
- **Deduplication**: SHA-256 fingerprint of normalized content + category. Duplicate items are superseded, not duplicated.
- **Conflict detection**: Heuristic keyword overlap + polarity analysis + 8 value-pair rules. Checks extracted candidates against CLAUDE.md and .claude/rules/ content. Hard conflicts (high overlap or value-pair match) reject items; soft conflicts flag them.
- **Selective restore**: SessionStart injects scored, budget-constrained memory items via `additionalContext`. Scoring uses recency (exponential decay), confidence, and category priority. Pinned items always included first.
- **Audit trail**: Every extract, load, skip, reject, conflict-detect, pin, dismiss, revive, and expire action is logged with session ID, timestamp, memory item ID, reason, and token cost.
- **User lifecycle controls**: Pin, dismiss, revive, mark-as-stale via /memory-manage skill.
- **4 skills**: /memory-status, /memory-audit, /memory-search, /memory-manage. All read argv (project-dir + optional args), query SQLite, output formatted text.

### What Each Hook Actually Does
| Hook | Actual behavior |
|------|----------------|
| SessionStart | Queries SQLite, scores items, fills token budget, outputs additionalContext JSON |
| PreCompact | Reads transcript JSONL, extracts assistant messages, runs extraction + conflict check |
| PostCompact | Reads compact_summary, runs extraction + conflict check |
| InstructionsLoaded | Records instruction file path to active_instruction_files table |
| Stop | Ensures session record exists (no snapshot or stale-check yet) |
| SessionEnd | No-op (reads stdin, exits) |

## What Is Automated-Test Verified

61 tests passing (39 unit + 15 simulation + 7 skill argv):

- **Classifier**: 7 tests -- pattern matching for all 4 categories, confidence by source, null for non-matches
- **Fingerprint**: 6 tests -- determinism, whitespace/case normalization, category/content differentiation
- **Tokens**: 4 tests -- estimation heuristic
- **Extractor**: 7 tests -- extraction, dedup, related files, audit logging, non-match filtering
- **Detector**: 5 tests -- polarity conflict, value conflict, non-conflicting items, DB persistence, audit logging
- **Scorer**: 5 tests -- recency, confidence, category priority, file relevance (test-only path), breakdown
- **Serializer**: 5 tests -- empty output, header/budget, category grouping, pinned label, source label
- **Skills**: 7 tests -- argv validation, usage messages, error exits for all 4 skills (requires build artifacts)
- **SessionStart sim**: 6 tests -- restore, budget, pinned priority, empty DB, dismissed exclusion, audit
- **PreCompact sim**: 3 tests -- transcript fixture extraction, SQLite storage, session count
- **PostCompact sim**: 3 tests -- compact_summary extraction, confidence bonus, cross-source dedup
- **InstructionsLoaded sim**: 3 tests -- file recording, multiple files, path dedup

### Build dependency note

Skill CLI tests (`skills.test.ts`) shell out to compiled scripts in `dist/`. The `npm test` and `npm run verify` commands build before testing, so tests pass from a fresh clone. For rapid iteration without rebuilding, use `npm run test:fast` (which will skip skill tests if `dist/` is missing).

## What Is Simulation Verified (But Not Live)

The simulation tests (Tier 2) exercise the same code paths that hooks call, using in-memory SQLite. They verify:
- The extraction pipeline produces correct items from realistic transcript/summary fixtures
- The restore pipeline selects and serializes items correctly
- Token budgeting and pinned-first logic work
- Audit entries are written for all decisions

These are necessary but not sufficient. They do not prove hooks fire correctly inside Claude Code.

## Manual Claude Code Validation — COMPLETE

All 10 scenarios validated on 2026-04-05, Claude Code v2.1.78, macOS.
See [tests/e2e/evidence/validation-2026-04-05.md](../tests/e2e/evidence/validation-2026-04-05.md) for full evidence.

| # | Scenario | Result |
|---|----------|--------|
| 1 | Plugin Install | **PASS** |
| 2 | Plugin Reload | **PASS** |
| 3 | SessionStart Restore | **PASS** — 26 items restored, pinned-first |
| 4 | PreCompact Capture | **PASS** — transcript extraction working |
| 5 | PostCompact Capture | **PASS** — compact_summary extraction working |
| 6 | InstructionsLoaded | **PASS** — CLAUDE.md path recorded |
| 7 | Skill Invocation | **PASS** — all 4 skills working |
| 8 | Conflict Detection | **PASS** — 52 conflicts detected, 25 items rejected |
| 9 | Pin/Dismiss/Revive | **PASS** — all lifecycle actions work |
| 10 | Fresh Install | **PASS** — clean startup, no crashes |

Database at validation time: 77 items, 52 conflicts, 639 audit entries, 10 sessions.

## Fresh-Clone Developer Path

After `git clone`, these commands should work:

```bash
npm install
npm run verify    # typecheck + build + test (61/61)
```

See [docs/fresh-clone-audit.md](fresh-clone-audit.md) for the full audit of the first-time developer path.

## Safe Public Claims

These are accurate and defensible:

- "Governed cross-session memory for Claude Code"
- "Selective, explainable, conflict-checked memory restoration"
- "Auditable memory extraction and restore decisions"
- "Extracts structured candidate memories from assistant messages in transcripts and compaction summaries"
- "Heuristic conflict detection against CLAUDE.md and .claude/rules/"
- "Token-budgeted restore with pinned-item priority"
- "SHA-256 fingerprint deduplication"
- "Local-first, SQLite-backed, no cloud dependencies"
- "Early MVP / prototype"
- "All 10 E2E scenarios validated in Claude Code v2.1.78"

## Claims to Avoid for Now

- "Production-ready" -- this is a prototype
- "Semantic conflict detection" -- the detector is heuristic (keyword/polarity/value-pair), not semantic
- "All conversation memory is captured" -- only assistant messages from transcripts, plus compact summaries
- "File-aware restore" -- file relevance scoring is implemented but not wired into runtime (scorer always gets neutral baseline)
- "Sessions start from zero without the plugin" -- Claude Code has CLAUDE.md, auto-memory, and compaction summaries; it does not start from absolute zero
- "Complete lifecycle management" -- SessionEnd is a no-op; Stop does minimal work; stale-item cleanup is not implemented

## Recommended Next Steps

1. Record a terminal demo for README/LinkedIn (VHS or asciinema)
2. Consider adding a `--version` flag or startup log line for debugging
3. Investigate false positive conflicts from compact summary fragments
4. Add FTS5 for semantic search in a future milestone
