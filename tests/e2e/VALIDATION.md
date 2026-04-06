# Validation Status

## Tier 1: Automated Unit Tests (46 tests) -- PASSING

Pure-function tests with no external dependencies. Run via `npm test`.

| Test File | Tests | What It Covers |
|-----------|-------|----------------|
| classifier.test.ts | 7 | Category pattern matching, confidence by source |
| fingerprint.test.ts | 6 | SHA-256 dedup, normalization (whitespace, case) |
| tokens.test.ts | 4 | Token estimation heuristic |
| extractor.test.ts | 7 | Full extraction pipeline, dedup, audit logging |
| detector.test.ts | 5 | Polarity/value conflict detection, DB persistence |
| scorer.test.ts | 5 | Recency, confidence, category priority scoring |
| serializer.test.ts | 5 | Markdown context formatting, pinned/source labels |
| skills.test.ts | 7 | Skill CLI argv parsing, usage messages, error exits (requires build) |

Note: `skills.test.ts` shells out to compiled scripts in `dist/`. The `npm test` command builds before testing, so this works from a fresh clone.

## Tier 2: Automated Simulation Tests (15 tests) -- PASSING

End-to-end pipeline tests using in-memory SQLite. Simulate hook inputs and verify DB side effects.

| Test File | Tests | What It Covers |
|-----------|-------|----------------|
| session-start.test.ts | 6 | Restore selection, token budgeting, pinned priority, dismissed exclusion, audit logging |
| pre-compact.test.ts | 3 | Transcript fixture parsing, SQLite storage, session extraction count |
| post-compact.test.ts | 3 | compact_summary extraction, confidence bonus, cross-source dedup |
| instructions-loaded.test.ts | 3 | Instruction file recording, multiple files, path dedup |

## Tier 3: Manual Claude Code Validation -- PASS (10/10)

Validated 2026-04-05, Claude Code v2.1.78, macOS, Node.js v20.12.2.
Full evidence: [tests/e2e/evidence/validation-2026-04-05.md](evidence/validation-2026-04-05.md).

### Prerequisites

1. Build the project: `npm run build`
2. Have Claude Code CLI installed
3. Start Claude Code with: `claude --plugin-dir /path/to/claude-context-governor`

### Scenario 1: Plugin Install + Validate

**Steps:**
1. `claude --plugin-dir ./`
2. Run `/plugins` to list installed plugins
3. Verify `claude-context-governor` appears

**Pass criteria:** Plugin loads without errors, appears in plugin list.

**Evidence to capture:** Terminal output showing plugin in list.

---

### Scenario 2: Plugin Reload

**Steps:**
1. Start a session with the plugin loaded
2. Modify `hooks/hooks.json` (e.g., change a timeout value)
3. Run `/reload-plugins`
4. Verify the change took effect

**Pass criteria:** Changed hook configuration takes effect without restarting.

**Evidence to capture:** Terminal output before/after reload.

---

### Scenario 3: SessionStart Restore Path

**Steps:**
1. Seed the SQLite database with 3-5 test memory items (at least 1 decision, 1 constraint, 1 pinned item)
2. Start a new Claude Code session with the plugin loaded
3. Ask Claude "what do you know about this project?" or check if restored memory appears in context

**Pass criteria:** `additionalContext` with formatted memory items appears in Claude's context. Pinned items present.

**Evidence to capture:** Claude's response referencing restored memories, or hook debug output showing additionalContext.

---

### Scenario 4: PreCompact Capture Path

**Steps:**
1. Start a session with the plugin
2. Have a conversation that includes decisions (e.g., "Let's use PostgreSQL for this project")
3. Run `/compact`
4. Check SQLite: `sqlite3 ~/.claude/plugins/data/claude-context-governor-inline/governor.db "SELECT id, category, content FROM memory_items ORDER BY created_at DESC LIMIT 5"`

**Pass criteria:** PreCompact hook fires, transcript is readable, items appear in `memory_items` table.

**Evidence to capture:** SQLite query output showing extracted items.

---

### Scenario 5: PostCompact Capture Path

**Steps:**
1. After running `/compact` (from scenario 4)
2. Check SQLite for items with `memory_source = 'compact_summary'`
3. Check `sessions` table for `last_compact_summary` value

**Pass criteria:** compact_summary is received and stored, extraction produces items.

