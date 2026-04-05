# Implementation Checklist

Derived from milestones. Execute in order.

## M0: Platform Validation Spike -- COMPLETE

- [x] Create `spike/.claude-plugin/plugin.json` (minimal: name + description)
- [x] Create `spike/hooks/hooks.json` with SessionStart, PreCompact, PostCompact, InstructionsLoaded, Stop, SessionEnd
- [x] Write `spike/scripts/on-session-start.sh` -- return hardcoded additionalContext JSON
- [x] Write `spike/scripts/on-pre-compact.sh` -- read transcript_path from stdin, log content
- [x] Write `spike/scripts/on-post-compact.sh` -- read compact_summary from stdin, log content
- [x] Write `spike/scripts/on-instructions-loaded.sh` -- log file_path and load_reason
- [x] Write `spike/scripts/on-stop.sh` -- log last_assistant_message
- [x] Write `spike/scripts/on-session-end.sh` -- log session end reason
- [x] Test A1: plugin loads via `--plugin-dir` -- PASS
- [x] Test A7: `/reload-plugins` -- PASS, hooks reload without session restart
- [x] Test A2: additionalContext injection -- PASS, Claude sees and references injected text
- [x] Test A3: transcript_path readable -- PASS, 22 lines, 16KB JSONL
- [x] Test A4: compact_summary useful -- PASS, 2664 chars structured XML
- [x] Test A5: stdin JSON fields -- PASS, all documented fields plus bonus fields
- [ ] Test A6: InstructionsLoaded -- NOT TESTED (needs CLAUDE.md at project root, will retest in M2)
- [x] Document results in `spike/README.md`
- [x] Go/no-go decision: **GO**

## M1: Foundation

- [ ] `pnpm init` + configure package.json (name, dependencies, scripts)
- [ ] Install: better-sqlite3, uuid
- [ ] Install devDeps: typescript, @types/better-sqlite3, @types/node, vitest, tsup
- [ ] `tsconfig.json` (strict, ES2022, NodeNext)
- [ ] `vitest.config.ts`
- [ ] `tsup.config.ts` (entry per hook handler)
- [ ] `.claude-plugin/plugin.json` (based on validated spike)
- [ ] `hooks/hooks.json` (6 MVP hooks: SessionStart, PreCompact, PostCompact, Stop, SessionEnd, InstructionsLoaded)
- [ ] `src/store/schema.sql` (memory_items, session_records, active_instruction_files, audit_entries, conflict_records + indexes)
- [ ] `src/store/database.ts` (init, migrate, getDb using ${CLAUDE_PLUGIN_DATA})
- [ ] TypeScript interfaces: MemoryItem, SessionRecord, ActiveInstructionFile, AuditEntry, ConflictRecord, Config
- [ ] `src/utils/config.ts` (defaults: token_budget=2000, stale_threshold_days=30, experimental_categories=false)
- [ ] `src/utils/stdin.ts` (read stdin JSON, validate, return typed object)
- [ ] `.gitignore` (node_modules, dist, *.db, spike/results/)
- [ ] `LICENSE` (MIT)
- [ ] Verify: `pnpm build` succeeds, database init creates tables

## M2: Capture Pipeline

- [ ] `src/utils/transcript.ts` (parse JSONL, extract assistant messages, track extraction watermark)
- [ ] `src/hooks/on-instructions-loaded.ts` (record file_path, memory_type, load_reason to active_instruction_files)
- [ ] `src/hooks/on-session-start.ts` (stub: create session record, return empty additionalContext)
- [ ] `src/hooks/on-pre-compact.ts` (read transcript, save snapshot; extraction is M3 stub)
- [ ] `src/hooks/on-post-compact.ts` (save compact_summary to session record; extraction is M3 stub)
- [ ] `src/hooks/on-stop.ts` (save last_assistant_message to session snapshot)
- [ ] `src/hooks/on-session-end.ts` (update ended_at, increment counters; must be <1.5s)
- [ ] Tier 2 test: session-start simulation
- [ ] Tier 2 test: pre-compact simulation
- [ ] Tier 2 test: post-compact simulation
- [ ] Tier 2 test: instructions-loaded simulation

## M3: Memory Extraction

