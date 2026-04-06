# Publish Readiness Assessment

Last updated: 2026-04-05

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

## What Still Requires Manual Claude Code Validation

See [tests/e2e/VALIDATION.md](../tests/e2e/VALIDATION.md) for the full 10-scenario checklist. Key scenarios:

1. **Plugin installs and loads** in a real Claude Code session
2. **SessionStart additionalContext** actually appears in Claude's context
3. **PreCompact/PostCompact** fire on `/compact` and produce items in SQLite
4. **Skills** are invocable and produce output inside Claude Code
5. **Conflict detection** catches contradictions in a live session
6. **Pin/dismiss/revive** lifecycle works end-to-end

None of these are marked as passed in this repository. Evidence must be captured and stored in `tests/e2e/evidence/` before claiming full validation.

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

## Claims to Avoid for Now

- "Production-ready" -- this is a prototype
- "Fully E2E tested" -- manual validation is pending
- "Semantic conflict detection" -- the detector is heuristic (keyword/polarity/value-pair), not semantic
- "All conversation memory is captured" -- only assistant messages from transcripts, plus compact summaries
- "File-aware restore" -- file relevance scoring is implemented but not wired into runtime (scorer always gets neutral baseline)
- "Sessions start from zero without the plugin" -- Claude Code has CLAUDE.md, auto-memory, and compaction summaries; it does not start from absolute zero
- "Complete lifecycle management" -- SessionEnd is a no-op; Stop does minimal work; stale-item cleanup is not implemented

## Recommended Pre-Launch Steps

1. Run the 10 manual validation scenarios in Claude Code
2. Capture evidence artifacts in `tests/e2e/evidence/`
3. Update the results table in VALIDATION.md
4. Record a terminal demo for README/LinkedIn
5. Consider adding a `--version` flag or startup log line for debugging