**Evidence to capture:** SQLite query output.

---

### Scenario 6: InstructionsLoaded Tracking

**Steps:**
1. Ensure project has a `CLAUDE.md` file at root
2. Start a Claude Code session
3. Check `active_instruction_files` table in SQLite

**Pass criteria:** `CLAUDE.md` path recorded.

**Evidence to capture:** SQLite query output. Note: InstructionsLoaded hook may not fire reliably (see risks doc). A fallback exists that reads CLAUDE.md from disk for conflict detection.

---

### Scenario 7: Skill Invocation -- /claude-context-governor:memory-status

**Steps:**
1. After scenarios 3-5 have populated the database
2. Invoke `/claude-context-governor:memory-status` in a Claude Code session

**Pass criteria:** Skill executes, shows item counts by status and category.

**Evidence to capture:** Claude's displayed output from the skill.

---

### Scenario 8: Conflict Detection Live

**Steps:**
1. Create `CLAUDE.md` with rule: "Always use spaces for indentation, never tabs"
2. Start a session, have Claude suggest using tabs in conversation
3. Run `/compact`
4. Check for conflict records: `sqlite3 <db-path> "SELECT * FROM conflict_records"`
5. Run `/claude-context-governor:memory-audit` to see conflict in the audit report

**Pass criteria:** Conflict detected between memory item and CLAUDE.md rule, item rejected or flagged.

**Evidence to capture:** SQLite conflict_records output and /claude-context-governor:memory-audit output.

---

### Scenario 9: Memory Lifecycle -- Pin/Dismiss/Revive

**Steps:**
1. Find an item ID via `/claude-context-governor:memory-search`
2. Pin it: `/claude-context-governor:memory-manage pin <id>`
3. Verify it shows as pinned in `/claude-context-governor:memory-status`
4. Dismiss it: `/claude-context-governor:memory-manage dismiss <id>`
5. Verify it no longer appears in active items
6. Revive it: `/claude-context-governor:memory-manage revive <id>`
7. Verify it's active again

**Pass criteria:** All lifecycle actions work, each is audit-logged.

**Evidence to capture:** Terminal output of each step.

---

### Scenario 10: Fresh Install Smoke Test

**Steps:**
1. Delete the governor.db file
2. Start a fresh Claude Code session with the plugin
3. Verify no errors on empty database
4. Work normally, trigger `/compact`
5. Run `/claude-context-governor:memory-status`

**Pass criteria:** No crashes on empty state, graceful handling throughout.

**Evidence to capture:** Terminal output showing clean startup and first extraction.

---

## Evidence Artifacts

When manual validation is performed, store evidence in `tests/e2e/evidence/`:

```
tests/e2e/evidence/
  scenario-1-plugin-install.txt    # terminal output
  scenario-3-restore.txt           # Claude response showing restored memory
  scenario-4-precompact.txt        # SQLite query results
  scenario-8-conflict.txt          # conflict_records + audit output
  ...
```

Evidence files should include:
- Date of validation
- Claude Code version
- Plugin version / commit hash
- Raw terminal output (copy-paste, not screenshots)

## Results

| # | Scenario | Automated | Manual | Notes |
|---|----------|-----------|--------|-------|
| 1 | Plugin Install | N/A | **PASS** | Plugin loads, skills registered |
| 2 | Plugin Reload | N/A | **PASS** | Validated in M0 spike |
| 3 | SessionStart Restore | Simulation PASS | **PASS** | 26 items restored, pinned-first confirmed |
| 4 | PreCompact Capture | Simulation PASS | **PASS** | 11 transcript items, hook fires on /compact |
| 5 | PostCompact Capture | Simulation PASS | **PASS** | 66 compact_summary items across sessions |
| 6 | InstructionsLoaded | Simulation PASS | **PASS** | CLAUDE.md recorded on session_start + compact |
| 7 | /claude-context-governor:memory-status | Argv test PASS | **PASS** | All 4 skills produce correct output |
| 8 | Conflict Detection | Unit test PASS | **PASS** | 52 conflicts, 25 rejected items |
| 9 | Pin/Dismiss/Revive | N/A | **PASS** | Pin, dismiss, revive, stale all work |
| 10 | Fresh Install | N/A | **PASS** | Clean startup across 10 sessions |
