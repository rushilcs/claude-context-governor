# MVP Milestones

8 milestones, executed sequentially. M0 is a validation spike that happens before any foundation work.

---

## M0: Claude Code Platform Validation Spike -- COMPLETE

**Goal**: Validate every platform assumption that could break the project, using the smallest possible prototype. No TypeScript, no SQLite, no npm packages. Just shell scripts, JSON files, and manual testing.

**Time**: 1-2 days (actual: <1 day)

**Deliverables**:
- `spike/` directory with minimal plugin manifest, hooks.json, and shell scripts
- Written validation results in `spike/README.md` documenting pass/fail/fallback for each assumption
- Explicit go/no-go decision for proceeding to M1

**Validation steps**:

| # | Assumption | Test | Fallback if fails |
|---|-----------|------|-------------------|
| 1 | Plugin loads via `--plugin-dir` | Create minimal plugin.json, run `claude --plugin-dir ./spike/`, check `/plugin` list | Debug directory structure, check `claude --debug` |
| 2 | `/reload-plugins` works | Modify hooks.json during session, run `/reload-plugins`, verify change | Restart session for each change (slower dev loop) |
| 3 | SessionStart additionalContext injection | Hook echoes hardcoded JSON with additionalContext, verify Claude sees it | Use stdout plain text; if both fail, try UserPromptSubmit |
| 4 | transcript_path is readable | PreCompact hook reads transcript_path, logs content | Extract from compact_summary only (degrades quality but project survives) |
| 5 | PostCompact compact_summary is useful | PostCompact hook captures compact_summary, verify content | Extract from transcript only (still functional) |
| 6 | stdin/stdout JSON contract | All hooks log stdin fields, verify session_id, cwd, hook_event_name present | Handle missing fields defensively |
| 7 | InstructionsLoaded fires for CLAUDE.md | InstructionsLoaded hook logs file_path, verify it fires | Read CLAUDE.md from disk directly for conflict detection |

**Exit criteria**:
- All 7 pass, OR each failure has a documented fallback that preserves core functionality
- Written spike report
- Go/no-go decision recorded

**Dependencies**: Claude Code CLI installed and authenticated

**Result**: GO. All critical assumptions validated. See `spike/README.md` for full results.

**Key discovery**: compact_summary uses structured XML (`<analysis>` + `<summary>` with numbered sections). The extractor should parse this structure, not treat it as unstructured text.

---

## M1: Foundation

**Goal**: Set up the project skeleton, plugin manifest, database, and type system.

**Time**: 2 days

