# E2E Validation Evidence

- **Date**: 2026-04-05
- **Claude Code version**: v2.1.78
- **Plugin version**: 0.1.0 (commit 46975a1)
- **Platform**: macOS, Node.js v20.12.2

---

## Scenario 1: Plugin Install + Validate — PASS

Plugin loads via `claude --plugin-dir /path/to/claude-context-governor` and appears as enabled.
Skills registered: `claude-context-governor:memory-search`, `claude-context-governor:memory-audit`, `claude-context-governor:memory-status`, `claude-context-governor:memory-manage`.

Terminal evidence:
```
 ▐▛███▜▌   Claude Code v2.1.78
▝▜█████▛▘  Sonnet 4.6 · API Usage Billing
  ▘▘ ▝▝    ~/Documents/projects/claude-memory-governance
```

Skills restored after compact:
```
Skills restored (claude-context-governor:memory-search)
```

---

## Scenario 2: Plugin Reload — PASS (via spike)

Validated during M0 spike (2026-04-05):
```
/reload-plugins → Reloaded: 1 plugin · 0 commands · 5 agents · 6 hooks
```

Hook changes take effect without session restart.

---

## Scenario 3: SessionStart Restore Path — PASS

Latest session (d946339e) restored 26 items on startup:
```
SELECT session_id, items_restored FROM sessions WHERE session_id = 'd946339e-7b3e-4455-889f-fc28f7fa681b';
→ items_restored = 26
```

Audit trail confirms load decisions with scores and token costs:
```
loaded | Pinned item restored (score: 0.81) | 55 tokens
loaded | Pinned item restored (score: 0.76) | 65 tokens
loaded | Restored (score: 0.82, category: decision) | 66 tokens
loaded | Restored (score: 0.81, category: constraint) | 130 tokens
...
```

/memory-status output confirms:
```
Last Session
- Started: 2026-04-05T23:59:05Z
- Extracted: 0 items
- Restored: 26 items
```

---

## Scenario 4: PreCompact Capture Path — PASS

PreCompact hook fires on `/compact` and extracts items from transcript:
```
❯ /compact
  ⎿  Compacted (ctrl+o to see full summary)
     PreCompact [node ${CLAUDE_PLUGIN_ROOT}/dist/hooks/on-pre-compact.js] completed successfully
```

Database shows items extracted from transcript source:
```
SELECT COUNT(*) FROM memory_items WHERE memory_source = 'transcript';
→ 11
```

Session 2139c7db extracted 13 items in a single compaction.

---

## Scenario 5: PostCompact Capture Path — PASS

PostCompact hook fires after compact and extracts from compact_summary:
```
     PostCompact [node ${CLAUDE_PLUGIN_ROOT}/dist/hooks/on-post-compact.js] completed successfully
```

Database shows items from compact_summary:
```
SELECT COUNT(*) FROM memory_items WHERE memory_source = 'compact_summary';
→ 66
```

Sessions table has compact summary stored:
```
SELECT session_id, compaction_count FROM sessions WHERE compaction_count > 0;
→ 5 sessions with compaction_count >= 1
```

---

## Scenario 6: InstructionsLoaded Tracking — PASS

CLAUDE.md path recorded in active_instruction_files:
```
SELECT DISTINCT file_path, memory_type, load_reason FROM active_instruction_files;
→ /Users/rushilcs/Documents/projects/claude-memory-governance/CLAUDE.md | Project | session_start
→ /Users/rushilcs/Documents/projects/claude-memory-governance/CLAUDE.md | Project | compact
```

11 total records across sessions. Hook fires on both session_start and compact events.

---

## Scenario 7: Skill Invocation — PASS

All 4 skills demonstrated working:

**/memory-status**:
```
❯ /claude-context-governor:memory-status
→ # Memory Governor Status
   **Project**: /Users/rushilcs/Documents/projects/claude-memory-governance
   **Total items**: 77 | Sessions: 10 | Storage: 76.0 KB
   Active: 51 | Dismissed: 1 | Rejected: 25
```

