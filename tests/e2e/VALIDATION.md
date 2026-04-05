# Tier 3: Real Claude Code E2E Validation

These scenarios must be run inside a real Claude Code session. They are not automatable.

## Prerequisites

1. Build the project: `npm run build`
2. Have Claude Code CLI installed

## Scenarios

### 1. Plugin Install + Validate

**Steps:**
1. `claude --plugin-dir ./`
2. Run `/plugins` to list installed plugins
3. Verify `claude-context-governor` appears

**Pass criteria:** Plugin loads without errors, appears in plugin list

---

### 2. Plugin Reload

**Steps:**
1. Start a session with the plugin loaded
2. Modify `hooks/hooks.json` (e.g., change a timeout value)
3. Run `/reload-plugins`
4. Verify the change took effect (check hook behavior)

**Pass criteria:** Changed hook configuration takes effect without restarting

---

### 3. SessionStart Restore Path

**Steps:**
1. Manually seed the SQLite database with 3-5 test memory items:
   - At least 1 decision
   - At least 1 constraint
   - At least 1 pinned item
2. Start a new Claude Code session with the plugin loaded
3. Check if restored memory appears in Claude's context

**Pass criteria:** `additionalContext` appears with formatted memory items, pinned items present

---

### 4. PreCompact Capture Path

**Steps:**
1. Start a session with the plugin
2. Have a conversation that includes decisions (e.g., "Let's use PostgreSQL")
3. Run `/compact`
4. Check SQLite for new memory items extracted from transcript

**Pass criteria:** PreCompact hook fires, transcript is readable, items appear in `memory_items` table

---

### 5. PostCompact Capture Path

**Steps:**
1. After running `/compact` (from scenario 4)
2. Check SQLite for items with `memory_source = 'compact_summary'`
3. Check `sessions` table for `last_compact_summary` value

**Pass criteria:** compact_summary is received and stored, extraction produces items

---

### 6. InstructionsLoaded Tracking

**Steps:**
1. Ensure project has a `CLAUDE.md` file at root
2. Start a Claude Code session
3. Check `active_instruction_files` table in SQLite

**Pass criteria:** `CLAUDE.md` path recorded with correct `memory_type` and `load_reason`

---

### 7. Skill Invocation — /memory-status

**Steps:**
1. After scenarios 3-5 have populated the database
2. Invoke `/memory-status` in a Claude Code session

**Pass criteria:** Skill executes, shows item counts by status and category

---

### 8. Conflict Detection Live

**Steps:**
1. Create `CLAUDE.md` with rule: "Always use spaces for indentation, never tabs"
2. Start a session, have Claude suggest using tabs in conversation
3. Run `/compact`
4. Check for conflict records in SQLite
5. Run `/memory-audit` to see conflict in the audit report

**Pass criteria:** Conflict detected between memory item and CLAUDE.md rule, item rejected or flagged

---

### 9. Memory Lifecycle — Pin/Dismiss/Revive

**Steps:**
1. Find an item ID via `/memory-search`
2. Pin it: `/memory-manage pin <id>`
3. Verify it shows as pinned in `/memory-status`
4. Dismiss it: `/memory-manage dismiss <id>`
5. Verify it no longer appears in active items
6. Revive it: `/memory-manage revive <id>`
7. Verify it's active again

**Pass criteria:** All lifecycle actions work, each is audit-logged

---

### 10. Fresh Install Smoke Test

**Steps:**
1. Delete the governor.db file
2. Start a fresh Claude Code session with the plugin
3. Verify no errors on empty database
4. Work normally, trigger `/compact`
5. Run `/memory-status`

**Pass criteria:** No crashes on empty state, graceful handling throughout

---

## Results

| # | Scenario | Status | Notes |
|---|----------|--------|-------|
| 1 | Plugin Install | | |
| 2 | Plugin Reload | | |
| 3 | SessionStart Restore | | |
| 4 | PreCompact Capture | | |
| 5 | PostCompact Capture | | |
| 6 | InstructionsLoaded | | |
| 7 | /memory-status | | |
| 8 | Conflict Detection | | |
| 9 | Pin/Dismiss/Revive | | |
| 10 | Fresh Install | | |