- [ ] `src/extract/patterns.ts` (4 core categories + 3 experimental behind flag)
- [ ] `src/extract/classifier.ts` (category assignment, confidence scoring, source calibration)
- [ ] `src/extract/fingerprint.ts` (SHA-256 of normalized content + category, dedup logic)
- [ ] `src/extract/extractor.ts` (accept text + source type, run patterns, classify, fingerprint, produce candidates)
- [ ] `src/utils/tokens.ts` (character-based estimation, ~4 chars/token)
- [ ] Wire extractor into on-pre-compact.ts (replace stub)
- [ ] Wire extractor into on-post-compact.ts (replace stub, memory_source=compact_summary)
- [ ] Create test fixtures: 3-4 transcript JSONL files, 2-3 compact_summary texts
- [ ] Tier 1 test: extractor
- [ ] Tier 1 test: classifier
- [ ] Tier 1 test: fingerprint (determinism, normalization, dedup)
- [ ] Tier 1 test: patterns (match and no-match cases)
- [ ] Tier 1 test: tokens
- [ ] Verify experimental categories are disabled by default

## M4: Conflict Detection

- [ ] `src/conflict/instruction-parser.ts` (read files from ActiveInstructionFile paths, parse into fragments)
- [ ] `src/conflict/detector.ts` (polarity conflict, value conflict detection)
- [ ] Integrate into extraction pipeline: run conflict check before storing items
- [ ] Store ConflictRecord for detected conflicts
- [ ] Update AuditEntry: log conflict-detected actions
- [ ] Test fixtures: CLAUDE.md with "use spaces" + transcript with "use tabs"
- [ ] Tier 1 test: instruction parser
- [ ] Tier 1 test: detector (polarity + value conflicts)
- [ ] Tier 2 test: end-to-end conflict detection in pre-compact simulation

## M5: Selective Restore

- [ ] `src/restore/scorer.ts` (recency decay, confidence multiplier, category priority, file relevance bonus)
- [ ] `src/restore/selector.ts` (query active + pinned, pin first, greedy fill by score, respect budget)
- [ ] `src/restore/serializer.ts` (structured Markdown with headers, dates, confidence, source, [pinned] tags)
- [ ] `src/audit/logger.ts` (write loaded/skipped entries with reasons and token costs)
- [ ] Complete `src/hooks/on-session-start.ts` (query, score, select, serialize, output additionalContext)
- [ ] Tier 1 test: scorer (ordering correctness)
- [ ] Tier 1 test: serializer (format, budget enforcement)
- [ ] Tier 2 test: session-start restore with mixed items (active, pinned, dismissed, rejected)
- [ ] Performance check: restore completes in <3s on 100-item database

## M6: Skills, Audit, and Lifecycle

- [ ] `src/audit/reporter.ts` (generate Markdown + JSON reports)
- [ ] `skills/memory-status/SKILL.md` (show counts, last session, storage)
- [ ] `skills/memory-audit/SKILL.md` (display audit report)
- [ ] `skills/memory-search/SKILL.md` (query by category, keyword, file, date)
- [ ] `skills/memory-manage/SKILL.md` (pin, dismiss, revive actions)
- [ ] Implement pin/dismiss/revive logic in a management script callable by skills
- [ ] Audit logging for pin/dismiss/revive actions
- [ ] Tier 1 test: reporter (Markdown format, JSON format)
- [ ] Verify: skills reference correct script paths using ${CLAUDE_PLUGIN_ROOT}

## M7: Polish, E2E Validation, and Demo

- [ ] Run Tier 3 scenario V1: plugin install + validate
- [ ] Run Tier 3 scenario V2: plugin reload
- [ ] Run Tier 3 scenario V3: SessionStart restore
- [ ] Run Tier 3 scenario V4: PreCompact capture
- [ ] Run Tier 3 scenario V5: PostCompact capture
- [ ] Run Tier 3 scenario V6: InstructionsLoaded tracking
- [ ] Run Tier 3 scenario V7: conflict detection (live)
- [ ] Run Tier 3 scenario V8: skill invocation
- [ ] Fix issues discovered in e2e validation
- [ ] Edge cases: empty database, corrupt transcript, missing transcript_path, zero items
- [ ] Error handling: never corrupt stdout JSON, log errors to stderr
- [ ] Update README.md with installation, usage, architecture overview
- [ ] Record terminal demo of conflict detection scenario
- [ ] Create demo screenshots for /memory-audit output
- [ ] Final `pnpm build && pnpm test` all green