**/memory-audit** (project-wide and per-session):
```
❯ /claude-context-governor:memory-audit
→ 77 total items across 9 sessions (52 active, 25 rejected)

❯ /claude-context-governor:memory-audit 2139c7db
→ Token cost: 3,968 | Conflicts: 13 | Rejected: 6
   Extracted: 13 | Loaded: 54 | Skipped: 26 | Rejected: 6
```

**/memory-search**:
```
❯ /claude-context-governor:memory-search --category=decision
→ No matching memory items found. (correct — decisions were expired/rejected)

❯ /claude-context-governor:memory-search --status=dismissed
→ No matching memory items found. (correct — dismissed item was revived)
```

**/memory-manage**:
```
❯ /claude-context-governor:memory-manage pin dd6fc35a
→ Pinned: All API responses must include a `request-id` header for tra

❯ /claude-context-governor:memory-manage dismiss 2d659226
→ Dismissed: All API endpoints must use kebab-case naming convention; all

❯ /claude-context-governor:memory-manage revive 2d659226
→ Revived: All API endpoints must use kebab-case naming convention; all

❯ /claude-context-governor:memory-manage stale 8b44024d
→ Marked as stale: 2. User message 1: "We decided to use PostgreSQL instead of
```

---

## Scenario 8: Conflict Detection Live — PASS

52 conflict records in database. Conflicts detected against CLAUDE.md:

```
SELECT COUNT(*) FROM conflict_records;
→ 52

SELECT conflict_source, conflict_source_path, resolution, COUNT(*) as count
FROM conflict_records GROUP BY conflict_source, resolution;
→ claude-md | .../CLAUDE.md | memory-rejected | 52
```

Both polarity and value conflicts detected:
- Polarity: "2-space indentation, never tabs" vs tabs-related memories
- Value: PostgreSQL vs MySQL value-pair detection

Rejected items visible in audit:
```
SELECT COUNT(*) FROM memory_items WHERE status = 'rejected';
→ 25
```

---

## Scenario 9: Memory Lifecycle — Pin/Dismiss/Revive — PASS

All 4 lifecycle actions demonstrated:

1. **Pin**: `dd6fc35a` pinned → audit logged as "pinned"
2. **Dismiss**: `2d659226` dismissed → audit logged as "dismissed"
3. **Revive**: `2d659226` revived → audit logged as "revived"
4. **Stale**: `8b44024d` marked expired → audit logged as "expired"

Audit entries confirm:
```
SELECT action, COUNT(*) FROM audit_entries GROUP BY action;
→ pinned: 2, dismissed: 2, revived: 2, expired: 1
```

Pinned item restored first in subsequent sessions:
```
loaded | Pinned item restored (score: 0.81) | 55 tokens
```

---

## Scenario 10: Fresh Install Smoke Test — PASS

Multiple sessions started cleanly. The first session (with empty DB) created the schema and began extracting. No crashes observed across 10 sessions.

```
SELECT COUNT(*) FROM sessions;
→ 10

SELECT MIN(started_at), MAX(started_at) FROM sessions;
→ 2026-04-05T21:24:04Z to 2026-04-05T23:59:05Z
```

SessionEnd hook shows expected timeout behavior (not a failure):
```
SessionEnd hook [node ${CLAUDE_PLUGIN_ROOT}/dist/hooks/on-session-end.js] failed: Hook cancelled
```
This is expected — the 1.5s hard timeout causes cancellation, which is handled gracefully (documented as no-op).

---

## Summary

| # | Scenario | Result |
|---|----------|--------|
| 1 | Plugin Install | **PASS** |
| 2 | Plugin Reload | **PASS** (spike) |
| 3 | SessionStart Restore | **PASS** |
| 4 | PreCompact Capture | **PASS** |
| 5 | PostCompact Capture | **PASS** |
| 6 | InstructionsLoaded | **PASS** |
| 7 | Skill Invocation | **PASS** (all 4) |
| 8 | Conflict Detection | **PASS** |
| 9 | Pin/Dismiss/Revive | **PASS** |
| 10 | Fresh Install | **PASS** |

**All 10 scenarios validated.** Database contains 77 items, 52 conflicts, 639 audit entries across 10 sessions.
