# M0 Platform Validation Spike

## Purpose

Validate Claude Code plugin/hook platform assumptions before building the real system.
All results are logged to `spike/results/`.

## Prerequisites

- Claude Code CLI installed and authenticated (`claude` command works)
- `jq` installed (`brew install jq` or equivalent)

## File Overview

```
spike/
├── .claude-plugin/plugin.json     # Minimal plugin manifest
├── hooks/hooks.json               # 6 hooks: SessionStart, PreCompact, PostCompact, InstructionsLoaded, Stop, SessionEnd
├── scripts/
│   ├── on-session-start.sh        # Injects additionalContext with magic word PINEAPPLE
│   ├── on-pre-compact.sh          # Reads transcript_path, logs content
│   ├── on-post-compact.sh         # Captures compact_summary
│   ├── on-instructions-loaded.sh  # Logs loaded instruction files
│   ├── on-stop.sh                 # Logs last_assistant_message
│   └── on-session-end.sh          # Logs session end reason
├── results/                       # Created automatically, logs go here
├── CLAUDE.md                      # Test rules for InstructionsLoaded validation
└── README.md                      # This file
```

---

## Validation Results

Tested on 2026-04-05, Claude Code v2.1.78, macOS.

| # | Assumption | Result | Notes |
|---|-----------|--------|-------|
| A1 | Plugin loads via --plugin-dir | PASS | Plugin appears as `context-governor-spike Plugin · inline · ✓ enabled` in /plugin list |
| A2 | SessionStart additionalContext injection | PASS | Claude correctly sees and can reference injected text. Responds with "PINEAPPLE" when asked. |
| A3 | transcript_path is readable | PASS | 22 lines, 16,332 bytes. Full JSONL transcript readable by hook process. |
| A4 | PostCompact compact_summary is useful | PASS | 2,664 chars. Rich structured summary with `<analysis>` and `<summary>` XML sections. Highly usable for extraction. |
| A5 | stdin JSON has documented fields | PASS | All documented fields present, plus bonus fields. See field inventory below. |
| A6 | InstructionsLoaded fires for CLAUDE.md | NOT TESTED | Hook never fired. Root cause: no CLAUDE.md at project root. spike/CLAUDE.md is inside the plugin dir, not the project. Needs retest with root-level CLAUDE.md. Fallback (read from disk) is viable regardless. |
| A7 | /reload-plugins works | PASS | `Reloaded: 1 plugin · 0 commands · 5 agents · 6 hooks` confirmed. Hook changes take effect without session restart. |

### Field Inventory (bonus findings)

**SessionStart stdin fields**: `cwd`, `hook_event_name`, `model`, `session_id`, `source`, `transcript_path`
- Bonus: `model` field (e.g. "claude-sonnet-4-6") -- useful for future model-aware behavior
- Bonus: `transcript_path` available even on SessionStart -- we don't need it there but good to know

**PreCompact stdin fields**: `custom_instructions`, `cwd`, `hook_event_name`, `session_id`, `transcript_path`, `trigger`
- Bonus: `custom_instructions` contains user's /compact argument if any

**PostCompact stdin fields**: `compact_summary`, `cwd`, `hook_event_name`, `session_id`, `transcript_path`, `trigger`
- Key finding: compact_summary uses `<analysis>` and `<summary>` XML tags -- parse these for cleaner extraction

**Stop stdin fields**: `cwd`, `hook_event_name`, `last_assistant_message`, `permission_mode`, `session_id`, `stop_hook_active`, `transcript_path`
- Note: `stop_hook_active` is boolean false, not missing. jq `//` operator treats false as null.
- Bonus: `permission_mode` field available

**SessionEnd stdin fields**: `cwd`, `hook_event_name`, `reason`, `session_id`, `transcript_path`
- Confirmed: `reason` = "prompt_input_exit" for normal exit

### Key Observation: compact_summary Format

The compact_summary is NOT plain text. It has XML structure:

```xml
<analysis>
... Claude's internal reasoning about what happened ...
</analysis>

<summary>
1. Primary Request and Intent: ...
2. Key Technical Concepts: ...
3. Files and Code Sections: ...
4. Errors and fixes: ...
5. Problem Solving: ...
6. All user messages: ...
7. Pending Tasks: ...
8. Current Work: ...
9. Optional Next Step: ...
</summary>
```

This is much richer than expected. The `<summary>` section is highly structured and extractable. The extractor should parse this XML structure rather than treating it as unstructured text.

---

## Go/No-Go Decision

**GO** -- proceed to M1.

All critical assumptions validated (A1-A5, A7). A6 (InstructionsLoaded) was not triggered due to test setup (no CLAUDE.md at project root), not a platform failure. The fallback (reading CLAUDE.md from disk) works regardless. InstructionsLoaded can be retested during M2 with a proper project-root CLAUDE.md.

No blockers. No fallbacks needed. The platform behaves as documented.