**Deliverables**:
- `package.json` with dependencies (better-sqlite3, uuid) and devDependencies (typescript, vitest, tsup, @types/*)
- `tsconfig.json` (strict mode, ES2022 target, NodeNext module)
- `vitest.config.ts`
- `tsup.config.ts` (separate entry per hook handler)
- `.claude-plugin/plugin.json` based on validated spike
- `hooks/hooks.json` with all 6 MVP hook events configured
- `src/store/schema.sql` with all 5 tables and indexes
- `src/store/database.ts`: init, migrate, getConnection using `${CLAUDE_PLUGIN_DATA}`
- Type definitions for MemoryItem, SessionRecord, ActiveInstructionFile, AuditEntry, ConflictRecord
- `src/utils/config.ts` with defaults (token_budget, stale_threshold_days, etc.)
- `src/utils/stdin.ts` for reading hook input
- `.gitignore`, `LICENSE`

**Dependencies**: M0 spike completed with go decision

**Exit criteria**: `pnpm install && pnpm build` succeeds; database initializes with correct schema; types compile without errors

---

## M2: Capture Pipeline

**Goal**: Wire up all hooks to capture session events and persist them to SQLite.

**Time**: 2 days

**Deliverables**:
- `src/utils/transcript.ts`: parse Claude Code JSONL transcript format
- `src/hooks/on-instructions-loaded.ts`: record file_path to ActiveInstructionFile
- `src/hooks/on-pre-compact.ts`: read transcript, pass to extraction (M3 stub for now, just save transcript snapshot)
- `src/hooks/on-post-compact.ts`: save compact_summary to session record, pass to extraction (M3 stub)
- `src/hooks/on-stop.ts`: save last_assistant_message as turn snapshot
- `src/hooks/on-session-end.ts`: finalize session record (fast, <1.5s)
- Tier 2 simulation tests for all hooks with mock stdin

**Dependencies**: M1

**Exit criteria**: All hooks process mock stdin JSON and write correct records to SQLite. Simulation tests pass.

---

## M3: Memory Extraction

**Goal**: Build the extraction pipeline that converts raw text into classified, fingerprinted memory items.

**Time**: 3 days

**Deliverables**:
- `src/extract/patterns.ts`: regex/phrase patterns for 4 core categories + 3 experimental (behind config flag)
- `src/extract/extractor.ts`: accept text from transcript or compact_summary, run pattern matching, produce candidates
- `src/extract/classifier.ts`: assign category + confidence with source-specific calibration (compact_summary gets +0.05 base)
- `src/extract/fingerprint.ts`: SHA-256 computation, normalization, dedup against existing items
- `src/utils/tokens.ts`: token estimation
- Wire extraction into PreCompact and PostCompact hooks (replace M2 stubs)
- Test fixtures: 3-4 transcript JSONL files, 2-3 compact_summary texts
- Tier 1 unit tests for extractor, classifier, fingerprint, patterns, tokens

**Dependencies**: M2

**Exit criteria**: Given fixture inputs, correct memory items extracted with >80% precision on test cases. Fingerprint dedup works: re-extracting same content supersedes old item. Experimental categories are disabled by default. All Tier 1 tests pass.

---

## M4: Conflict Detection

**Goal**: Detect contradictions between memory candidates and project instructions.

**Time**: 2 days

**Deliverables**:
- `src/conflict/instruction-parser.ts`: read files from ActiveInstructionFile paths, parse into instruction fragments
- `src/conflict/detector.ts`: polarity conflict detection (always/never), value conflict detection (use X vs use Y)
- Integration: extraction pipeline runs conflict detection before storing items
- ConflictRecord storage for detected conflicts
- Audit logging for conflict decisions
- Test fixtures: CLAUDE.md with known rules, transcript with contradicting statements

**Dependencies**: M3

**Exit criteria**: Given CLAUDE.md saying "use spaces" and memory item saying "use tabs," conflict is detected. Hard conflicts result in status=rejected. Soft conflicts result in ConflictRecord with status=active.

---

## M5: Selective Restore

**Goal**: Build the SessionStart restore path that scores, selects, and injects memory into Claude's context.

**Time**: 2 days

**Deliverables**:
- `src/restore/scorer.ts`: scoring functions for recency (exponential decay), confidence, category priority, file relevance
- `src/restore/selector.ts`: pinned items first, then greedy fill by score within token budget
- `src/restore/serializer.ts`: format as structured Markdown with category headers, dates, confidence, source labels, [pinned] tags
- `src/hooks/on-session-start.ts`: complete implementation (query, score, serialize, output additionalContext JSON)
- `src/audit/logger.ts`: write loaded/skipped audit entries with reasons and token costs

**Dependencies**: M4 (conflict detection must work so rejected items are excluded from restore)

**Exit criteria**: SessionStart hook outputs well-formatted additionalContext within token budget. Pinned items are always included. Dismissed/rejected items are excluded. Audit entries record every load/skip decision. Simulation tests pass. Total time <3s on test data.

---

## M6: Skills, Audit, and Lifecycle

**Goal**: Build user-facing skills for inspection and management, plus the audit reporter.

**Time**: 2 days

**Deliverables**:
- `src/audit/reporter.ts`: generate Markdown + JSON audit reports
- `skills/memory-status/SKILL.md`: instructions for showing item counts by category, pinned count, last session info, storage size
- `skills/memory-audit/SKILL.md`: instructions for displaying audit report (calls reporter script)
- `skills/memory-search/SKILL.md`: instructions for querying items by category, keyword, file, date range
- `skills/memory-manage/SKILL.md`: instructions for pin, dismiss, revive actions on memory items

**Dependencies**: M5

**Exit criteria**: All four skills produce correct output when invoked. Pin/dismiss/revive modify items correctly and create audit entries. Audit reporter generates both Markdown and JSON formats.

---

## M7: Polish, E2E Validation, and Demo

**Goal**: Validate the full system in real Claude Code, fix issues, record demos.

**Time**: 3 days

**Deliverables**:
- Run all Tier 3 validation scenarios (V1-V8) in real Claude Code
- Fix any issues discovered during e2e validation
- Edge case handling: empty database, corrupt transcript, missing files, zero items to restore
- Error handling and logging throughout (stderr for debug info, never corrupt stdout JSON)
- README with installation instructions, usage guide, architecture overview
- Terminal recording (VHS or asciinema) of conflict detection demo scenario
- LICENSE file

**Dependencies**: M6

**Exit criteria**: All Tier 3 validation scenarios pass. Fresh `git clone && pnpm install && pnpm build && claude --plugin-dir ./` works. Demo recording complete.

---

## Timeline Summary

| Milestone | Duration | Cumulative |
|-----------|----------|-----------|
| M0: Platform Spike | 1-2 days | 1-2 days |
| M1: Foundation | 2 days | 3-4 days |
| M2: Capture Pipeline | 2 days | 5-6 days |
| M3: Memory Extraction | 3 days | 8-9 days |
| M4: Conflict Detection | 2 days | 10-11 days |
| M5: Selective Restore | 2 days | 12-13 days |
| M6: Skills + Audit | 2 days | 14-15 days |
| M7: Polish + Demo | 3 days | 17-18 days |

**Total estimated**: 17-18 working days for one developer.
